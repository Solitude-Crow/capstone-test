// middleware/rateLimiter.js
import rateLimit, { ipKeyGenerator } from "express-rate-limit";

const windowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000; // 15 min

// Key by authenticated user ID when available, otherwise fall back to IP.
// ipKeyGenerator is required by express-rate-limit v7+ when falling back to
// req.ip — it normalises IPv6 addresses so users can't bypass limits via
// different IPv6 representations of the same address.
const userOrIpKey = (req) => {
  const userId = req.user?._id?.toString();
  return userId ? `user:${userId}` : ipKeyGenerator(req);
};

// General API rate limiter — raised to 500 req/15min per user.
export const apiLimiter = rateLimit({
  windowMs,
  max: parseInt(process.env.RATE_LIMIT_MAX) || 500,
  keyGenerator: userOrIpKey,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many requests, please try again later." },
});

// Strict limiter for auth routes (login / signup) — prevents brute force.
// Keyed by IP only (user is not authenticated yet).
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { message: "Too many authentication attempts. Please try again in 15 minutes." },
});

// Strict limiter for password reset / OTP flows
export const sensitiveActionLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many requests for this action. Please try again in 1 hour." },
});

// Pre-assessment submit limiter — scoped to this route only.
export const preAssessmentLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,                   // 10 submissions per hour per user
  keyGenerator: userOrIpKey,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many pre-assessment submissions. Please wait before trying again." },
});