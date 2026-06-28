// routes/preAssessment.route.js
import express from "express";
import {
  submitPreAssessment,
  linkToAppointment,
  getMyPreAssessments,
  getPreAssessment,
  getPreAssessmentByAppointment,
  getCounselorPreAssessments,
  generateSummaryReport,
  deletePreAssessment,
} from "../controllers/preAssessment.controller.js";
import { protectRoute } from "../middleware/auth.middleware.js";
import { studentOnly } from "../middleware/studentOnly.js";
import { counselorOnly } from "../middleware/counselorOnly.js";
import { preAssessmentValidator } from "../middleware/validators.js";
import { preAssessmentLimiter } from "../middleware/rateLimiter.js";

const router = express.Router();
router.use(protectRoute);

// ── Student routes ────────────────────────────────────────────────────────────
router.post(
  "/",
  studentOnly,
  preAssessmentLimiter,
  preAssessmentValidator,
  submitPreAssessment,
);
router.get("/my", studentOnly, getMyPreAssessments);
router.patch("/:id/link", studentOnly, linkToAppointment); // link to appointment after booking

// ── Counselor-only routes (specific paths BEFORE param routes) ────────────────
router.get("/report/summary", counselorOnly, generateSummaryReport);
router.get("/", counselorOnly, getCounselorPreAssessments);

// ── Shared (internally access-controlled) — param routes last ────────────────
router.get("/appointment/:appointmentId", getPreAssessmentByAppointment);
router.get("/:id", getPreAssessment);
router.delete("/:id", counselorOnly, deletePreAssessment);

export default router;
