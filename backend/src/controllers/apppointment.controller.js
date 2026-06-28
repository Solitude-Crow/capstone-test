// controllers/appointment.controller.js
import mongoose from "mongoose";
import Appointment from "../models/appointment.model.js";
import Availability from "../models/availability.model.js";
import Notification from "../models/notification.model.js";
import Referral from "../models/referral.model.js";
import PreAssessment from "../models/preAssessment.model.js";
import User from "../models/user.model.js";
import { emitNotificationEvent } from "../services/socket.js";
import {
  sendAppointmentConfirmation,
  sendAppointmentStatusUpdate,
} from "../services/email.js";
import logger from "../lib/logger.js";

// ── Internal helper ───────────────────────────────────────────────────────────
// mongoose.set("sanitizeFilter", true) in db.js strips $-prefixed operator keys
// from query objects. We use mongoose.trusted() to mark ranges WE constructed
// so Mongoose won't strip $gte/$lte/$lt from them.
const dateRange = (dateInput) => {
  const d = new Date(dateInput);
  const start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
  const end   = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59, 999));
  return mongoose.trusted({ $gte: start, $lte: end });
};

// ── Helper: create notification + emit socket event ───────────────────────────
const createNotification = async (userId, appointmentId, type, message) => {
  const notif = await Notification.create({ userId, appointmentId, type, message });
  emitNotificationEvent(userId.toString(), type, {
    notificationId: notif._id,
    message,
    appointmentId,
  });
  return notif;
};

// ── Helper: atomically free a slot ────────────────────────────────────────────
const freeUpSlot = async (counselorId, date, startTime, endTime, session = null) => {
  const opts = session ? { session } : {};
  const result = await Availability.updateOne(
    mongoose.trusted({
      counselorId,
      date: dateRange(date),
      "availableSlots.startTime": startTime,
      "availableSlots.endTime": endTime,
    }),
    {
      $set: {
        "availableSlots.$.isBooked": false,
        "availableSlots.$.appointmentId": null,
      },
    },
    opts,
  );
  if (result.matchedCount === 0) {
    logger.warn(`freeUpSlot: no slot found for counselor ${counselorId} ${date} ${startTime}-${endTime}`);
  }
};

// ── Create Appointment ────────────────────────────────────────────────────────
export const createAppointment = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    let appointment;

    await session.withTransaction(async () => {
      const studentId = req.user._id;
      const { counselorId, type, date, startTime, endTime, notes } = req.body;

      const counselor = await User.findOne(
        { _id: counselorId, role: "counselor", isActive: true },
        "fullName email",
      ).lean().session(session);
      if (!counselor)
        throw Object.assign(new Error("Counselor not found"), { statusCode: 404 });

      const conflict = await Appointment.findOne(
        mongoose.trusted({
          studentId,
          counselorId,
          date: dateRange(date),
          status: mongoose.trusted({ $in: ["pending", "accepted", "rescheduled"] }),
        })
      ).lean().session(session);

      if (conflict) {
        throw Object.assign(
          new Error("You already have a pending appointment on this date"),
          { statusCode: 400 },
        );
      }

      const slotUpdate = await Availability.updateOne(
        mongoose.trusted({
          counselorId,
          date: dateRange(date),
          availableSlots: mongoose.trusted({ $elemMatch: { startTime, endTime, isBooked: false } }),
        }),
        { $set: { "availableSlots.$.isBooked": true } },
        { session },
      );

      if (slotUpdate.matchedCount === 0) {
        throw Object.assign(
          new Error("No availability record found for this date"),
          { statusCode: 400 },
        );
      }
      if (slotUpdate.modifiedCount === 0) {
        throw Object.assign(
          new Error("This time slot was just booked. Please choose another."),
          { statusCode: 409 },
        );
      }

      [appointment] = await Appointment.create(
        [{ studentId, counselorId, type, date, startTime, endTime, notes }],
        { session },
      );

      await Availability.updateOne(
        mongoose.trusted({
          counselorId,
          date: dateRange(date),
          "availableSlots.startTime": startTime,
          "availableSlots.endTime": endTime,
        }),
        { $set: { "availableSlots.$.appointmentId": appointment._id } },
        { session },
      );
    });

    await appointment.populate([
      { path: "studentId", select: "fullName email" },
      { path: "counselorId", select: "fullName email specialization" },
    ]);

    await createNotification(
      appointment.counselorId._id,
      appointment._id,
      "appointment_created",
      `New appointment request from ${req.user.fullName} for ${appointment.type}`,
    );

    sendAppointmentConfirmation({
      to: req.user.email,
      studentName: req.user.fullName,
      counselorName: appointment.counselorId.fullName,
      date: appointment.date,
      startTime: appointment.startTime,
      endTime: appointment.endTime,
      type: appointment.type,
    }).catch((err) => logger.error("Confirmation email failed:", { error: err.message }));

    logger.info(`Appointment created: ${appointment._id} by student ${req.user._id}`);
    res.status(201).json(appointment);
  } catch (error) {
    const status = error.statusCode || 500;
    logger.error("createAppointment error:", { error: error.message });
    res.status(status).json({ message: error.message || "Server error" });
  } finally {
    session.endSession();
  }
};

