// models/verification.model.js
//
// One-time secrets for account recovery / verification:
//   • password_reset    → long random token (emailed as a reset link)
//   • email_verification → 6-digit OTP (emailed; SMS-ready via `channel`)
//
// Only the SHA-256 hash of the secret is stored. A TTL index auto-purges
// rows shortly after they expire; expiry/attempts are still enforced in code.

import mongoose from "mongoose";

const verificationCodeSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    purpose: {
      type: String,
      enum: ["password_reset", "email_verification"],
      required: true,
    },
    channel: {
      type: String,
      enum: ["email", "sms"],
      default: "email",
    },
    kind: {
      type: String,
      enum: ["token", "otp"],
      required: true,
    },
    codeHash: {
      type: String,
      required: true,
    },
    attempts: {
      type: Number,
      default: 0,
    },
    maxAttempts: {
      type: Number,
      default: 5,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    consumedAt: {
      type: Date,
    },
  },
  { timestamps: true }
);

verificationCodeSchema.index({ userId: 1, purpose: 1 });
// Auto-remove documents 1 hour after they expire (housekeeping only).
verificationCodeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 3600 });

const VerificationCode = mongoose.model("VerificationCode", verificationCodeSchema);
export default VerificationCode;
