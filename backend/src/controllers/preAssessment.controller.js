import mongoose from "mongoose";
import PreAssessment from "../models/preAssessment.model.js";
import Appointment from "../models/appointment.model.js";
import Notification from "../models/notification.model.js";
import User from "../models/user.model.js";
import { emitNotificationEvent } from "../services/socket.js";
import { sendPreAssessmentSubmitted } from "../services/email.js";
import { generateSummaries } from "../services/ai.js";
import { analyzeAssessment } from "../services/assessmentAnalyzer.js";
import { generateRecommendations } from "../services/recommendationEngine.js";
import logger from "../lib/logger.js";

// ── Map purposeOfVisit array → legacy primaryConcern (for backward compat) ───
const PURPOSE_TO_PRIMARY = {
  "Academic Concerns":            "Academic",
  "Career Planning":              "Career",
  "Family Concerns":              "Family",
  "Relationship Concerns":        "Social/Interpersonal",
  "Emotional or Mental Well-being": "Personal/Emotional",
  "Stress Management":            "Personal/Emotional",
  "Behavioral Concerns":          "Personal/Emotional",
  "Personal Concerns":            "Personal/Emotional",
  "Financial Concerns":           "Financial",
  "Scholarship Concerns":         "Financial",
  "Adjustment to College Life":   "Personal/Emotional",
  "Others":                       "Other",
};

function derivePrimaryConcern(purposeOfVisit = [], providedPrimary) {
  if (providedPrimary) return providedPrimary;
  for (const p of purposeOfVisit) {
    const mapped = PURPOSE_TO_PRIMARY[p];
    if (mapped) return mapped;
  }
  return "Other";
}

// ── Submit Pre-Assessment ─────────────────────────────────────────────────────
export const submitPreAssessment = async (req, res) => {
  try {
    const studentId = req.user._id;
    const {
      // Section A — student info collected in the form
      studentInfo,
      // New MKD fields
      purposeOfVisit,
      purposeOfVisitOther,
      likertResponses,
      concernCategories,
      concernCategoryOther,
      concernDescription,
      concernDuration,
      expectedAssistance,
      urgencyLevel,
      consentGiven,
      // Legacy fields (kept for backward compat)
      primaryConcern: providedPrimary,
      responses,
    } = req.body;

    const isNewFormat = Array.isArray(likertResponses) && likertResponses.length > 0;

    // Consent is required for the MKD form (Section G). Enforce server-side so
    // the requirement holds even if a client bypasses the UI gate.
    if (isNewFormat && consentGiven !== true) {
      return res.status(400).json({
        message: "Consent must be given before submitting the pre-assessment.",
      });
    }

    // Derive legacy primaryConcern
    const primaryConcern = derivePrimaryConcern(purposeOfVisit, providedPrimary);

    // Build student snapshot: identity fields come from the profile; Section A
    // fields (section/age/gender/contactNumber) are collected in the form since
    // they are not stored on the User model.
    const rawAge = studentInfo?.age;
    const parsedAge =
      rawAge != null && rawAge !== "" && Number.isFinite(Number(rawAge))
        ? Number(rawAge)
        : undefined;

    const studentSnapshot = {
      studentIDnum:  req.user.studentIDnum,
      course:        req.user.course,
      yearLevel:     req.user.yearLevel,
      email:         req.user.email,
      section:       studentInfo?.section?.trim()       || "",
      age:           parsedAge,
      gender:        studentInfo?.gender                 || "",
      contactNumber: studentInfo?.contactNumber?.trim()  || "",
    };

    const preAssessment = await PreAssessment.create({
      studentId,
      studentSnapshot,
      purposeOfVisit:       purposeOfVisit       || [],
      purposeOfVisitOther:  purposeOfVisitOther  || "",
      likertResponses:      likertResponses       || [],
      concernCategories:    concernCategories     || [],
      concernCategoryOther: concernCategoryOther  || "",
      concernDescription:   concernDescription    || "",
      concernDuration:      concernDuration       || "",
      expectedAssistance:   expectedAssistance    || "",
      primaryConcern,
      urgencyLevel:         urgencyLevel          || "Low",
      consentGiven:         consentGiven          || false,
      responses:            responses             || [],
    });

    let assessmentResults = null;

    if (isNewFormat) {
      // ── NEW PIPELINE: Rule-based engine (primary) + Gemini summaries (optional) ──

      // Step 1: Analyze Likert responses
      const analysis = analyzeAssessment({
        likertResponses:    likertResponses || [],
        purposeOfVisit:     purposeOfVisit || [],
        concernCategories:  concernCategories || [],
        urgencyLevel,
      });

      // Step 2: Get counselor-approved recommendations from rules/knowledge base
      const engineResult = await generateRecommendations({
        detectedCategory: analysis.detectedCategory,
        riskLevel:        analysis.riskLevel,
        purposeOfVisit:   purposeOfVisit || [],
      });

      // Step 3: Try Gemini for human-readable summaries ONLY (non-blocking, optional)
      let summaries = null;
      try {
        summaries = await generateSummaries({
          detectedCategory:  analysis.detectedCategory,
          riskLevel:         analysis.riskLevel,
          riskFactors:       analysis.riskFactors,
          selectedResources: engineResult.suggestedResources,
        });
      } catch (geminiErr) {
        logger.warn("Gemini summary generation failed (non-fatal):", geminiErr.message);
      }

      assessmentResults = {
        detectedCategory:          analysis.detectedCategory,
        riskLevel:                 analysis.riskLevel,
        riskFactors:               analysis.riskFactors,
        scoreBreakdown:            analysis.scoreBreakdown,
        suggestedResources:        engineResult.suggestedResources,
        suggestedNextAction:       engineResult.suggestedNextAction,
        counselorPreparationNotes: engineResult.counselorPreparationNotes,
        studentSummary:            summaries?.studentSummary   || "",
        counselorSummary:          summaries?.counselorSummary || "",
        geminiUsed:                summaries !== null,
        analyzedAt:                new Date(),
      };

      await PreAssessment.findByIdAndUpdate(preAssessment._id, { assessmentResults });

      logger.info(
        `Pre-assessment ${preAssessment._id} analyzed: category=${analysis.detectedCategory}, risk=${analysis.riskLevel}, gemini=${summaries !== null}`
      );
    }

    logger.info(`Pre-assessment submitted by student ${studentId}`);

    // The submitter is always the student — strip counselor-only fields from the
    // response so they are never sent to the student's browser (the GET endpoints
    // strip these too).
    let studentSafeResults = null;
    if (assessmentResults) {
      const { counselorPreparationNotes, counselorSummary, ...safe } = assessmentResults;
      studentSafeResults = safe;
    }

    res.status(201).json({
      message: "Pre-assessment submitted successfully",
      preAssessmentId: preAssessment._id,
      assessmentResults: studentSafeResults,
      // Legacy field — null for new submissions; kept so old result pages don't crash
      aiRecommendations: null,
    });
  } catch (error) {
    logger.error("submitPreAssessment error:", { error: error.message });
    res.status(500).json({ message: "Server error" });
  }
};

