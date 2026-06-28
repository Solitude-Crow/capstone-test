// lib/utils.js
import jwt from "jsonwebtoken";

const COOKIE_OPTIONS = {
  httpOnly: true,           // Prevents XSS — JS cannot access this cookie
  sameSite: "strict",       // Prevents CSRF attacks
  secure: process.env.NODE_ENV !== "development", // HTTPS only in production
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
};

export const generateToken = (userId, role, res) => {
  const token = jwt.sign(
    { userId, role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
  );

  res.cookie("jwt", token, COOKIE_OPTIONS);
  return token;
};

export const clearAuthCookie = (res) => {
  res.cookie("jwt", "", {
    ...COOKIE_OPTIONS,
    maxAge: 0,
  });
};

// ── Date Query Helpers ────────────────────────────────────────────────────────

/**
 * Returns a MongoDB date range covering the full calendar day of `date`.
 * Replaces the repeated setHours(0,0,0,0) pattern across controllers.
 *
 * @param {string|Date} date
 * @returns {{ $gte: Date, $lt: Date }}
 */
export const getDayRange = (date) => ({
  $gte: new Date(new Date(date).setHours(0, 0, 0, 0)),
  $lt: new Date(new Date(date).setHours(23, 59, 59, 999)),
});

// ── Sanitize a string to prevent XSS (strip HTML tags) ───────────────────────
export const sanitizeString = (str) => {
  if (typeof str !== "string") return str;
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
    .replace(/\//g, "&#x2F;");
};

// Deep sanitize an object's string values
export const sanitizeObject = (obj) => {
  if (typeof obj !== "object" || obj === null) return sanitizeString(obj);
  const result = {};
  for (const [key, val] of Object.entries(obj)) {
    result[key] = typeof val === "object" ? sanitizeObject(val) : sanitizeString(val);
  }
  return result;
};