// ── Get My Appointments ───────────────────────────────────────────────────────
export const getMyAppointments = async (req, res) => {
  try {
    const userId = req.user._id;
    const role = req.user.role;
    const { status, page = 1, limit = 10 } = req.query;

    const query = role === "student" ? { studentId: userId } : { counselorId: userId };
    if (status) query.status = status;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [appointments, total] = await Promise.all([
      Appointment.find(query)
        .populate("studentId", "fullName email studentIDnum course yearLevel profilePic")
        .populate("counselorId", "fullName email specialization profilePic")
        .sort({ date: -1, startTime: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Appointment.countDocuments(query),
    ]);

    res.json({
      appointments,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    logger.error("getMyAppointments error:", { error: error.message });
    res.status(500).json({ message: "Server error" });
  }
};

// ── Update Appointment Status ─────────────────────────────────────────────────
export const updateAppointmentStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;
    const counselorId = req.user._id;

    const appointment = await Appointment.findById(id)
      .populate("studentId", "fullName email")
      .populate("counselorId", "fullName email");

    if (!appointment) return res.status(404).json({ message: "Appointment not found" });
    if (appointment.counselorId._id.toString() !== counselorId.toString()) {
      return res.status(403).json({ message: "Not authorized" });
    }

    const allowedTransitions = {
      pending: ["accepted", "rejected"],
      accepted: ["completed", "cancelled"],
      rescheduled: ["accepted", "rejected"],
    };

    if (!allowedTransitions[appointment.status]?.includes(status)) {
      return res.status(400).json({
        message: `Cannot transition from '${appointment.status}' to '${status}'`,
      });
    }

    appointment.status = status;
    if (notes) appointment.notes = notes;
    if (status === "completed" && notes) appointment.counselorNotes = notes;
    await appointment.save();

    if (status === "rejected" || status === "cancelled") {
      await freeUpSlot(
        appointment.counselorId._id,
        appointment.date,
        appointment.startTime,
        appointment.endTime,
      );
    }

    // Sync referral status when appointment changes
    if (appointment.referralId) {
      const referralStatus = status === "accepted" ? "scheduled" : status === "completed" ? "completed" : null;
      if (referralStatus) {
        await Referral.updateOne(
          { _id: appointment.referralId },
          {
            $set: { status: referralStatus },
            $push: {
              statusHistory: {
                status:    referralStatus,
                changedBy: counselorId,
                changedAt: new Date(),
                note:      `Appointment ${status}`,
              },
            },
          },
        );
      }
    }

    const messages = {
      accepted: `Your appointment on ${new Date(appointment.date).toLocaleDateString()} has been accepted`,
      rejected: `Your appointment on ${new Date(appointment.date).toLocaleDateString()} was declined`,
      completed: `Your appointment has been marked as completed. You can now leave feedback.`,
    };

    if (appointment.studentId) {
      await createNotification(
        appointment.studentId._id,
        appointment._id,
        `appointment_${status}`,
        messages[status] || `Appointment updated to ${status}`,
      );
    }

    if (appointment.studentId?.email) {
      sendAppointmentStatusUpdate({
        to: appointment.studentId.email,
        recipientName: appointment.studentId.fullName,
        status,
        date: appointment.date,
        startTime: appointment.startTime,
        counselorName: appointment.counselorId.fullName,
        notes,
      }).catch((err) => logger.error("Status update email failed:", { error: err.message }));
    }

    logger.info(`Appointment ${id} → ${status} by counselor ${counselorId}`);
    res.json(appointment);
  } catch (error) {
    logger.error("updateAppointmentStatus error:", { error: error.message });
    res.status(500).json({ message: "Server error" });
  }
};

// ── Reschedule Appointment ────────────────────────────────────────────────────
export const rescheduleAppointment = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    let appointment;

    await session.withTransaction(async () => {
      const { id } = req.params;
      const { date, startTime, endTime, reason } = req.body;
      const userId = req.user._id;
      const role = req.user.role;

      appointment = await Appointment.findById(id)
        .populate("studentId", "fullName email")
        .populate("counselorId", "fullName email")
        .session(session);

      if (!appointment)
        throw Object.assign(new Error("Appointment not found"), { statusCode: 404 });

      const isStudent   = role === "student"   && appointment.studentId._id.toString()  === userId.toString();
      const isCounselor = role === "counselor" && appointment.counselorId._id.toString() === userId.toString();
      if (!isStudent && !isCounselor)
        throw Object.assign(new Error("Not authorized"), { statusCode: 403 });

      if (!["pending", "accepted"].includes(appointment.status))
        throw Object.assign(new Error("This appointment cannot be rescheduled"), { statusCode: 400 });

      await freeUpSlot(
        appointment.counselorId._id,
        appointment.date,
        appointment.startTime,
        appointment.endTime,
        session,
      );

      const slotUpdate = await Availability.updateOne(
        mongoose.trusted({
          counselorId: appointment.counselorId._id,
          date: dateRange(date),
          availableSlots: mongoose.trusted({ $elemMatch: { startTime, endTime, isBooked: false } }),
        }),
        {
          $set: {
            "availableSlots.$.isBooked": true,
            "availableSlots.$.appointmentId": id,
          },
        },
        { session },
      );

      if (slotUpdate.matchedCount === 0)
        throw Object.assign(new Error("No availability found for the new date"), { statusCode: 400 });
      if (slotUpdate.modifiedCount === 0)
        throw Object.assign(new Error("That time slot was just booked. Please choose another."), { statusCode: 409 });

      appointment.previousDetails = {
        date: appointment.date,
        startTime: appointment.startTime,
        endTime: appointment.endTime,
        status: appointment.status,
        rescheduledBy: role,
        rescheduledAt: new Date(),
      };
      appointment.date = date;
      appointment.startTime = startTime;
      appointment.endTime = endTime;
      appointment.status = "rescheduled";
      appointment.rescheduleAcceptedByStudent = role === "counselor" ? null : true;
      if (reason) appointment.notes = reason;
      await appointment.save({ session });
    });

    const targetId = req.user.role === "student"
      ? appointment.counselorId._id
      : appointment.studentId._id;

    await createNotification(
      targetId,
      appointment._id,
      "appointment_rescheduled",
      `${req.user.fullName} rescheduled the appointment to ${new Date(appointment.date).toLocaleDateString()} at ${appointment.startTime}`,
    );

    logger.info(`Appointment ${appointment._id} rescheduled by ${req.user.role} ${req.user._id}`);
    res.json(appointment);
  } catch (error) {
    const status = error.statusCode || 500;
    logger.error("rescheduleAppointment error:", { error: error.message });
    res.status(status).json({ message: error.message || "Server error" });
  } finally {
    session.endSession();
  }
};

