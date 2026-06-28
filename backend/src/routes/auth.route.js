// routes/auth.route.js
import express from "express";
import {
  signup, login, logout, googleAuth, googleRegister,
  updateProfile, updateMyProfile, changePassword,
  updatePrivacyConsent, forgotPassword, resetPassword, sendEmailOtp, verifyEmail,
  checkAuth, getUsersByRole,
} from "../controllers/auth.controller.js";
import { protectRoute } from "../middleware/auth.middleware.js";
import { authLimiter, sensitiveActionLimiter } from "../middleware/rateLimiter.js";
import { signupValidator, loginValidator } from "../middleware/validators.js";

const router = express.Router();

router.post("/signup", authLimiter, signupValidator, signup);
router.post("/login", authLimiter, loginValidator, login);
router.post("/logout", protectRoute, logout);

// ── Google sign-in ───────────────────────────────────────────────────────────
router.post("/google", authLimiter, googleAuth);
router.post("/google/register", authLimiter, googleRegister);

// ── Account recovery / verification ──────────────────────────────────────────
router.post("/forgot-password", sensitiveActionLimiter, forgotPassword);
router.post("/reset-password", sensitiveActionLimiter, resetPassword);
router.post("/send-email-otp", protectRoute, sensitiveActionLimiter, sendEmailOtp);
router.post("/verify-email", protectRoute, verifyEmail);

router.put("/update-profile", protectRoute, updateProfile);             // profile photo
router.patch("/profile", protectRoute, updateMyProfile);               // editable details
router.patch("/change-password", protectRoute, sensitiveActionLimiter, changePassword);
router.patch("/privacy-consent", protectRoute, updatePrivacyConsent);
router.get("/me", protectRoute, checkAuth);
router.get("/users", protectRoute, getUsersByRole); // Protected – only logged-in users

export default router;
