// models/referral.model.js
import mongoose from "mongoose";

const { Schema } = mongoose;
const ObjectId = Schema.Types.ObjectId;

// ── Section A: Faculty Snapshot ───────────────────────────────────────────────
const facultySnapshotSchema = new Schema(
  {
    name:          { type: String, trim: true },
    position:      { type: String, trim: true },
    department:    { type: String, trim: true },
    contactNumber: { type: String, trim: true },
    email:         { type: String, trim: true },
    dateOfReferral:{ type: Date },
    // Audit trail: records field edits made before submission
    modifications: [
      {
        field:         { type: String },
        originalValue: { type: String },
        modifiedValue: { type: String },
        modifiedBy:    { type: ObjectId, ref: "User" },
        modifiedAt:    { type: Date, default: Date.now },
      },
    ],
  },
  { _id: false }
);

// ── Section B: Student Snapshot ───────────────────────────────────────────────
const studentSnapshotSchema = new Schema(
  {
    fullName:     { type: String, trim: true },
    studentIDnum: { type: String, trim: true },
    course:       { type: String, trim: true },
    yearLevel:    { type: String, trim: true },
    section:      { type: String, trim: true },
    adviser:      { type: String, trim: true },
    email:        { type: String, trim: true },
    contactNumber:{ type: String, trim: true },
  },
  { _id: false }
);

// ── Main Referral Schema ──────────────────────────────────────────────────────
const referralSchema = new Schema(
  {
    // ── Parties ───────────────────────────────────────────────────────────────
    facultyId: {
      type: ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    // null when isUnregisteredStudent = true
    studentId: {
      type: ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    counselorId: {
      type: ObjectId,
      ref: "User",
      index: true,
    },

    // ── Unregistered student flag ─────────────────────────────────────────────
    isUnregisteredStudent: {
      type: Boolean,
      default: false,
    },

    // ── Permanent snapshots (immutable record of data at time of referral) ────
    facultySnapshot:  { type: facultySnapshotSchema  },
    studentSnapshot:  { type: studentSnapshotSchema  },

    // ── Section C: Referral Indicators (multi-select checkboxes) ─────────────
    referralIndicators: {
      type: [String],
      default: [],
    },
    otherConcern: {
      type: String,
      trim: true,
      maxlength: 500,
    },

    // ── Section D: Observation Details (mandatory, 50–3000 chars) ────────────
    observationDetails: {
      type: String,
      trim: true,
      maxlength: 3000,
    },

    // ── Section E: Actions Already Taken ─────────────────────────────────────
    actionsTaken: {
      type: [String],
      default: [],
    },
    otherAction: {
      type: String,
      trim: true,
      maxlength: 500,
    },

    // ── Section F: Priority Level ─────────────────────────────────────────────
    priorityLevel: {
      type: String,
      enum: ["low", "moderate", "high", "critical"],
      default: "low",
      index: true,
    },

    // ── Section G: Student Awareness ─────────────────────────────────────────
    studentAwareness: {
      type: String,
      trim: true,
      maxlength: 300,
    },

    // ── Backward-compat fields (kept for existing queries / analytics) ────────
    reason: {
      type: String,
      trim: true,
      maxlength: 1000,
    },
    urgency: {
      // medium = legacy label for moderate
      type: String,
      enum: ["low", "medium", "moderate", "high", "critical"],
      default: "low",
    },
    remarks: {
      type: String,
      trim: true,
      maxlength: 2000,
    },
    preferredDate: {
      type: Date,
    },
    category: {
      type: String,
      enum: [
        "Academic",
        "Personal/Emotional",
        "Career",
        "Family",
        "Social/Interpersonal",
        "Financial",
        "Health/Wellness",
        "Behavioral",
        "Other",
      ],
      default: "Other",
    },

    // ── Status lifecycle ──────────────────────────────────────────────────────
    status: {
      type: String,
      enum: ["pending", "under_review", "accepted", "scheduled", "completed", "rejected"],
      default: "pending",
      index: true,
    },
    counselorNotes: {
      type: String,
      trim: true,
      maxlength: 2000,
    },
    rejectionReason: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    reviewedAt: { type: Date },
    reviewedBy: { type: ObjectId, ref: "User" },

    // ── Linked appointment (once referral is converted) ───────────────────────
    appointmentId: {
      type: ObjectId,
      ref: "Appointment",
    },

    // ── Status history for audit trail ───────────────────────────────────────
    statusHistory: [
      {
        status:    { type: String },
        changedBy: { type: ObjectId, ref: "User" },
        changedAt: { type: Date, default: Date.now },
        note:      { type: String },
      },
    ],
  },
  { timestamps: true }
);

// Compound indexes for common query patterns
referralSchema.index({ status: 1, createdAt: -1 });
referralSchema.index({ facultyId: 1, status: 1 });
referralSchema.index({ studentId: 1, status: 1 });
referralSchema.index({ counselorId: 1, status: 1 });
referralSchema.index({ urgency: 1, status: 1 });
referralSchema.index({ priorityLevel: 1, status: 1 });

const Referral = mongoose.model("Referral", referralSchema);
export default Referral;
