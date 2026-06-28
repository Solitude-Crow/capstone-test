// services/verification.utils.js
//
// Pure, dependency-light helpers for one-time codes (no DB, no mailer) so the
// security-critical logic is unit-testable in isolation. See
// verification.utils.test.js.

import crypto from "crypto";

/** Cryptographically-strong numeric OTP, zero-padded to `digits`. */
export const generateOtp = (digits = 6) => {
  const max = 10 ** digits;
  return String(crypto.randomInt(0, max)).padStart(digits, "0");
};

/** Long random URL-safe token (hex) for email links. */
export const generateToken = (bytes = 32) => crypto.randomBytes(bytes).toString("hex");

/** SHA-256 hash — only the hash is ever stored. */
export const hashCode = (raw) =>
  crypto.createHash("sha256").update(String(raw)).digest("hex");

/**
 * Pure verification of a raw code against a stored record. Does not mutate.
 *
 * @param record { codeHash, expiresAt, attempts, maxAttempts, consumedAt }
 * @returns { ok: boolean, reason?: 'not_found'|'used'|'expired'|'too_many_attempts'|'invalid' }
 */
export const checkCode = (record, rawCode, now = Date.now()) => {
  if (!record) return { ok: false, reason: "not_found" };
  if (record.consumedAt) return { ok: false, reason: "used" };

  const exp = record.expiresAt instanceof Date ? record.expiresAt.getTime() : record.expiresAt;
  if (now > exp) return { ok: false, reason: "expired" };

  if ((record.attempts || 0) >= (record.maxAttempts ?? 5)) {
    return { ok: false, reason: "too_many_attempts" };
  }
  if (record.codeHash !== hashCode(rawCode)) return { ok: false, reason: "invalid" };

  return { ok: true };
};
