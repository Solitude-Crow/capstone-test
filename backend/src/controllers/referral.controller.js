// controllers/referral.controller.js
import mongoose from "mongoose";
import Referral from "../models/referral.model.js";
import User from "../models/user.model.js";
import Notification from "../models/notification.model.js";
import Appointment from "../models/appointment.model.js";
import Availability from "../models/availability.model.js";
import { emitSocketEvent } from "../services/socket.js";
import logger from "../lib/logger.js";

const dateRange = (dateInput) => {
  const d = new Date(dateInput);
  const start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
  const end   = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59, 999));
  return mongoose.trusted({ $gte: start, $lte: end });
};

// ── Helper: create + emit a notification ─────────────────────────────────────
const notify = async ({ userId, type, message, referralId, appointmentId }) => {
  if (!userId) return; // skip if no linked user (unregistered student)
  try {
    const notif = await Notification.create({
      userId,
      type,
      message,
      ...(referralId    && { referralId }),
      ...(appointmentId && { appointmentId }),
    });
    emitSocketEvent(userId.toString(), "notification:new", notif);
  } catch (err) {
    logger.warn("notify() failed:", { error: err.message });
  }
};

// ── Helper: derive category from referral indicators ─────────────────────────
const INDICATOR_CATEGORY_MAP = {
  "Sudden Drop in Grades":                        "Academic",
  "Frequent Absences":                            "Academic",
  "Late Submission of Requirements":              "Academic",
  "Lack of Participation / Classroom Engagement": "Academic",
  "At Risk of Academic Failure / Probation":      "Academic",
  "Withdrawal / Social Isolation":                "Behavioral",
  "Aggressive or Disruptive Behavior":            "Behavioral",
  "Frequent Emotional Outbursts":                 "Behavioral",
  "Difficulty Following Rules or Instructions":   "Behavioral",
  "Difficulty Interacting with Peers or Teachers":"Behavioral",
  "Visible Signs of Stress or Anxiety":           "Personal/Emotional",
  "Persistent Sadness or Hopelessness":           "Personal/Emotional",
  "Emotional Instability / Mood Swings":          "Personal/Emotional",
  "Signs of Burnout or Exhaustion":               "Personal/Emotional",
  "Low Self-Confidence or Self-Esteem Issues":    "Personal/Emotional",
  "Expressed Difficulty Coping":                  "Personal/Emotional",
  "Family-Related Problems":                      "Family",
  "Financial Difficulties Affecting Studies":     "Financial",
  "Peer Conflicts or Bullying":                   "Social/Interpersonal",
  "Romantic or Relationship Issues":              "Social/Interpersonal",
  "Significant Life Changes / Loss":              "Personal/Emotional",
  "Risk of Self-Harm or Suicidal Ideation":       "Health/Wellness",
  "Concerning Statements About Well-being":       "Health/Wellness",
  "Sudden Behavioral or Physical Changes":        "Health/Wellness",
  "Other Welfare Concern":                        "Other",
};

const PRIORITY_URGENCY_MAP = { low: "low", moderate: "medium", high: "high", critical: "critical" };