// ── Cancel Appointment ────────────────────────────────────────────────────────
export const cancelAppointment = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    let appointment;

    await session.withTransaction(async () => {
      const { id } = req.params;
      const { reason } = req.body;
      const userId = req.user._id;
      const role = req.user.role;

      appointment = await Appointment.findById(id)
        .populate("studentId", "fullName email")
        .populate("counselorId", "fullName email")
        .session(session);

      if (!appointment)
        throw Object.assign(new Error("Appointment not found"), { statusCode: 404 });

      const isStudent   = role === "student"   && appointment.studentId._id.toString()  === userId.toString();
      const isCounselor = role === "counselor" && appointment.counselorId._id.toString() === userId.toString();
      if (!isStudent && !isCounselor)
        throw Object.assign(new Error("Not authorized"), { statusCode: 403 });

      if (!["pending", "accepted", "rescheduled"].includes(appointment.status))
        throw Object.assign(new Error("This appointment cannot be cancelled"), { statusCode: 400 });

      appointment.status = "cancelled";
      appointment.cancellationReason = reason || "";
      appointment.cancelledBy = role;
      await appointment.save({ session });

      await freeUpSlot(
        appointment.counselorId._id,
        appointment.date,
        appointment.startTime,
        appointment.endTime,
        session,
      );
    });

    const targetId = req.user.role === "student"
      ? appointment.counselorId._id
      : appointment.studentId._id;

    await createNotification(
      targetId,
      appointment._id,
      "appointment_cancelled",
      `${req.user.fullName} cancelled the appointment on ${new Date(appointment.date).toLocaleDateString()}`,
    );

    logger.info(`Appointment ${appointment._id} cancelled by ${req.user.role} ${req.user._id}`);
    res.json({ message: "Appointment cancelled", appointment });
  } catch (error) {
    const status = error.statusCode || 500;
    logger.error("cancelAppointment error:", { error: error.message });
    res.status(status).json({ message: error.message || "Server error" });
  } finally {
    session.endSession();
  }
};

