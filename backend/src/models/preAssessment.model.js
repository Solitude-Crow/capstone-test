import mongoose from "mongoose";

const PURPOSE_OF_VISIT_OPTIONS = [
  "Academic Concerns",
  "Personal Concerns",
  "Family Concerns",
  "Career Planning",
  "Emotional or Mental Well-being",
  "Relationship Concerns",
  "Financial Concerns",
  "Stress Management",
  "Behavioral Concerns",
  "Scholarship Concerns",
  "Adjustment to College Life",
  "Others",
];

const preAssessmentSchema = new mongoose.Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // ── Section A: Student Info (supplemental — populated from User profile) ───
    // Stored as snapshot at time of submission
    studentSnapshot: {
      studentIDnum:   { type: String },
      course:         { type: String },
      yearLevel:      { type: String },
      section:        { type: String },
      age:            { type: Number },
      gender:         { type: String },
      contactNumber:  { type: String },
      email:          { type: String },
    },

    // ── Section B: Purpose of Visit (multi-select) ────────────────────────────
    purposeOfVisit: [{ type: String, enum: PURPOSE_OF_VISIT_OPTIONS }],
    purposeOfVisitOther: { type: String, trim: true, maxlength: 200 },

    // ── Section C: Likert Scale Self-Assessment ───────────────────────────────
    // score: 1=Never 2=Rarely 3=Sometimes 4=Often 5=Always
    likertResponses: [
      {
        statement: { type: String, required: true },
        score:     { type: Number, min: 1, max: 5, required: true },
      },
    ],

    // ── Section D: Concern Categories (grouped sub-tags) ─────────────────────
    concernCategories:      [{ type: String }],
    concernCategoryOther:   { type: String, trim: true, maxlength: 200 },

    // ── Section E: Open-Ended ─────────────────────────────────────────────────
    concernDescription: {
      type: String,
      required: true,
      maxlength: 2000,
      trim: true,
    },
    concernDuration: {
      type: String,
      enum: ["Less than 1 month", "1–3 months", "4–6 months", "More than 6 months", ""],
    },
    expectedAssistance: { type: String, trim: true, maxlength: 1000 },

    // ── Legacy: primaryConcern kept for backward compat with old submissions ──
    primaryConcern: {
      type: String,
      enum: [
        "Academic",
        "Personal/Emotional",
        "Career",
        "Family",
        "Social/Interpersonal",
        "Financial",
        "Health/Wellness",
        "Other",
      ],
    },

    // ── Section F: Urgency ────────────────────────────────────────────────────
    urgencyLevel: {
      type: String,
      // "Crisis" kept for backward compat with old data; "Immediate" = new form label
      enum: ["Low", "Moderate", "High", "Immediate", "Crisis"],
      required: true,
      default: "Low",
    },

    // ── Section G: Consent ────────────────────────────────────────────────────
    consentGiven: { type: Boolean, default: false },

    // ── Legacy responses (old open-ended Q&A format) ──────────────────────────
    responses: [
      {
        question: { type: String, required: true },
        answer:   { type: String, required: true, maxlength: 1000 },
      },
    ],

    // ── Assessment Results (primary — rule-based engine output) ───────────────
    assessmentResults: {
      detectedCategory: { type: String },
      riskLevel: {
        type: String,
        enum: ["Low", "Moderate", "High", "Critical"],
      },
      riskFactors:  [{ type: String }],
      scoreBreakdown: {
        academic:  { type: Number },
        emotional: { type: Number },
        social:    { type: Number },
        family:    { type: Number },
        career:    { type: Number },
        average:   { type: Number },
      },
      suggestedResources: [
        {
          title:       { type: String },
          description: { type: String },
          type:        { type: String },
          category:    { type: String },
        },
      ],
      suggestedNextAction:         { type: String },
      counselorPreparationNotes:   { type: String },
      studentSummary:              { type: String },  // Gemini (optional)
      counselorSummary:            { type: String },  // Gemini (optional)
      geminiUsed:                  { type: Boolean, default: false },
      analyzedAt:                  { type: Date },
    },

    // ── Legacy AI recommendations (kept for old submissions) ─────────────────
    aiRecommendations: {
      summary:      { type: String },
      category:     { type: String },
      interventions:[{ type: String }],
      urgencyFlag:  { type: Boolean, default: false },
      counselorTips:{ type: String },
      recommendedAction: {
        type: String,
        enum: ["book_appointment", "self_help", "external_referral", "monitor_self"],
      },
      studentFacingMessage: { type: String },
      studentResources: [
        {
          title:       { type: String },
          description: { type: String },
          link:        { type: String },
        },
      ],
      provider:    { type: String },
      model:       { type: String },
      rawResponse: { type: String },
      generatedAt: { type: Date },
    },

    // ── Appointment link ──────────────────────────────────────────────────────
    appointmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Appointment",
      index: true,
    },
    authorizedCounselorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    // ── Status ────────────────────────────────────────────────────────────────
    status: {
      type: String,
      enum: ["submitted", "reviewed", "archived"],
      default: "submitted",
    },
    reviewedAt: { type: Date },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },

    // ── Audit trail ───────────────────────────────────────────────────────────
    accessLog: [
      {
        accessedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        accessedAt: { type: Date, default: Date.now },
        action:     { type: String, enum: ["viewed", "reviewed", "exported"] },
      },
    ],
  },
  { timestamps: true }
);

preAssessmentSchema.index({ studentId: 1, status: 1 });
preAssessmentSchema.index({ authorizedCounselorId: 1, status: 1 });
preAssessmentSchema.index({ studentId: 1, createdAt: -1 });
preAssessmentSchema.index({ "assessmentResults.riskLevel": 1 });
preAssessmentSchema.index({ "assessmentResults.detectedCategory": 1 });

const PreAssessment = mongoose.model("PreAssessment", preAssessmentSchema);
export default PreAssessment;