function deriveCategory(indicators = []) {
  if (!indicators.length) return "Other";
  const counts = {};
  for (const ind of indicators) {
    const cat = INDICATOR_CATEGORY_MAP[ind] ?? "Other";
    counts[cat] = (counts[cat] || 0) + 1;
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
}

// ── Create Referral (Faculty) ─────────────────────────────────────────────────
export const createReferral = async (req, res) => {
  try {
    const {
      studentId,
      counselorId,
      isUnregisteredStudent = false,
      // Section A overrides (optional — default auto-populated from auth)
      facultySnapshotOverride,
      // Section B manual student data (for unregistered; also partial extras for registered)
      studentSnapshot: manualStudentSnapshot,
      // Section C
      referralIndicators = [],
      otherConcern,
      // Section D
      observationDetails,
      // Section E
      actionsTaken = [],
      otherAction,
      // Section F
      priorityLevel = "low",
      // Section G
      studentAwareness,
      // Optional
      preferredDate,
      // Backward-compat passthrough
      reason: legacyReason,
      remarks,
      category: legacyCategory,
    } = req.body;

    // ── Validate student ──────────────────────────────────────────────────────
    let student = null;
    if (!isUnregisteredStudent) {
      if (!studentId) {
        return res.status(400).json({ message: "studentId is required for registered students" });
      }
      student = await User.findOne({ _id: studentId, role: "student", isActive: true });
      if (!student) return res.status(404).json({ message: "Student not found" });
    } else {
      if (!manualStudentSnapshot?.fullName) {
        return res.status(400).json({ message: "studentSnapshot.fullName is required for unregistered students" });
      }
    }

    // ── Validate counselor if specified ──────────────────────────────────────
    if (counselorId) {
      const counselor = await User.findOne({ _id: counselorId, role: "counselor", isActive: true });
      if (!counselor) return res.status(404).json({ message: "Counselor not found" });
    }

    // ── Build faculty snapshot from authenticated user + optional overrides ───
    const overrides = facultySnapshotOverride || {};
    const facultySnapshot = {
      name:          overrides.name          ?? req.user.fullName,
      position:      overrides.position      ?? req.user.position      ?? "",
      department:    overrides.department    ?? req.user.department    ?? "",
      contactNumber: overrides.contactNumber ?? req.user.contactNumber ?? "",
      email:         overrides.email         ?? req.user.email,
      dateOfReferral: new Date(),
      modifications: [],
    };

    // Record any field that was manually changed from the auth record
    const authValues = {
      name:          req.user.fullName,
      position:      req.user.position      ?? "",
      department:    req.user.department    ?? "",
      contactNumber: req.user.contactNumber ?? "",
    };
    for (const field of Object.keys(authValues)) {
      if (overrides[field] !== undefined && overrides[field] !== authValues[field]) {
        facultySnapshot.modifications.push({
          field,
          originalValue: authValues[field] || "",
          modifiedValue: overrides[field],
          modifiedBy:    req.user._id,
          modifiedAt:    new Date(),
        });
      }
    }

    // ── Build student snapshot ────────────────────────────────────────────────
    const builtStudentSnapshot = student
      ? {
          fullName:     student.fullName,
          studentIDnum: student.studentIDnum ?? "",
          course:       student.course       ?? "",
          yearLevel:    student.yearLevel    ?? "",
          section:      manualStudentSnapshot?.section      ?? "",
          adviser:      manualStudentSnapshot?.adviser      ?? "",
          email:        student.email        ?? "",
          contactNumber:manualStudentSnapshot?.contactNumber ?? "",
        }
      : manualStudentSnapshot;

    // ── Derive backward-compat fields ─────────────────────────────────────────
    const urgency = PRIORITY_URGENCY_MAP[priorityLevel] ?? "low";
    const builtReason = legacyReason
      || (referralIndicators.length > 0 ? referralIndicators.join("; ") : "No specific indicators provided");
    const builtCategory = legacyCategory || deriveCategory(referralIndicators);

    // ── Create the referral ───────────────────────────────────────────────────
    const referral = await Referral.create({
      facultyId:            req.user._id,
      studentId:            isUnregisteredStudent ? null : studentId,
      counselorId:          counselorId || undefined,
      isUnregisteredStudent,
      facultySnapshot,
      studentSnapshot:      builtStudentSnapshot,
      referralIndicators,
      otherConcern,
      observationDetails,
      actionsTaken,
      otherAction,
      priorityLevel,
      studentAwareness,
      reason:    builtReason,
      urgency,
      remarks,
      preferredDate: preferredDate ? new Date(preferredDate) : undefined,
      category:  builtCategory,
      statusHistory: [{ status: "pending", changedBy: req.user._id, note: "Referral created" }],
    });

    const populated = await Referral.findById(referral._id)
      .populate("facultyId",  "fullName email department")
      .populate("studentId",  "fullName email studentIDnum course yearLevel")
      .populate("counselorId","fullName email");

    // ── Determine whom to notify ──────────────────────────────────────────────
    const isHighPriority = ["high", "critical"].includes(priorityLevel);

    // HIGH/CRITICAL always escalates to all counselors
    const counselorsToNotify = (counselorId && !isHighPriority)
      ? [{ _id: counselorId }]
      : await User.find({ role: "counselor", isActive: true }).select("_id");

    const notifType = isHighPriority ? "referral_high_priority" : "referral_created";
    const studentName = builtStudentSnapshot?.fullName ?? "an unregistered student";
    const priorityLabel = priorityLevel.toUpperCase();

    for (const c of counselorsToNotify) {
      await notify({
        userId:     c._id,
        type:       notifType,
        referralId: referral._id,
        message: isHighPriority
          ? `⚠️ ${priorityLabel} priority referral from ${req.user.fullName} for ${studentName}. Immediate attention required.`
          : `New referral from ${req.user.fullName} for ${studentName}.`,
      });
    }

    // Notify the referred student only if they have a system account
    if (!isUnregisteredStudent && studentId) {
      await notify({
        userId:     studentId,
        type:       "referral_received",
        referralId: referral._id,
        message:    `You have been referred for counseling by ${req.user.fullName}. A counselor will contact you shortly.`,
      });
    }

    logger.info(`Referral created by faculty ${req.user._id} for ${isUnregisteredStudent ? "unregistered student" : studentId}`);
    res.status(201).json(populated);
  } catch (error) {
    logger.error("createReferral error:", { error: error.message });
    res.status(500).json({ message: "Server error" });
  }
};

// ── Get Referrals (role-aware) ────────────────────────────────────────────────
export const getReferrals = async (req, res) => {
  try {
    const { status, urgency, priorityLevel, page = 1, limit = 20 } = req.query;
    const { role, _id: userId } = req.user;

    const query = {};
    if (role === "faculty")  query.facultyId  = userId;
    if (role === "student")  query.studentId  = userId;
    // counselors see all referrals

    if (status)        query.status        = status;
    if (urgency)       query.urgency       = urgency;
    if (priorityLevel) query.priorityLevel = priorityLevel;

    const skip = (Number(page) - 1) * Number(limit);
    const [referrals, total] = await Promise.all([
      Referral.find(query)
        .populate("facultyId",    "fullName email department")
        .populate("studentId",    "fullName email studentIDnum course yearLevel profilePic")
        .populate("counselorId",  "fullName email")
        .populate("appointmentId","date startTime endTime status type")
        .sort({ priorityLevel: -1, createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      Referral.countDocuments(query),
    ]);

    res.json({
      referrals,
      pagination: { total, page: Number(page), limit: Number(limit), pages: Math.ceil(total / Number(limit)) },
    });
  } catch (error) {
    logger.error("getReferrals error:", { error: error.message });
    res.status(500).json({ message: "Server error" });
  }
};

// ── Get all referrals (Counselor — unfiltered by counselorId) ─────────────────
export const getAllReferrals = async (req, res) => {
  try {
    const { status, urgency, priorityLevel, page = 1, limit = 20, studentId } = req.query;
    const query = {};
    if (status)        query.status        = status;
    if (urgency)       query.urgency       = urgency;
    if (priorityLevel) query.priorityLevel = priorityLevel;
    if (studentId)     query.studentId     = studentId;

    const skip = (Number(page) - 1) * Number(limit);
    const [referrals, total] = await Promise.all([
      Referral.find(query)
        .populate("facultyId",    "fullName email department")
        .populate("studentId",    "fullName email studentIDnum course yearLevel profilePic")
        .populate("counselorId",  "fullName email")
        .populate("appointmentId","date startTime endTime status type")
        .sort({ priorityLevel: -1, createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      Referral.countDocuments(query),
    ]);

    res.json({
      referrals,
      pagination: { total, page: Number(page), limit: Number(limit), pages: Math.ceil(total / Number(limit)) },
    });
  } catch (error) {
    logger.error("getAllReferrals error:", { error: error.message });
    res.status(500).json({ message: "Server error" });
  }
};

// ── Get Referral by ID ────────────────────────────────────────────────────────
export const getReferralById = async (req, res) => {
  try {
    const referral = await Referral.findById(req.params.id)
      .populate("facultyId",   "fullName email department")
      .populate("studentId",   "fullName email studentIDnum course yearLevel profilePic")
      .populate("counselorId", "fullName email presenceStatus")
      .populate("appointmentId", "date startTime endTime status type counselorNotes")
      .populate("statusHistory.changedBy", "fullName role");

    if (!referral) return res.status(404).json({ message: "Referral not found" });

    const uid  = req.user._id.toString();
    const role = req.user.role;
    const isParty =
      referral.facultyId?._id.toString() === uid ||
      (referral.studentId && referral.studentId._id?.toString() === uid) ||
      referral.counselorId?._id?.toString() === uid;

    if (role !== "counselor" && !isParty) {
      return res.status(403).json({ message: "Access denied" });
    }

    res.json(referral);
  } catch (error) {
    logger.error("getReferralById error:", { error: error.message });
    res.status(500).json({ message: "Server error" });
  }
};

// ── Update Referral Status (Counselor) ───────────────────────────────────────
export const updateReferralStatus = async (req, res) => {
  try {
    const { status, counselorNotes, rejectionReason } = req.body;
    const validTransitions = ["under_review", "accepted", "rejected", "scheduled", "completed"];
    if (!validTransitions.includes(status)) {
      return res.status(400).json({ message: "Invalid status transition" });
    }

    const referral = await Referral.findById(req.params.id);
    if (!referral) return res.status(404).json({ message: "Referral not found" });

    const prevStatus = referral.status;
    referral.status     = status;
    referral.counselorId = req.user._id;
    if (counselorNotes)  referral.counselorNotes  = counselorNotes;
    if (rejectionReason) referral.rejectionReason = rejectionReason;

    if (status === "under_review") {
      referral.reviewedAt = new Date();
      referral.reviewedBy = req.user._id;
    }

    referral.statusHistory.push({
      status,
      changedBy: req.user._id,
      changedAt: new Date(),
      note: counselorNotes || rejectionReason || `Status changed to ${status}`,
    });

    await referral.save();

    const populated = await Referral.findById(referral._id)
      .populate("facultyId",  "fullName email")
      .populate("studentId",  "fullName email")
      .populate("counselorId","fullName email");

    // ── Notifications ─────────────────────────────────────────────────────────
    const facultyMessages = {
      under_review: "Your referral is now under review by a counselor.",
      accepted:     "Your referral has been accepted by a counselor.",
      rejected:     `Your referral was declined. ${rejectionReason || ""}`,
      scheduled:    "The referred student's appointment has been scheduled.",
      completed:    "The counseling session for your referral has been completed.",
    };
    const studentMessages = {
      under_review: "Your counseling referral is currently being reviewed.",
      accepted:     "Your counseling referral has been accepted. A counselor will reach out.",
      rejected:     "Your counseling referral was not accepted at this time.",
      scheduled:    "Your counseling appointment from a referral has been scheduled.",
      completed:    "Your referred counseling session is now marked as completed.",
    };

    const notifType = status === "under_review" ? "referral_under_review" : `referral_${status}`;

    await notify({
      userId:     referral.facultyId,
      type:       notifType,
      referralId: referral._id,
      message:    facultyMessages[status],
    });

    // Only notify student if they have a system account
    if (!referral.isUnregisteredStudent && referral.studentId) {
      await notify({
        userId:     referral.studentId,
        type:       notifType,
        referralId: referral._id,
        message:    studentMessages[status],
      });
    }

    logger.info(`Referral ${referral._id} updated: ${prevStatus} → ${status} by counselor ${req.user._id}`);
    res.json(populated);
  } catch (error) {
    logger.error("updateReferralStatus error:", { error: error.message });
    res.status(500).json({ message: "Server error" });
  }
};

// ── Convert Referral → Appointment (Counselor) ───────────────────────────────
export const convertReferralToAppointment = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    const { date, startTime, endTime, type, notes, counselorNotes } = req.body;
    let appointment;
    let referralDoc;

    await session.withTransaction(async () => {
      referralDoc = await Referral.findById(req.params.id)
        .populate("studentId", "fullName email")
        .session(session);

      if (!referralDoc) throw Object.assign(new Error("Referral not found"), { statusCode: 404 });
      if (referralDoc.appointmentId) throw Object.assign(new Error("Referral already has an appointment"), { statusCode: 400 });

      const studentId = referralDoc.isUnregisteredStudent ? null : (referralDoc.studentId?._id ?? null);

      // Book the slot in the counselor's availability
      const slotUpdate = await Availability.updateOne(
        mongoose.trusted({
          counselorId: req.user._id,
          date: dateRange(date),
          availableSlots: mongoose.trusted({ $elemMatch: { startTime, endTime, isBooked: false } }),
        }),
        { $set: { "availableSlots.$.isBooked": true } },
        { session },
      );

      if (slotUpdate.matchedCount === 0) {
        throw Object.assign(
          new Error("No matching availability slot found. Please add this time slot to your schedule first."),
          { statusCode: 400 },
        );
      }
      if (slotUpdate.modifiedCount === 0) {
        throw Object.assign(new Error("This time slot is already booked."), { statusCode: 409 });
      }

      [appointment] = await Appointment.create(
        [{
          studentId,
          counselorId: req.user._id,
          type:        type || "General Inquiry",
          date:        new Date(date),
          startTime,
          endTime,
          notes:       notes || referralDoc.observationDetails || referralDoc.reason,
          counselorNotes: counselorNotes || undefined,
          referralId:  referralDoc._id,
        }],
        { session },
      );

      await Availability.updateOne(
        mongoose.trusted({
          counselorId: req.user._id,
          date: dateRange(date),
          "availableSlots.startTime": startTime,
          "availableSlots.endTime":   endTime,
        }),
        { $set: { "availableSlots.$.appointmentId": appointment._id } },
        { session },
      );

      referralDoc.appointmentId = appointment._id;
      referralDoc.status        = "scheduled";
      referralDoc.counselorId   = req.user._id;
      if (counselorNotes) referralDoc.counselorNotes = counselorNotes;
      referralDoc.statusHistory.push({
        status:    "scheduled",
        changedBy: req.user._id,
        changedAt: new Date(),
        note:      counselorNotes || "Scheduled by counselor",
      });
      await referralDoc.save({ session });
    });

    const dateStr = new Date(date).toLocaleDateString("en-PH", { month: "long", day: "numeric", year: "numeric" });
    const studentName = referralDoc.studentSnapshot?.fullName ?? referralDoc.studentId?.fullName ?? "the student";

    // Notify student
    if (!referralDoc.isUnregisteredStudent && referralDoc.studentId) {
      await notify({
        userId:        referralDoc.studentId._id,
        type:          "referral_scheduled",
        referralId:    referralDoc._id,
        appointmentId: appointment._id,
        message:       `Your referral appointment has been scheduled on ${dateStr} with ${req.user.fullName}.`,
      });
    }

    // Notify referring faculty
    await notify({
      userId:        referralDoc.facultyId,
      type:          "referral_scheduled",
      referralId:    referralDoc._id,
      appointmentId: appointment._id,
      message:       `The appointment for ${studentName} from your referral has been scheduled on ${dateStr} at ${startTime}.`,
    });

    logger.info(`Referral ${referralDoc._id} converted to appointment ${appointment._id} by counselor ${req.user._id}`);
    res.status(201).json({ referral: referralDoc, appointment });
  } catch (error) {
    const status = error.statusCode || 500;
    logger.error("convertReferralToAppointment error:", { error: error.message });
    res.status(status).json({ message: error.message || "Server error" });
  } finally {
    session.endSession();
  }
};

// ── Get Counselor Schedules (all authenticated — for faculty appointment picker) ─
export const getCounselorSchedules = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const counselors = await User.find({ role: "counselor", isActive: true })
      .select("_id fullName specialization presenceStatus presenceNote profilePic")
      .lean();

    const start = startDate ? new Date(startDate) : new Date();
    start.setUTCHours(0, 0, 0, 0);
    const end = endDate
      ? new Date(endDate)
      : new Date(start.getTime() + 30 * 24 * 60 * 60 * 1000);
    end.setUTCHours(23, 59, 59, 999);

    const counselorIds = counselors.map((c) => c._id);

    // Each sub-object containing $ operators needs its own mongoose.trusted() call
    const availabilities = counselorIds.length === 0 ? [] : await Availability.find({
      counselorId: mongoose.trusted({ $in: counselorIds }),
      date:        mongoose.trusted({ $gte: start, $lte: end }),
      isHoliday:   false,
    }).lean();

    const availMap = {};
    for (const avail of availabilities) {
      const key = avail.counselorId.toString();
      if (!availMap[key]) availMap[key] = [];
      availMap[key].push(avail);
    }

    const result = counselors.map((c) => ({
      counselor:    c,
      availability: availMap[c._id.toString()] || [],
    }));

    res.json(result);
  } catch (error) {
    logger.error("getCounselorSchedules error:", { error: error.message });
    res.status(500).json({ message: "Server error" });
  }
};

// ── Request Appointment From Referral (Faculty) ───────────────────────────────
export const requestAppointmentFromReferral = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    const { counselorId, date, startTime, endTime, type } = req.body;
    const referralId = req.params.id;
    let appointment;
    let referral;

    // Pre-transaction checks (no writes)
    const counselor = await User.findOne({ _id: counselorId, role: "counselor", isActive: true })
      .select("fullName presenceStatus")
      .lean();
    if (!counselor) {
      return res.status(404).json({ message: "Counselor not found" });
    }
    if (counselor.presenceStatus === "on_leave") {
      return res.status(400).json({
        message: "The selected counselor is currently on leave. Please choose another available schedule.",
      });
    }

    await session.withTransaction(async () => {
      referral = await Referral.findById(referralId).session(session);
      if (!referral) throw Object.assign(new Error("Referral not found"), { statusCode: 404 });
      if (referral.facultyId.toString() !== req.user._id.toString()) {
        throw Object.assign(new Error("Access denied"), { statusCode: 403 });
      }
      if (referral.appointmentId) {
        throw Object.assign(new Error("This referral already has a linked appointment"), { statusCode: 400 });
      }
      if (["rejected", "completed"].includes(referral.status)) {
        throw Object.assign(
          new Error("An appointment cannot be requested for a rejected or completed referral"),
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
          new Error("The selected counselor is currently unavailable. Please choose another available schedule."),
          { statusCode: 400 },
        );
      }
      if (slotUpdate.modifiedCount === 0) {
        throw Object.assign(
          new Error("This time slot was just booked. Please choose another."),
          { statusCode: 409 },
        );
      }

      const studentId = referral.isUnregisteredStudent ? null : (referral.studentId ?? null);
      [appointment] = await Appointment.create(
        [{
          studentId,
          counselorId,
          type:       type || "General Inquiry",
          date:       new Date(date),
          startTime,
          endTime,
          referralId: referral._id,
          notes:      referral.reason || referral.observationDetails,
        }],
        { session },
      );

      await Availability.updateOne(
        mongoose.trusted({
          counselorId,
          date: dateRange(date),
          "availableSlots.startTime": startTime,
          "availableSlots.endTime":   endTime,
        }),
        { $set: { "availableSlots.$.appointmentId": appointment._id } },
        { session },
      );

      referral.appointmentId = appointment._id;
      referral.counselorId   = counselorId;
      referral.statusHistory.push({
        status:    referral.status,
        changedBy: req.user._id,
        changedAt: new Date(),
        note:      "Appointment requested by faculty",
      });
      await referral.save({ session });
    });

    const dateStr = new Date(date).toLocaleDateString("en-PH", { month: "long", day: "numeric", year: "numeric" });
    const studentName = referral.studentSnapshot?.fullName ?? "the student";

    // Notify counselor
    await notify({
      userId:        counselorId,
      type:          "referral_appointment_requested",
      referralId:    referral._id,
      appointmentId: appointment._id,
      message:       `${req.user.fullName} has requested an appointment for ${studentName} on ${dateStr} at ${startTime}.`,
    });

    // Notify student if registered
    if (!referral.isUnregisteredStudent && referral.studentId) {
      await notify({
        userId:        referral.studentId,
        type:          "referral_appointment_requested",
        referralId:    referral._id,
        appointmentId: appointment._id,
        message:       `A counseling appointment has been requested for you on ${dateStr}. Awaiting counselor confirmation.`,
      });
    }

    logger.info(`Appointment requested by faculty ${req.user._id} for referral ${referralId}`);
    res.status(201).json({ referral, appointment });
  } catch (error) {
    const status = error.statusCode || 500;
    logger.error("requestAppointmentFromReferral error:", { error: error.message });
    res.status(status).json({ message: error.message || "Server error" });
  } finally {
    session.endSession();
  }
};

