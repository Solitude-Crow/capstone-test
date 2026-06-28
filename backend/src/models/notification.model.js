// models/notification.model.js
import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    appointmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Appointment",
    },
    referralId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Referral",
    },
    type: {
      type: String,
      enum: [
        // Appointment
        "appointment_created",
        "appointment_accepted",
        "appointment_rejected",
        "appointment_rescheduled",
        "appointment_cancelled",
        "appointment_completed",
        "appointment_feedback",
        "appointment_reminder",
        "reschedule_accepted",
        "reschedule_rejected",
        // Pre-assessment
        "pre_assessment_submitted",
        "pre_assessment_reviewed",
        // Referral
        "referral_created",
        "referral_accepted",
        "referral_rejected",
        "referral_scheduled",
        "referral_completed",
        "referral_received",       // Student notified they were referred
        "referral_under_review",   // Counselor begins review of referral
        "referral_high_priority",  // High/critical referral escalation to all counselors
        "referral_appointment_requested", // Faculty booked an appointment from a referral
        // Counselor presence
        "counselor_unavailable",
        "counselor_available",
      ],
      required: true,
    },
    message: {
      type: String,
      required: true,
      maxlength: 500,
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  { timestamps: true }
);

notificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });

const Notification = mongoose.model("Notification", notificationSchema);
export default Notification;