// ── Link Pre-Assessment to Appointment ───────────────────────────────────────
export const linkToAppointment = async (req, res) => {
  try {
    const { id } = req.params;
    const { appointmentId } = req.body;
    const studentId = req.user._id;

    const preAssessment = await PreAssessment.findById(id);
    if (!preAssessment)
      return res.status(404).json({ message: "Pre-assessment not found" });
    if (preAssessment.studentId.toString() !== studentId.toString())
      return res.status(403).json({ message: "Not authorized" });
    if (preAssessment.appointmentId)
      return res.status(400).json({ message: "Pre-assessment already linked to an appointment" });

    const appointment = await Appointment.findById(appointmentId).populate(
      "counselorId", "fullName email"
    );
    if (!appointment)
      return res.status(404).json({ message: "Appointment not found" });
    if (appointment.studentId.toString() !== studentId.toString())
      return res.status(403).json({ message: "Not authorized for this appointment" });

    preAssessment.appointmentId         = appointmentId;
    preAssessment.authorizedCounselorId = appointment.counselorId._id;
    await preAssessment.save();

    appointment.preAssessmentId        = preAssessment._id;
    appointment.preAssessmentSubmitted = true;
    await appointment.save();

    const isUrgent =
      preAssessment.assessmentResults?.riskLevel === "Critical" ||
      preAssessment.assessmentResults?.riskLevel === "High" ||
      preAssessment.urgencyLevel === "Immediate" ||
      preAssessment.urgencyLevel === "Crisis" ||
      preAssessment.urgencyLevel === "High" ||
      preAssessment.aiRecommendations?.urgencyFlag;

    const notif = await Notification.create({
      userId:        appointment.counselorId._id,
      appointmentId: appointment._id,
      type:          "pre_assessment_submitted",
      message:       `${req.user.fullName} linked a pre-assessment to their appointment on ${new Date(appointment.date).toLocaleDateString()}`,
    });

    emitNotificationEvent(appointment.counselorId._id.toString(), "pre_assessment_submitted", {
      notificationId:  notif._id,
      message:         notif.message,
      appointmentId:   appointment._id,
      preAssessmentId: preAssessment._id,
      urgencyFlag:     isUrgent,
    });

    sendPreAssessmentSubmitted({
      to:             appointment.counselorId.email,
      counselorName:  appointment.counselorId.fullName,
      studentName:    req.user.fullName,
      appointmentDate: appointment.date,
    }).catch((err) =>
      logger.error("Pre-assessment notification email failed:", { error: err.message })
    );

    res.json({ message: "Pre-assessment linked to appointment", preAssessment });
  } catch (error) {
    logger.error("linkToAppointment error:", { error: error.message });
    res.status(500).json({ message: "Server error" });
  }
};

