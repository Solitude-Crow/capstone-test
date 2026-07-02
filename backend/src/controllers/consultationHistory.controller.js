// controllers/consultationHistory.controller.js
import mongoose from "mongoose";
import Appointment from "../models/appointment.model.js";
import Referral from "../models/referral.model.js";
import User from "../models/user.model.js";
import logger from "../lib/logger.js";

// Escape user input before using it in a $regex (prevents regex injection / ReDoS)
const escapeRegex = (s = "") => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// ── Get full consultation history for a student (Counselor only) ──────────────
export const getStudentConsultationHistory = async (req, res) => {
  try {
    const { studentId } = req.params;
    const { startDate, endDate, category, status, page = 1, limit = 20 } = req.query;

    // Validate student exists
    const student = await User.findOne({ _id: studentId, role: "student" })
      .select("fullName email studentIDnum course yearLevel profilePic createdAt");
    if (!student) return res.status(404).json({ message: "Student not found" });

    // ── Build appointment query ──
    const apptQuery = { studentId };
    if (status)   apptQuery.status = status;
    if (category) apptQuery.type   = category;
    if (startDate || endDate) {
      // Wrap in mongoose.trusted() — db.js sets sanitizeFilter:true, which would
      // otherwise wrap the $gte/$lte object in $eq and break the query.
      const range = {};
      if (startDate) range.$gte = new Date(startDate);
      if (endDate)   range.$lte = new Date(new Date(endDate).setHours(23, 59, 59, 999));
      apptQuery.date = mongoose.trusted(range);
    }

    const skip = (Number(page) - 1) * Number(limit);

    const [appointments, totalAppts, referrals] = await Promise.all([
      Appointment.find(apptQuery)
        .populate("counselorId", "fullName email specialization")
        // Source metadata — referralId present ⇒ appointment came from a faculty referral
        .populate({
          path: "referralId",
          select: "facultyId priorityLevel status",
          populate: { path: "facultyId", select: "fullName department" },
        })
        .sort({ date: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      Appointment.countDocuments(apptQuery),
      Referral.find({ studentId })
        .populate("facultyId",   "fullName department")
        .populate("counselorId", "fullName")
        .sort({ createdAt: -1 })
        .lean(),
    ]);

    // ── Summary statistics ──
    const allAppts = await Appointment.find({ studentId }).lean();

    const concernFreq = allAppts.reduce((acc, a) => {
      acc[a.type] = (acc[a.type] || 0) + 1;
      return acc;
    }, {});
    const topConcerns = Object.entries(concernFreq)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([type, count]) => ({ type, count }));

    const completed  = allAppts.filter((a) => a.status === "completed");
    const lastAppt   = allAppts.sort((a, b) => new Date(b.date) - new Date(a.date))[0];

    const summary = {
      totalAppointments:  allAppts.length,
      completedSessions:  completed.length,
      pendingAppointments: allAppts.filter((a) => a.status === "pending").length,
      referralCount:      referrals.length,
      topConcerns,
      lastConsultationDate: lastAppt?.date || null,
      joinedDate:         student.createdAt,
    };

    res.json({
      student,
      appointments,
      referrals,
      summary,
      pagination: {
        total: totalAppts,
        page:  Number(page),
        limit: Number(limit),
        pages: Math.ceil(totalAppts / Number(limit)),
      },
    });
  } catch (error) {
    logger.error("getStudentConsultationHistory error:", { error: error.message });
    res.status(500).json({ message: "Server error" });
  }
};

// ── Get list of all students counselor has interacted with ────────────────────
export const getCounselorStudentList = async (req, res) => {
  try {
    const { search, page = 1, limit = 20 } = req.query;

    // Find all unique students this counselor has had appointments with
    const counselorAppointments = await Appointment.distinct("studentId", { counselorId: req.user._id });

    // mongoose.trusted() bypasses sanitizeFilter (set in db.js) for these operator
    // objects, which it would otherwise wrap in $eq and break.
    const query = {
      _id: mongoose.trusted({ $in: counselorAppointments }),
      role: "student",
      isActive: true,
    };
    if (search) {
      const safe = escapeRegex(search);
      query.$or = [
        { fullName:     mongoose.trusted({ $regex: safe, $options: "i" }) },
        { studentIDnum: mongoose.trusted({ $regex: safe, $options: "i" }) },
        { course:       mongoose.trusted({ $regex: safe, $options: "i" }) },
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);
    const [students, total] = await Promise.all([
      User.find(query)
        .select("_id fullName email studentIDnum course yearLevel profilePic createdAt")
        .sort({ fullName: 1 })
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      User.countDocuments(query),
    ]);

    // Attach last appointment date to each student for the list view
    const enriched = await Promise.all(
      students.map(async (s) => {
        const last = await Appointment.findOne({ studentId: s._id, counselorId: req.user._id })
          .sort({ date: -1 })
          .select("date status type")
          .lean();
        const count = await Appointment.countDocuments({ studentId: s._id, counselorId: req.user._id });
        return { ...s, lastAppointment: last, appointmentCount: count };
      })
    );

    res.json({
      students: enriched,
      pagination: { total, page: Number(page), limit: Number(limit), pages: Math.ceil(total / Number(limit)) },
    });
  } catch (error) {
    logger.error("getCounselorStudentList error:", { error: error.message });
    res.status(500).json({ message: "Server error" });
  }
};