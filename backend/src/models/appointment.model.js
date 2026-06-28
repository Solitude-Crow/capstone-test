// models/appointment.model.js
import mongoose from "mongoose";

const appointmentSchema = new mongoose.Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    counselorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    // Populated when this appointment was created from a referral
    referralId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Referral",
      default: null,
    },
    type: {
      type: String,
      required: true,
      enum: [
        "Academic Counseling",
        "Personal/Emotional Counseling",
        "Career Counseling",
        "Family Concern",
        "Social/Interpersonal",
        "Financial Assistance",
        "Health/Wellness",
        "General Inquiry",
      ],
    },
    date: {
      type: Date,
      required: true,
    },
    startTime: {
      type: String,
      required: true,
      match: [/^\d{2}:\d{2}$/, "Time must be in HH:MM format"],
    },
    endTime: {
      type: String,
      required: true,
      match: [/^\d{2}:\d{2}$/, "Time must be in HH:MM format"],
    },
    status: {
      type: String,
      enum: [
        "pending",
        "accepted",
        "rejected",
        "rescheduled",
        "cancelled",
        "completed",
      ],
      default: "pending",
    },
    notes: {
      type: String,
      maxlength: 1000,
      trim: true,
    },

    // ── Rescheduling history ───────────────────────────────────────────────────
    previousDetails: {
      date: { type: Date },
      startTime: { type: String },
      endTime: { type: String },
      status: { type: String },
      rescheduledBy: {
        type: String,
        enum: ["student", "counselor"],
      },
      rescheduledAt: { type: Date },
    },
    rescheduleAcceptedByStudent: {
      type: Boolean,
      default: null, // null = pending response
    },

    // ── Pre-assessment link ───────────────────────────────────────────────────
    preAssessmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PreAssessment",
    },
    preAssessmentSubmitted: {
      type: Boolean,
      default: false,
    },

    // ── Completion & feedback ─────────────────────────────────────────────────
    counselorNotes: {
      type: String,
      maxlength: 2000,
      trim: true,
    },
    feedback: {
      content: { type: String, maxlength: 1000, trim: true },
      rating: { type: Number, min: 1, max: 5 },
      addedAt: { type: Date },
    },

    // ── Cancellation ──────────────────────────────────────────────────────────
    cancellationReason: {
      type: String,
      maxlength: 500,
      trim: true,
    },
    cancelledBy: {
      type: String,
      enum: ["student", "counselor", null],
    },

    // ── Reminder dedup — flags flip true once each reminder has been sent ──────
    remindersSent: {
      twoDay:  { type: Boolean, default: false },
      oneDay:  { type: Boolean, default: false },
      oneHour: { type: Boolean, default: false },
    },
  },
  { timestamps: true }
);

// ── Indexes ───────────────────────────────────────────────────────────────────
// Single-field indexes for common standalone lookups
appointmentSchema.index({ studentId: 1 });
appointmentSchema.index({ counselorId: 1 });
appointmentSchema.index({ date: 1 });
appointmentSchema.index({ status: 1 });

// Compound indexes for the query patterns used in controllers
appointmentSchema.index({ studentId: 1, status: 1 });   // getMyAppointments (student)
appointmentSchema.index({ counselorId: 1, status: 1 }); // getMyAppointments (counselor)
appointmentSchema.index({ counselorId: 1, date: 1 });   // availability conflict checks
appointmentSchema.index({ date: 1, status: 1 });        // date-range status filters

const Appointment = mongoose.model("Appointment", appointmentSchema);
export default Appointment;