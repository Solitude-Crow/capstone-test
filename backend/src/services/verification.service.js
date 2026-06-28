// services/verification.service.js
//
// DB-bound issue/verify for one-time codes, built on the pure helpers in
// verification.utils.js. Sending (email/SMS) is left to the caller so this
// stays free of mailer/provider dependencies.

import VerificationCode from "../models/verification.model.js";
import { generateOtp, generateToken, hashCode, checkCode } from "./verification.utils.js";

const TTL_MS = {
  password_reset:     60 * 60 * 1000, // 1 hour
  email_verification:  5 * 60 * 1000, // 5 minutes
};

const KIND = {
  password_reset:     "token", // emailed reset link
  email_verification: "otp",   // 6-digit code
};

/**
 * Issue a fresh code for a user+purpose, invalidating any prior outstanding
 * one (so only the latest is ever valid). Returns the RAW secret to send.
 */
export const issueCode = async (userId, purpose, { channel = "email" } = {}) => {
  const kind = KIND[purpose];
  const raw = kind === "otp" ? generateOtp(6) : generateToken(32);

  await VerificationCode.deleteMany({ userId, purpose, consumedAt: { $exists: false } });

  await VerificationCode.create({
    userId,
    purpose,
    channel,
    kind,
    codeHash: hashCode(raw),
    attempts: 0,
    maxAttempts: 5,
    expiresAt: new Date(Date.now() + TTL_MS[purpose]),
  });

  return raw;
};

/**
 * Verify a raw code. On a wrong code, increments the attempt counter; on
 * success, consumes the record. Returns { ok, reason? }.
 */
export const verifyCode = async (userId, purpose, rawCode) => {
  const record = await VerificationCode.findOne({
    userId,
    purpose,
    consumedAt: { $exists: false },
  }).sort({ createdAt: -1 });

  const result = checkCode(record, rawCode);
  if (!record) return result;

  if (!result.ok) {
    if (result.reason === "invalid") {
      record.attempts = (record.attempts || 0) + 1;
      await record.save();
    }
    return result;
  }

  record.consumedAt = new Date();
  await record.save();
  return { ok: true };
};
