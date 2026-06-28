// services/reminder.service.js
//
// Background scheduler (node-cron) that sends appointment reminders for
// ACCEPTED appointments at three lead times: 2 days, 1 day, and 1 hour before.
//
// Delivery: in-app notification + Socket.IO emit + email.
// Dedup: each reminder is "claimed" atomically via a flag on the appointment
// (remindersSent.{twoDay,oneDay,oneHour}) so it fires exactly once, even across
// overlapping runs or restarts. Earlier windows that are already moot (e.g. an
// appointment booked 30 min out) are marked sent without firing.

import cron from "node-cron";
import mongoose from "mongoose";
import Appointment from "../models/appointment.model.js";
import Referral from "../models/referral.model.js";
import Notification from "../models/notification.model.js";
import { emitNotificationEvent } from "./socket.js";
import { sendAppointmentReminder } from "./email.js";
import { pickDueReminder, fmtDate, fmtTime } from "./reminder.utils.js";
import logger from "../lib/logger.js";

const HOUR = 60 * 60 * 1000;

// Build the appointment's start datetime from its date (calendar day) + HH:MM.
const apptStart = (appt) => {
  const [h, m] = appt.startTime.split(":").map(Number);
  const s = new Date(appt.date);
  s.setHours(h, m, 0, 0);
  return s;
};

// Recipient-specific message for a given lead time.
const messageFor = (role, { lead, type, counselorName, studentName, dateStr, timeStr }) => {
  if (lead === "oneHour") {
    if (role === "student")  return `Your ${type} appointment with Guidance Counselor ${counselorName} starts in one hour (today at ${timeStr}).`;
    if (role === "counselor") return `Your ${type} session with ${studentName} starts in one hour (today at ${timeStr}).`;
    return `A ${type} counseling session for the student you referred starts in one hour (today at ${timeStr}).`;
  }
  if (lead === "oneDay") {
    if (role === "student")  return `Reminder: Your ${type} counseling session with ${counselorName} is tomorrow (${dateStr} at ${timeStr}). Please arrive on time.`;
    if (role === "counselor") return `Reminder: Your ${type} session with ${studentName} is tomorrow (${dateStr} at ${timeStr}).`;
    return `Reminder: The student you referred has a ${type} counseling session tomorrow (${dateStr} at ${timeStr}).`;
  }
  // twoDay
  if (role === "student")  return `Reminder: Your ${type} appointment with Guidance Counselor ${counselorName} is scheduled in two days (${dateStr} at ${timeStr}).`;
  if (role === "counselor") return `Reminder: You have a ${type} session with ${studentName} in two days (${dateStr} at ${timeStr}).`;
  return `Reminder: The student you referred has a ${type} counseling session in two days (${dateStr} at ${timeStr}).`;
};

const notify = async (user, role, appt, lead, ctx) => {
  if (!user?._id) return;
  const message = messageFor(role, ctx);
  try {
    const n = await Notification.create({
      userId: user._id,
      appointmentId: appt._id,
      type: "appointment_reminder",
      message,
    });
    emitNotificationEvent(user._id.toString(), "appointment_reminder", {
      notificationId: n._id,
      message,
      appointmentId: appt._id,
    });
  } catch (e) {
    logger.error("reminder notification failed", { error: e.message, userId: user._id });
  }
  if (user.email) {
    sendAppointmentReminder({
      to: user.email,
      name: user.fullName,
      message,
      date: appt.date,
      startTime: fmtTime(appt.startTime),
      type: appt.type,
    }).catch((e) => logger.error("reminder email failed", { error: e.message, to: user.email }));
  }
};

export const processReminders = async () => {
  const now = new Date();
  try {
    // Accepted appointments whose start is at most ~49h away (and not long past).
    const appts = await Appointment.find({
      status: "accepted",
      date: mongoose.trusted({ $gte: new Date(now.getTime() - 24 * HOUR), $lte: new Date(now.getTime() + 49 * HOUR) }),
    })
      .populate("studentId", "fullName email")
      .populate("counselorId", "fullName email");

    for (const appt of appts) {
      const hoursUntil = (apptStart(appt) - now) / HOUR;
      if (hoursUntil <= 0) continue; // already started / past

      const sent = appt.remindersSent || {};

      // Decide which single reminder is due now, and which earlier windows are moot.
      const { dueKey, moot } = pickDueReminder(hoursUntil, sent);

      // Suppress earlier windows that no longer make sense (no send).
      const mootSet = {};
      for (const k of moot) if (!sent[k]) mootSet[`remindersSent.${k}`] = true;
      if (Object.keys(mootSet).length) {
        await Appointment.updateOne({ _id: appt._id }, { $set: mootSet });
      }

      if (!dueKey) continue;

      // Atomically claim this reminder so it fires exactly once.
      const path = `remindersSent.${dueKey}`;
      const claim = await Appointment.findOneAndUpdate(
        { _id: appt._id, [path]: mongoose.trusted({ $ne: true }) },
        { $set: { [path]: true } },
      );
      if (!claim) continue; // already claimed by another run

      const ctx = {
        lead: dueKey,
        type: appt.type,
        counselorName: appt.counselorId?.fullName || "your counselor",
        studentName: appt.studentId?.fullName || "the student",
        dateStr: fmtDate(appt.date),
        timeStr: fmtTime(appt.startTime),
      };

      await notify(appt.studentId, "student", appt, dueKey, ctx);
      await notify(appt.counselorId, "counselor", appt, dueKey, ctx);

      // Referral-sourced appointments also notify the referring faculty.
      if (appt.referralId) {
        const ref = await Referral.findById(appt.referralId).populate("facultyId", "fullName email");
        if (ref?.facultyId) await notify(ref.facultyId, "faculty", appt, dueKey, ctx);
      }

      logger.info(`Reminder sent (${dueKey}) for appointment ${appt._id}`);
    }
  } catch (e) {
    logger.error("processReminders failed", { error: e.message });
  }
};

let task = null;

export const startReminderJobs = () => {
  if (task) return;
  // Every 5 minutes — fine-grained enough for the 1-hour reminder.
  task = cron.schedule("*/5 * * * *", processReminders);
  logger.info("Appointment reminder scheduler started (every 5 minutes)");
};
