// middleware/validators.js
import { body, param, query, validationResult } from "express-validator";

// Middleware to check validation errors and return 422 if any
export const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({ message: "Validation failed", errors: errors.array() });
  }
  next();
};

// ── Auth validators ───────────────────────────────────────────────────────────
export const signupValidator = [
  body("email").isEmail().normalizeEmail().withMessage("Valid email required"),
  body("fullName")
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage("Full name must be 2–100 characters")
    .matches(/^[a-zA-Z\s'-]+$/)
    .withMessage("Full name contains invalid characters"),
  body("password")
    .isLength({ min: 8 })
    .withMessage("Password must be at least 8 characters")
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage("Password must contain uppercase, lowercase, and a number"),
  body("role").isIn(["student", "counselor", "faculty"]).withMessage("Invalid role"),
  body("studentIDnum")
    .if(body("role").equals("student"))
    .notEmpty()
    .withMessage("Student ID is required for students")
    .trim()
    .isLength({ max: 20 }),
  body("yearLevel")
    .if(body("role").equals("student"))
    .isIn(["1st Year", "2nd Year", "3rd Year", "4th Year"])
    .withMessage("Invalid year level"),
  body("course")
    .if(body("role").equals("student"))
    .isIn(["ABIS", "BSIS", "BECED", "BSED", "BHUMS"])
    .withMessage("Invalid course"),
  validate,
];

export const loginValidator = [
  body("email").isEmail().normalizeEmail().withMessage("Valid email required"),
  body("password").notEmpty().withMessage("Password is required"),
  validate,
];

// ── Appointment validators ────────────────────────────────────────────────────
export const createAppointmentValidator = [
  body("counselorId").isMongoId().withMessage("Invalid counselor ID"),
  body("type")
    .isIn([
      "Academic Counseling", "Personal/Emotional Counseling", "Career Counseling",
      "Family Concern", "Social/Interpersonal", "Financial Assistance",
      "Health/Wellness", "General Inquiry",
    ])
    .withMessage("Invalid appointment type"),
  body("date").isISO8601().withMessage("Invalid date format"),
  body("startTime").matches(/^\d{2}:\d{2}$/).withMessage("Time must be HH:MM"),
  body("endTime").matches(/^\d{2}:\d{2}$/).withMessage("Time must be HH:MM"),
  body("notes").optional().isLength({ max: 1000 }).trim(),
  validate,
];

export const updateStatusValidator = [
  param("id").isMongoId().withMessage("Invalid appointment ID"),
  body("status")
    .isIn(["accepted", "rejected", "completed"])
    .withMessage("Invalid status"),
  body("notes").optional().isLength({ max: 1000 }).trim(),
  validate,
];

export const rescheduleValidator = [
  param("id").isMongoId().withMessage("Invalid appointment ID"),
  body("date").isISO8601().withMessage("Invalid date format"),
  body("startTime").matches(/^\d{2}:\d{2}$/).withMessage("Time must be HH:MM"),
  body("endTime").matches(/^\d{2}:\d{2}$/).withMessage("Time must be HH:MM"),
  validate,
];

// ── Availability validators ───────────────────────────────────────────────────
export const setAvailabilityValidator = [
  body("date").isISO8601().withMessage("Invalid date"),
  body("availableSlots").isArray({ min: 1 }).withMessage("At least one slot required"),
  body("availableSlots.*.startTime").matches(/^\d{2}:\d{2}$/).withMessage("Slot startTime must be HH:MM"),
  body("availableSlots.*.endTime").matches(/^\d{2}:\d{2}$/).withMessage("Slot endTime must be HH:MM"),
  validate,
];

// ── Pre-Assessment validators ─────────────────────────────────────────────────
const PURPOSE_OPTIONS = [
  "Academic Concerns", "Personal Concerns", "Family Concerns", "Career Planning",
  "Emotional or Mental Well-being", "Relationship Concerns", "Financial Concerns",
  "Stress Management", "Behavioral Concerns", "Scholarship Concerns",
  "Adjustment to College Life", "Others",
];

export const preAssessmentValidator = [
  // Section A — student info collected in the form (not stored on the profile)
  body("studentInfo").optional().isObject(),
  body("studentInfo.section").optional({ values: "falsy" }).isLength({ max: 50 }).trim(),
  body("studentInfo.age")
    .optional({ values: "falsy" })
    .isInt({ min: 10, max: 120 })
    .withMessage("Age must be between 10 and 120"),
  body("studentInfo.gender").optional({ values: "falsy" }).isLength({ max: 50 }).trim(),
  body("studentInfo.contactNumber").optional({ values: "falsy" }).isLength({ max: 30 }).trim(),

  // New MKD fields
  body("purposeOfVisit").optional().isArray().withMessage("purposeOfVisit must be an array"),
  body("purposeOfVisit.*")
    .optional()
    .isIn(PURPOSE_OPTIONS)
    .withMessage("Invalid purpose of visit option"),
  body("purposeOfVisitOther").optional().isLength({ max: 200 }).trim(),

  body("likertResponses").optional().isArray(),
  body("likertResponses.*.statement").optional().isLength({ max: 300 }).trim(),
  body("likertResponses.*.score")
    .optional()
    .isInt({ min: 1, max: 5 })
    .withMessage("Likert score must be 1–5"),

  body("concernCategories").optional().isArray(),
  body("concernCategories.*").optional().isLength({ max: 100 }).trim(),
  body("concernCategoryOther").optional().isLength({ max: 200 }).trim(),

  body("concernDescription")
    .trim()
    .isLength({ min: 10, max: 2000 })
    .withMessage("Concern description must be 10–2000 characters"),

  body("concernDuration")
    .optional()
    .isIn(["Less than 1 month", "1–3 months", "4–6 months", "More than 6 months", ""])
    .withMessage("Invalid concern duration"),

  body("expectedAssistance").optional().isLength({ max: 1000 }).trim(),

  body("urgencyLevel")
    .isIn(["Low", "Moderate", "High", "Immediate", "Crisis"])
    .withMessage("Invalid urgency level"),

  body("consentGiven")
    .optional()
    .isBoolean()
    .withMessage("consentGiven must be boolean"),

  // Legacy fields kept for backward compat
  body("primaryConcern")
    .optional()
    .isIn(["Academic", "Personal/Emotional", "Career", "Family", "Social/Interpersonal", "Financial", "Health/Wellness", "Other"])
    .withMessage("Invalid primary concern"),
  body("responses").optional().isArray(),
  body("responses.*.question").optional().isLength({ max: 500 }).trim(),
  body("responses.*.answer").optional().isLength({ max: 1000 }).trim(),

  validate,
];