// ── Referral Analytics (Counselor) ───────────────────────────────────────────
export const getReferralAnalytics = async (req, res) => {
  try {
    const [byStatus, byUrgency, byPriority, byCategory, recent] = await Promise.all([
      Referral.aggregate([{ $group: { _id: "$status",        count: { $sum: 1 } } }]),
      Referral.aggregate([{ $group: { _id: "$urgency",       count: { $sum: 1 } } }]),
      Referral.aggregate([{ $group: { _id: "$priorityLevel", count: { $sum: 1 } } }]),
      Referral.aggregate([{ $group: { _id: "$category",      count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
      Referral.find({
        status:        mongoose.trusted({ $in: ["pending", "under_review", "accepted"] }),
        priorityLevel: mongoose.trusted({ $in: ["high", "critical"] }),
      })
        .populate("studentId", "fullName course yearLevel")
        .populate("facultyId", "fullName department")
        .sort({ priorityLevel: -1, createdAt: -1 })
        .limit(5)
        .lean(),
    ]);

    res.json({ byStatus, byUrgency, byPriority, byCategory, recentUrgent: recent });
  } catch (error) {
    logger.error("getReferralAnalytics error:", { error: error.message });
    res.status(500).json({ message: "Server error" });
  }
};

// ── Delete Referral (Faculty — completed or rejected only) ────────────────────
export const deleteReferral = async (req, res) => {
  try {
    const referral = await Referral.findById(req.params.id);
    if (!referral) return res.status(404).json({ message: "Referral not found" });

    if (referral.facultyId.toString() !== req.user._id.toString())
      return res.status(403).json({ message: "Not authorized" });

    if (!["completed", "rejected"].includes(referral.status))
      return res.status(400).json({ message: "Only completed or rejected referrals can be deleted" });

    await Referral.findByIdAndDelete(req.params.id);
    res.json({ message: "Referral deleted" });
  } catch (err) {
    logger.error("deleteReferral error:", { error: err.message });
    res.status(500).json({ message: "Server error" });
  }
};