// ── Get Student's Own Pre-Assessments ────────────────────────────────────────
// Escape user input before embedding it in a RegExp
const escapeRegex = (str = "") => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const getMyPreAssessments = async (req, res) => {
  try {
    const studentId = req.user._id;
    const { page = 1, limit = 10, sort = "newest", search } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const query = { studentId };
    if (search) {
      const rx = new RegExp(escapeRegex(search), "i");
      query.$or = [
        { "assessmentResults.detectedCategory": rx },
        { primaryConcern: rx },
        { concernDescription: rx },
      ];
    }
    const sortSpec = sort === "oldest" ? { createdAt: 1 } : { createdAt: -1 };

    const [assessments, total] = await Promise.all([
      PreAssessment.find(query)
        // Strip counselor-only fields — students must not receive these in their list.
        .select(
          "-aiRecommendations.rawResponse -aiRecommendations.counselorTips " +
          "-assessmentResults.counselorPreparationNotes -assessmentResults.counselorSummary " +
          "-accessLog"
        )
        .populate("appointmentId", "type date startTime endTime status")
        .sort(sortSpec)
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      PreAssessment.countDocuments(query),
    ]);

    res.json({
      assessments,
      pagination: {
        total,
        page:  parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    logger.error("getMyPreAssessments error:", { error: error.message });
    res.status(500).json({ message: "Server error" });
  }
};

// ── Get Pre-Assessment by ID ──────────────────────────────────────────────────
export const getPreAssessment = async (req, res) => {
  try {
    const { id } = req.params;
    const userId  = req.user._id;
    const role    = req.user.role;

    const preAssessment = await PreAssessment.findById(id)
      .populate("studentId", "fullName email studentIDnum course yearLevel section profilePic")
      .populate("appointmentId", "type date startTime endTime status");

    if (!preAssessment)
      return res.status(404).json({ message: "Pre-assessment not found" });

    if (role === "student" && preAssessment.studentId._id.toString() !== userId.toString())
      return res.status(403).json({ message: "Access denied" });

    if (role === "counselor") {
      // Authorized either by an explicit appointment link, or by having any
      // appointment with this student (so submitted results reach the counselor).
      const isAuthorized =
        preAssessment.authorizedCounselorId?.toString() === userId.toString();
      const hasAppointment = isAuthorized
        ? true
        : await Appointment.exists({ counselorId: userId, studentId: preAssessment.studentId._id });
      if (!isAuthorized && !hasAppointment)
        return res.status(403).json({ message: "Access denied – not authorized for this pre-assessment" });
    }

    preAssessment.accessLog.push({ accessedBy: userId, accessedAt: new Date(), action: "viewed" });

    // Mark as reviewed the first time a counselor opens it.
    if (role === "counselor" && preAssessment.status === "submitted") {
      preAssessment.status     = "reviewed";
      preAssessment.reviewedAt = new Date();
      preAssessment.reviewedBy = userId;
    }

    await preAssessment.save();

    if (role === "student") {
      const obj = preAssessment.toObject();
      const { accessLog, ...rest } = obj;
      // Strip counselor-only fields from assessmentResults
      if (rest.assessmentResults) {
        const { counselorPreparationNotes, counselorSummary, ...studentResults } = rest.assessmentResults;
        rest.assessmentResults = studentResults;
      }
      // Strip counselor-only fields from legacy aiRecommendations
      if (rest.aiRecommendations) {
        const { counselorTips, rawResponse, interventions, ...studentAI } = rest.aiRecommendations;
        rest.aiRecommendations = studentAI;
      }
      return res.json(rest);
    }

    res.json(preAssessment);
  } catch (error) {
    logger.error("getPreAssessment error:", { error: error.message });
    res.status(500).json({ message: "Server error" });
  }
};

// ── Get Pre-Assessment by Appointment ID ─────────────────────────────────────
export const getPreAssessmentByAppointment = async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const userId = req.user._id;
    const role   = req.user.role;

    const preAssessment = await PreAssessment.findOne({ appointmentId }).populate(
      "studentId", "fullName email studentIDnum course yearLevel section profilePic"
    );

    if (!preAssessment)
      return res.status(404).json({ message: "No pre-assessment found for this appointment" });

    if (role === "student" && preAssessment.studentId._id.toString() !== userId.toString())
      return res.status(403).json({ message: "Access denied" });

    if (
      role === "counselor" &&
      preAssessment.authorizedCounselorId?.toString() !== userId.toString()
    )
      return res.status(403).json({ message: "Access denied" });

    preAssessment.accessLog.push({ accessedBy: userId, accessedAt: new Date(), action: "viewed" });

    if (role === "counselor" && preAssessment.status === "submitted") {
      preAssessment.status    = "reviewed";
      preAssessment.reviewedAt = new Date();
      preAssessment.reviewedBy = userId;
    }

    await preAssessment.save();

    if (role === "student") {
      const obj = preAssessment.toObject();
      const { accessLog, ...rest } = obj;
      if (rest.assessmentResults) {
        const { counselorPreparationNotes, counselorSummary, ...studentResults } = rest.assessmentResults;
        rest.assessmentResults = studentResults;
      }
      if (rest.aiRecommendations) {
        const { counselorTips, rawResponse, interventions, ...studentAI } = rest.aiRecommendations;
        rest.aiRecommendations = studentAI;
      }
      return res.json(rest);
    }

    res.json(preAssessment);
  } catch (error) {
    logger.error("getPreAssessmentByAppointment error:", { error: error.message });
    res.status(500).json({ message: "Server error" });
  }
};

// ── Get All Pre-Assessments for Counselor ────────────────────────────────────
export const getCounselorPreAssessments = async (req, res) => {
  try {
    const counselorId = req.user._id;
    const {
      status, page = 1, limit = 10, sort = "newest",
      search, course, yearLevel, riskLevel, category, startDate, endDate,
    } = req.query;

    // A counselor sees pre-assessments explicitly linked to them, plus those from
    // any student they have an appointment with — so submitted results reach the
    // counselor even if the student never linked them during booking.
    const apptStudentIds = (await Appointment.distinct("studentId", { counselorId })).filter(Boolean);

    const conditions = [{
      $or: [
        { authorizedCounselorId: counselorId },
        { studentId: mongoose.trusted({ $in: apptStudentIds }) },
      ],
    }];
    if (status)    conditions.push({ status });
    if (riskLevel) conditions.push({ "assessmentResults.riskLevel": riskLevel });
    if (category) {
      const rx = new RegExp(escapeRegex(category), "i");
      conditions.push({ $or: [{ "assessmentResults.detectedCategory": rx }, { primaryConcern: rx }] });
    }
    if (startDate || endDate) {
      const range = {};
      if (startDate) range.$gte = new Date(startDate);
      if (endDate)   range.$lte = new Date(new Date(endDate).setHours(23, 59, 59, 999));
      conditions.push({ createdAt: mongoose.trusted(range) });
    }
    // Student-attribute filters (name/ID search, course, year level) resolve to
    // a set of matching student ids first, then constrain the main query.
    if (search || course || yearLevel) {
      const userQuery = { role: "student" };
      if (search) {
        const rx = new RegExp(escapeRegex(search), "i");
        userQuery.$or = [{ fullName: rx }, { studentIDnum: rx }];
      }
      if (course)    userQuery.course    = course;
      if (yearLevel) userQuery.yearLevel = yearLevel;
      const matchingIds = await User.find(userQuery).distinct("_id");
      conditions.push({ studentId: mongoose.trusted({ $in: matchingIds }) });
    }

    const query = { $and: conditions };
    const sortSpec = sort === "oldest" ? { createdAt: 1 } : { createdAt: -1 };
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [assessments, total] = await Promise.all([
      PreAssessment.find(query)
        .populate("studentId", "fullName email studentIDnum course yearLevel profilePic")
        .populate("appointmentId", "type date startTime endTime status")
        .sort(sortSpec)
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      PreAssessment.countDocuments(query),
    ]);

    res.json({
      assessments,
      pagination: {
        total,
        page:  parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    logger.error("getCounselorPreAssessments error:", { error: error.message });
    res.status(500).json({ message: "Server error" });
  }
};

// ── Generate Summary Report (counselor only) ─────────────────────────────────
export const generateSummaryReport = async (req, res) => {
  try {
    const counselorId = req.user._id;
    const { startDate, endDate } = req.query;

    // Match the counselor's Pre-Assessment LIST scope: assessments explicitly
    // authorized to them, OR submitted by any student they have an appointment
    // with. Without this the report under-counts (showing 0) whenever a student
    // never linked their pre-assessment at booking time.
    const apptStudentIds = (await Appointment.distinct("studentId", { counselorId })).filter(Boolean);

    const query = {
      $or: [
        { authorizedCounselorId: counselorId },
        { studentId: mongoose.trusted({ $in: apptStudentIds }) },
      ],
    };

    if (startDate && endDate) {
      query.createdAt = mongoose.trusted({
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      });
    }

    const assessments = await PreAssessment.find(query)
      .populate("studentId", "fullName studentIDnum course yearLevel")
      .populate("appointmentId", "date type status");

    const stats = {
      total:    assessments.length,
      byConcern:   {},
      byUrgency:   {},
      byRiskLevel: {},
      byDetectedCategory: {},
      byRecommendedAction: {},
      byMonth:     {},
      urgencyFlags: 0,
      reviewed: 0,
      pending:  0,
    };

    assessments.forEach((a) => {
      // Legacy primaryConcern
      const concern = a.primaryConcern || a.assessmentResults?.detectedCategory || "Unknown";
      stats.byConcern[concern] = (stats.byConcern[concern] || 0) + 1;

      // Urgency
      stats.byUrgency[a.urgencyLevel] = (stats.byUrgency[a.urgencyLevel] || 0) + 1;

      // New risk level
      if (a.assessmentResults?.riskLevel) {
        stats.byRiskLevel[a.assessmentResults.riskLevel] =
          (stats.byRiskLevel[a.assessmentResults.riskLevel] || 0) + 1;
      }

      // Detected category
      if (a.assessmentResults?.detectedCategory) {
        stats.byDetectedCategory[a.assessmentResults.detectedCategory] =
          (stats.byDetectedCategory[a.assessmentResults.detectedCategory] || 0) + 1;
      }

      // Legacy action
      const action = a.aiRecommendations?.recommendedAction || "unknown";
      stats.byRecommendedAction[action] = (stats.byRecommendedAction[action] || 0) + 1;

      // Monthly submissions (yyyy-MM keys, sortable)
      if (a.createdAt) {
        const d = new Date(a.createdAt);
        const mkey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        stats.byMonth[mkey] = (stats.byMonth[mkey] || 0) + 1;
      }

      // Urgency flag: Critical risk or Immediate urgency
      if (
        a.assessmentResults?.riskLevel === "Critical" ||
        a.urgencyLevel === "Immediate" ||
        a.urgencyLevel === "Crisis" ||
        a.aiRecommendations?.urgencyFlag
      ) {
        stats.urgencyFlags++;
      }

      if (a.status === "reviewed") stats.reviewed++;
      if (a.status === "submitted") stats.pending++;
    });

    res.json({ stats, assessments });
  } catch (error) {
    logger.error("generateSummaryReport error:", { error: error.message });
    res.status(500).json({ message: "Server error" });
  }
};

// ── Delete Pre-Assessment (counselor only) ───────────────────────────────────
export const deletePreAssessment = async (req, res) => {
  try {
    const { id } = req.params;
    const counselorId = req.user._id;

    const preAssessment = await PreAssessment.findById(id);
    if (!preAssessment)
      return res.status(404).json({ message: "Pre-assessment not found" });

    // A counselor may delete a pre-assessment they are authorized for, or one from
    // a student they have an appointment with (same rule as viewing).
    const isAuthorized =
      preAssessment.authorizedCounselorId?.toString() === counselorId.toString();
    const hasAppointment = isAuthorized
      ? true
      : await Appointment.exists({ counselorId, studentId: preAssessment.studentId });
    if (!isAuthorized && !hasAppointment)
      return res.status(403).json({ message: "Access denied – not authorized for this pre-assessment" });

    // Unlink from its appointment so the appointment no longer points at a
    // now-deleted pre-assessment.
    if (preAssessment.appointmentId) {
      await Appointment.updateOne(
        { _id: preAssessment.appointmentId },
        { $set: { preAssessmentSubmitted: false }, $unset: { preAssessmentId: "" } },
      );
    }

    await PreAssessment.findByIdAndDelete(id);

    logger.info(`Pre-assessment ${id} deleted by counselor ${counselorId}`);
    res.json({ message: "Pre-assessment deleted" });
  } catch (error) {
    logger.error("deletePreAssessment error:", { error: error.message });
    res.status(500).json({ message: "Server error" });
  }
};