// ── Add Feedback ──────────────────────────────────────────────────────────────
export const addFeedback = async (req, res) => {
  try {
    const { id } = req.params;
    const { content, rating } = req.body;
    const studentId = req.user._id;

    const appointment = await Appointment.findById(id).populate("counselorId", "fullName email");

    if (!appointment) return res.status(404).json({ message: "Appointment not found" });
    if (appointment.studentId.toString() !== studentId.toString()) {
      return res.status(403).json({ message: "Not authorized" });
    }
    if (appointment.status !== "completed") {
      return res.status(400).json({ message: "Feedback can only be added to completed appointments" });
    }
    if (appointment.feedback?.content) {
      return res.status(400).json({ message: "Feedback already submitted" });
    }

    appointment.feedback = { content, rating, addedAt: new Date() };
    await appointment.save();

    await createNotification(
      appointment.counselorId._id,
      appointment._id,
      "appointment_feedback",
      `${req.user.fullName} left feedback for your session`,
    );

    res.json(appointment);
  } catch (error) {
    logger.error("addFeedback error:", { error: error.message });
    res.status(500).json({ message: "Server error" });
  }
};

// ── Delete Appointment ────────────────────────────────────────────────────────
// Students may delete only terminal appointments (cancelled/rejected/completed).
// The owning counselor may delete an appointment in ANY state — including active
// requests — in which case the reserved availability slot is freed and the
// student is notified.
export const deleteAppointment = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    let appt;            // snapshot used after the transaction
    let notifyStudent = false;

    await session.withTransaction(async () => {
      const { id } = req.params;
      const userId = req.user._id;
      const role = req.user.role;

      const appointment = await Appointment.findById(id).session(session);
      if (!appointment)
        throw Object.assign(new Error("Appointment not found"), { statusCode: 404 });

      const isStudentOwner =
        appointment.studentId && appointment.studentId.toString() === userId.toString();
      const isCounselorOwner =
        appointment.counselorId.toString() === userId.toString();
      if (!isStudentOwner && !isCounselorOwner)
        throw Object.assign(new Error("Not authorized"), { statusCode: 403 });

      const isActive = ["pending", "accepted", "rescheduled"].includes(appointment.status);

      // Students cannot delete an active appointment — they must cancel it first.
      if (role === "student" && isActive)
        throw Object.assign(
          new Error("Active appointments must be cancelled, not deleted"),
          { statusCode: 400 },
        );

      // Free the reserved slot when removing an active appointment.
      if (isActive) {
        await freeUpSlot(
          appointment.counselorId,
          appointment.date,
          appointment.startTime,
          appointment.endTime,
          session,
        );
      }

      // Detach any linked pre-assessment so it no longer points at a deleted appointment.
      await PreAssessment.updateMany(
        { appointmentId: appointment._id },
        { $unset: { appointmentId: "", authorizedCounselorId: "" } },
        { session },
      );

      await Appointment.deleteOne({ _id: appointment._id }, { session });

      appt = {
        _id:       appointment._id,
        studentId: appointment.studentId,
        date:      appointment.date,
      };
      // Let the student know if a counselor removed their still-active request.
      notifyStudent = isCounselorOwner && isActive && !!appointment.studentId;
    });

    if (notifyStudent) {
      await createNotification(
        appt.studentId,
        appt._id,
        "appointment_cancelled",
        `Your appointment request on ${new Date(appt.date).toLocaleDateString()} was removed by the counselor`,
      );
    }

    logger.info(`Appointment ${appt?._id} deleted by ${req.user.role} ${req.user._id}`);
    res.json({ message: "Appointment deleted" });
  } catch (error) {
    const status = error.statusCode || 500;
    logger.error("deleteAppointment error:", { error: error.message });
    res.status(status).json({ message: error.message || "Server error" });
  } finally {
    session.endSession();
  }
};