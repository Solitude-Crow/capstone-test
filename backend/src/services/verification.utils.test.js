// services/verification.utils.test.js
//
// Unit tests for the one-time-code core. Pure functions, no DB — run with:
//   node --test            (from the backend/ directory)
//   npm test

import { test } from "node:test";
import assert from "node:assert/strict";
import { generateOtp, generateToken, hashCode, checkCode } from "./verification.utils.js";

const MIN = 60 * 1000;

test("generateOtp returns a zero-padded 6-digit numeric string", () => {
  for (let i = 0; i < 500; i++) {
    const otp = generateOtp(6);
    assert.match(otp, /^\d{6}$/, `bad OTP: ${otp}`);
  }
});

test("generateToken returns a 64-char hex string (32 bytes) and is unique", () => {
  const a = generateToken(32);
  const b = generateToken(32);
  assert.match(a, /^[0-9a-f]{64}$/);
  assert.notEqual(a, b);
});

test("hashCode is deterministic, differs for different inputs, and is not the raw value", () => {
  assert.equal(hashCode("123456"), hashCode("123456"));
  assert.notEqual(hashCode("123456"), hashCode("123457"));
  assert.notEqual(hashCode("secret"), "secret");
});

test("checkCode accepts a correct, fresh, unconsumed code", () => {
  const rec = { codeHash: hashCode("123456"), expiresAt: Date.now() + 5 * MIN, attempts: 0, maxAttempts: 5 };
  assert.deepEqual(checkCode(rec, "123456"), { ok: true });
});

test("checkCode rejects a wrong code as invalid", () => {
  const rec = { codeHash: hashCode("123456"), expiresAt: Date.now() + 5 * MIN, attempts: 0, maxAttempts: 5 };
  assert.deepEqual(checkCode(rec, "000000"), { ok: false, reason: "invalid" });
});

test("checkCode rejects an expired code (token expiry)", () => {
  const rec = { codeHash: hashCode("abc"), expiresAt: Date.now() - 1000, attempts: 0, maxAttempts: 5 };
  assert.deepEqual(checkCode(rec, "abc"), { ok: false, reason: "expired" });
});

test("checkCode rejects after the attempt limit is reached", () => {
  const rec = { codeHash: hashCode("123456"), expiresAt: Date.now() + 5 * MIN, attempts: 5, maxAttempts: 5 };
  assert.deepEqual(checkCode(rec, "123456"), { ok: false, reason: "too_many_attempts" });
});

test("checkCode rejects an already-consumed code", () => {
  const rec = { codeHash: hashCode("123456"), expiresAt: Date.now() + 5 * MIN, attempts: 0, maxAttempts: 5, consumedAt: new Date() };
  assert.deepEqual(checkCode(rec, "123456"), { ok: false, reason: "used" });
});

test("checkCode returns not_found for a missing record", () => {
  assert.deepEqual(checkCode(null, "123456"), { ok: false, reason: "not_found" });
});

test("checkCode works with a Date expiresAt", () => {
  const ok = { codeHash: hashCode("x"), expiresAt: new Date(Date.now() + MIN), attempts: 0, maxAttempts: 5 };
  const expired = { codeHash: hashCode("x"), expiresAt: new Date(Date.now() - MIN), attempts: 0, maxAttempts: 5 };
  assert.equal(checkCode(ok, "x").ok, true);
  assert.equal(checkCode(expired, "x").reason, "expired");
});
