// controllers/auth.controller.js
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import User from "../models/user.model.js";
import cloudinary from "../lib/cloudinary.js";
import { generateToken, clearAuthCookie } from "../lib/utils.js";
import { issueCode, verifyCode } from "../services/verification.service.js";
import { sendPasswordResetEmail, sendOtpEmail } from "../services/email.js";
import { verifyGoogleIdToken } from "../services/google.js";
import logger from "../lib/logger.js";

// ── Shared auth response shape (used by Google sign-in / registration) ────────
const authResponse = (user, token) => ({
  _id:        user._id,
  email:      user.email,
  fullName:   user.fullName,
  profilePic: user.profilePic,
  role:       user.role,
  provider:   user.provider,
  emailVerified: user.emailVerified,
  token,
  ...(user.role === "student"   && { studentIDnum: user.studentIDnum, yearLevel: user.yearLevel, course: user.course }),
  ...(user.role === "counselor" && { specialization: user.specialization, presenceStatus: user.presenceStatus }),
  ...(user.role === "faculty"   && { department: user.department, facultyId: user.facultyId }),
});

// ── Signup ────────────────────────────────────────────────────────────────────
export const signup = async (req, res) => {
  const {
    email, fullName, password, role,
    // Student fields
    studentIDnum, yearLevel, course,
    // Counselor fields
    specialization,
    // Faculty fields
    department, facultyId,
  } = req.body;

  try {
    if (role === "student") {
      if (!studentIDnum || !yearLevel || !course) {
        return res.status(400).json({
          message: "Students must provide a Student ID, year level, and course.",
        });
      }
    }

    if (role === "counselor") {
      if (!specialization?.trim()) {
        return res.status(400).json({ message: "Counselors must provide a specialization." });
      }
    }

    if (role === "faculty") {
      if (!department?.trim()) {
        return res.status(400).json({ message: "Faculty must provide a department." });
      }
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ message: "Email already registered" });

    const hashedPassword = await bcrypt.hash(password, 12);

    const newUser = new User({
      email,
      fullName,
      password: hashedPassword,
      role,
      ...(role === "student"  && { studentIDnum, yearLevel, course }),
      ...(role === "counselor" && { specialization: specialization.trim() }),
      ...(role === "faculty"   && { department: department.trim(), facultyId: facultyId?.trim() }),
    });

    await newUser.save();
    const token = generateToken(newUser._id, newUser.role, res);

    logger.info(`New user registered: ${email} (${role})`);

    res.status(201).json({
      _id:      newUser._id,
      email:    newUser.email,
      fullName: newUser.fullName,
      profilePic: newUser.profilePic,
      role:     newUser.role,
      emailVerified: newUser.emailVerified,
      token,
      ...(role === "student"   && { studentIDnum: newUser.studentIDnum, yearLevel: newUser.yearLevel, course: newUser.course }),
      ...(role === "counselor" && { specialization: newUser.specialization }),
      ...(role === "faculty"   && { department: newUser.department, facultyId: newUser.facultyId }),
    });
  } catch (error) {
    logger.error("Signup error:", { error: error.message, email });
    res.status(500).json({ message: "Internal server error" });
  }
};

// ── Login ─────────────────────────────────────────────────────────────────────
export const login = async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });

    if (!user) return res.status(401).json({ message: "Invalid credentials" });

    // Google-only accounts have no password — guide them to the Google button.
    if (!user.password) {
      return res.status(400).json({ message: "This account uses Google sign-in. Please continue with Google." });
    }

    if (user.isLocked) {
      const minutesLeft = Math.ceil((user.lockUntil - Date.now()) / 60000);
      return res.status(423).json({
        message: `Account temporarily locked. Try again in ${minutesLeft} minute(s).`,
      });
    }

    const isPasswordCorrect = await bcrypt.compare(password, user.password);
    if (!isPasswordCorrect) {
      await user.incLoginAttempts();
      logger.warn(`Failed login for ${email}`);
      return res.status(401).json({ message: "Invalid credentials" });
    }

    if (user.failedLoginAttempts > 0) await user.resetLoginAttempts();

    const token = generateToken(user._id, user.role, res);
    logger.info(`User logged in: ${email}`);

    res.status(200).json({
      _id:      user._id,
      email:    user.email,
      fullName: user.fullName,
      profilePic: user.profilePic,
      role:     user.role,
      emailVerified: user.emailVerified,
      token,
      ...(user.role === "student"   && { studentIDnum: user.studentIDnum, yearLevel: user.yearLevel, course: user.course }),
      ...(user.role === "counselor" && { specialization: user.specialization, presenceStatus: user.presenceStatus }),
      ...(user.role === "faculty"   && { department: user.department, facultyId: user.facultyId }),
    });
  } catch (error) {
    logger.error("Login error:", { error: error.message });
    res.status(500).json({ message: "Internal server error" });
  }
};

// ── Logout ────────────────────────────────────────────────────────────────────
export const logout = async (req, res) => {
  try {
    clearAuthCookie(res);
    logger.info(`User logged out: ${req.user?.email}`);
    res.status(200).json({ message: "Logged out successfully" });
  } catch (error) {
    logger.error("Logout error:", { error: error.message });
    res.status(500).json({ message: "Internal server error" });
  }
};

// ── Google Sign-in ────────────────────────────────────────────────────────────
// Verifies the Google ID token. Existing email → log in immediately. New email →
// do NOT create the account; tell the client to complete registration first.
export const googleAuth = async (req, res) => {
  try {
    const { credential } = req.body;
    if (!credential) return res.status(400).json({ message: "Missing Google credential." });

    let payload;
    try {
      payload = await verifyGoogleIdToken(credential);
    } catch {
      return res.status(401).json({ message: "Google sign-in failed. Please try again." });
    }

    const email = payload.email?.toLowerCase();
    if (!email || !payload.email_verified) {
      return res.status(400).json({ message: "Your Google account email is not verified." });
    }

    const user = await User.findOne({ email });

    if (user) {
      if (!user.isActive) return res.status(403).json({ message: "Account is deactivated" });
      // Link the Google identity to an existing (e.g. local) account on first use.
      let changed = false;
      if (!user.googleId) { user.googleId = payload.sub; changed = true; }
      if (!user.profilePic && payload.picture) { user.profilePic = payload.picture; changed = true; }
      if (!user.emailVerified) { user.emailVerified = true; changed = true; }
      if (changed) await user.save();

      const token = generateToken(user._id, user.role, res);
      logger.info(`Google login: ${email}`);
      return res.status(200).json(authResponse(user, token));
    }

    // New user — registration must be completed (role + role fields) first.
    return res.status(200).json({
      needsRegistration: true,
      profile: {
        email,
        fullName:   payload.name || "",
        profilePic: payload.picture || "",
      },
    });
  } catch (error) {
    logger.error("googleAuth error:", { error: error.message });
    res.status(500).json({ message: "Internal server error" });
  }
};

// ── Complete Google Registration ──────────────────────────────────────────────
// Re-verifies the Google token (never trusts the client), then creates the
// account with the chosen role + role-specific fields.
export const googleRegister = async (req, res) => {
  try {
    const {
      credential, role, fullName,
      studentIDnum, yearLevel, course,
      specialization,
      department, facultyId,
    } = req.body;

    if (!credential) return res.status(400).json({ message: "Missing Google credential." });

    let payload;
    try {
      payload = await verifyGoogleIdToken(credential);
    } catch {
      return res.status(401).json({ message: "Google sign-in expired. Please sign in again." });
    }

    const email = payload.email?.toLowerCase();
    if (!email || !payload.email_verified) {
      return res.status(400).json({ message: "Your Google account email is not verified." });
    }

    // Already registered (e.g. a double submit) → just log in.
    const existing = await User.findOne({ email });
    if (existing) {
      const token = generateToken(existing._id, existing.role, res);
      return res.status(200).json(authResponse(existing, token));
    }

    if (!["student", "counselor", "faculty"].includes(role)) {
      return res.status(400).json({ message: "Please choose a valid role." });
    }

    const name = (fullName || payload.name || "").trim();
    if (name.length < 2) return res.status(400).json({ message: "Full name is required." });

    // Role-specific required fields (mirrors local signup rules).
    if (role === "student" && (!studentIDnum || !yearLevel || !course)) {
      return res.status(400).json({ message: "Students must provide a Student ID, year level, and course." });
    }
    if (role === "counselor" && !specialization?.trim()) {
      return res.status(400).json({ message: "Counselors must provide a specialization." });
    }
    if (role === "faculty" && !department?.trim()) {
      return res.status(400).json({ message: "Faculty must provide a department." });
    }

    const newUser = new User({
      email,
      fullName: name,
      provider: "google",
      googleId: payload.sub,
      emailVerified: true,
      profilePic: payload.picture || "",
      role,
      ...(role === "student"   && { studentIDnum, yearLevel, course }),
      ...(role === "counselor" && { specialization: specialization.trim() }),
      ...(role === "faculty"   && { department: department.trim(), facultyId: facultyId?.trim() }),
    });

    await newUser.save();
    const token = generateToken(newUser._id, newUser.role, res);
    logger.info(`Google registration: ${email} (${role})`);
    return res.status(201).json(authResponse(newUser, token));
  } catch (error) {
    if (error.code === 11000) {
      const field = Object.keys(error.keyValue || {})[0] || "field";
      const label = field === "studentIDnum" ? "Student ID" : field === "facultyId" ? "Faculty ID" : field;
      return res.status(400).json({ message: `That ${label} is already in use.` });
    }
    logger.error("googleRegister error:", { error: error.message });
    res.status(500).json({ message: "Internal server error" });
  }
};

// ── Update Profile Picture ────────────────────────────────────────────────────
export const updateProfile = async (req, res) => {
  try {
    const { profilePic } = req.body;
    if (!profilePic) return res.status(400).json({ message: "Profile picture is required" });
    if (!profilePic.startsWith("data:image/")) {
      return res.status(400).json({ message: "Invalid image format" });
    }

    const uploadResponse = await cloudinary.uploader.upload(profilePic, {
      folder: "mkd-guidance/profiles",
      transformation: [{ width: 400, height: 400, crop: "fill", gravity: "face" }],
    });

    if (req.user.profilePic) {
      const oldPublicId = req.user.profilePic.split("/").pop()?.split(".")[0];
      if (oldPublicId) {
        await cloudinary.uploader.destroy(`mkd-guidance/profiles/${oldPublicId}`).catch(() => {});
      }
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.user._id,
      { profilePic: uploadResponse.secure_url },
      { new: true }
    ).select("-password");

    res.status(200).json(updatedUser);
  } catch (error) {
    logger.error("Update profile error:", { error: error.message });
    res.status(500).json({ message: "Internal server error" });
  }
};

// ── Update Editable Profile Details (rate limited: 2 per rolling 7 days) ──────
const PROFILE_UPDATE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const PROFILE_UPDATE_MAX = 2;
const COURSES = ["ABIS", "BSIS", "BECED", "BSED", "BHUMS"];
const YEAR_LEVELS = ["1st Year", "2nd Year", "3rd Year", "4th Year"];

// Given a (possibly stale) window, return the live remaining count + reset time.
const profileUpdateMeta = (count, windowStart) => {
  const now = Date.now();
  if (!windowStart || now - new Date(windowStart).getTime() >= PROFILE_UPDATE_WINDOW_MS) {
    return { remaining: PROFILE_UPDATE_MAX, resetAt: null };
  }
  return {
    remaining: Math.max(0, PROFILE_UPDATE_MAX - count),
    resetAt: new Date(new Date(windowStart).getTime() + PROFILE_UPDATE_WINDOW_MS),
  };
};

export const updateMyProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: "User not found" });

    // Reset the window if a full 7 days have elapsed since it started.
    const now = Date.now();
    let windowStart = user.profileUpdateWindowStart;
    let count = user.profileUpdateCount || 0;
    if (!windowStart || now - new Date(windowStart).getTime() >= PROFILE_UPDATE_WINDOW_MS) {
      windowStart = null;
      count = 0;
    }

    // Build a whitelisted set of updates based on the user's role.
    const updates = {};
    const { fullName } = req.body;

    if (fullName !== undefined) {
      const trimmed = String(fullName).trim();
      if (trimmed.length < 2 || trimmed.length > 100) {
        return res.status(400).json({ message: "Full name must be 2–100 characters." });
      }
      if (!/^[\p{L}\s'-]+$/u.test(trimmed)) {
        return res.status(400).json({ message: "Full name contains invalid characters." });
      }
      updates.fullName = trimmed;
    }

    if (user.role === "student") {
      const { studentIDnum, course, yearLevel } = req.body;
      if (studentIDnum !== undefined) {
        const v = String(studentIDnum).trim();
        if (!v) return res.status(400).json({ message: "Student ID is required." });
        if (v.length > 20) return res.status(400).json({ message: "Student ID is too long." });
        updates.studentIDnum = v;
      }
      if (course !== undefined) {
        if (!COURSES.includes(course)) return res.status(400).json({ message: "Invalid course." });
        updates.course = course;
      }
      if (yearLevel !== undefined) {
        if (!YEAR_LEVELS.includes(yearLevel)) return res.status(400).json({ message: "Invalid year level." });
        updates.yearLevel = yearLevel;
      }
    } else if (user.role === "faculty") {
      const { facultyId, department } = req.body;
      if (facultyId !== undefined) {
        const v = String(facultyId).trim();
        if (v.length > 20) return res.status(400).json({ message: "Faculty ID is too long." });
        updates.facultyId = v;
      }
      if (department !== undefined) {
        const v = String(department).trim();
        if (!v) return res.status(400).json({ message: "Department is required." });
        updates.department = v;
      }
    } else if (user.role === "counselor") {
      const { specialization } = req.body;
      if (specialization !== undefined) {
        const v = String(specialization).trim();
        if (!v) return res.status(400).json({ message: "Specialization is required." });
        updates.specialization = v;
      }
    }

    // Only count this against the limit if something actually changed.
    const changedKeys = Object.keys(updates).filter((k) => (user[k] ?? "") !== updates[k]);

    if (changedKeys.length === 0) {
      const meta = profileUpdateMeta(count, windowStart);
      const safe = await User.findById(user._id).select("-password -failedLoginAttempts -lockUntil");
      return res.status(200).json({
        ...safe.toObject(),
        profileUpdatesRemaining: meta.remaining,
        profileUpdateResetAt: meta.resetAt,
        unchanged: true,
      });
    }

    // Enforce the 2-per-window limit. Returned as 400 (not 429) so the client's
    // global interceptor doesn't show a generic rate-limit toast/logout.
    if (count >= PROFILE_UPDATE_MAX) {
      const resetAt = new Date(new Date(windowStart).getTime() + PROFILE_UPDATE_WINDOW_MS);
      return res.status(400).json({
        message: `You've reached the limit of ${PROFILE_UPDATE_MAX} profile updates this week.`,
        resetAt,
        limitReached: true,
      });
    }

    Object.assign(user, updates);
    user.profileUpdateWindowStart = windowStart || new Date(now);
    user.profileUpdateCount = count + 1;
    await user.save();

    const meta = profileUpdateMeta(user.profileUpdateCount, user.profileUpdateWindowStart);
    const safe = await User.findById(user._id).select("-password -failedLoginAttempts -lockUntil");
    logger.info(`Profile updated: ${user.email} (${changedKeys.join(", ")})`);
    return res.status(200).json({
      ...safe.toObject(),
      profileUpdatesRemaining: meta.remaining,
      profileUpdateResetAt: meta.resetAt,
    });
  } catch (error) {
    if (error.code === 11000) {
      const field = Object.keys(error.keyValue || {})[0] || "field";
      const label = field === "studentIDnum" ? "Student ID" : field === "facultyId" ? "Faculty ID" : field;
      return res.status(400).json({ message: `That ${label} is already in use.` });
    }
    logger.error("updateMyProfile error:", { error: error.message });
    res.status(500).json({ message: "Internal server error" });
  }
};

// ── Change Password ───────────────────────────────────────────────────────────
export const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;

    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({ message: "All password fields are required." });
    }
    if (newPassword !== confirmPassword) {
      return res.status(400).json({ message: "New password and confirmation do not match." });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ message: "New password must be at least 8 characters." });
    }
    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(newPassword)) {
      return res.status(400).json({ message: "New password must contain an uppercase letter, a lowercase letter, and a number." });
    }

    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: "User not found" });

    // Google-only accounts have no password to change.
    if (!user.password) {
      return res.status(400).json({ message: "Your account uses Google sign-in, so there's no password to change." });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      // 400 (not 401) so the client doesn't treat a wrong current password as
      // an expired session and force a logout/redirect.
      return res.status(400).json({ message: "Current password is incorrect." });
    }

    const sameAsOld = await bcrypt.compare(newPassword, user.password);
    if (sameAsOld) {
      return res.status(400).json({ message: "New password must be different from your current password." });
    }

    user.password = await bcrypt.hash(newPassword, 12);
    // Backdate slightly so the freshly-issued token below stays valid while
    // every previously-issued token (other devices) is invalidated.
    user.passwordChangedAt = new Date(Date.now() - 1000);
    await user.save();

    // Re-issue a token for THIS device so the current session stays alive.
    const token = generateToken(user._id, user.role, res);

    logger.info(`Password changed: ${user.email}`);
    res.status(200).json({
      message: "Password changed successfully. You've been logged out on all other devices.",
      token,
    });
  } catch (error) {
    logger.error("changePassword error:", { error: error.message });
    res.status(500).json({ message: "Internal server error" });
  }
};

// ── Record Privacy Consent (Data Privacy Act of 2012) ─────────────────────────
export const updatePrivacyConsent = async (req, res) => {
  try {
    const { hideReminder } = req.body;

    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: "User not found" });

    user.privacyConsentAccepted = true;
    user.privacyConsentDate = new Date();
    user.privacyConsentCount = (user.privacyConsentCount || 0) + 1;
    if (hideReminder === true) user.hidePrivacyReminder = true;
    await user.save();

    const safe = await User.findById(user._id).select("-password -failedLoginAttempts -lockUntil");
    res.status(200).json(safe);
  } catch (error) {
    logger.error("updatePrivacyConsent error:", { error: error.message });
    res.status(500).json({ message: "Internal server error" });
  }
};

// ── Forgot Password ───────────────────────────────────────────────────────────
export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "Email is required." });

    const user = await User.findOne({ email: String(email).toLowerCase().trim() });

    // Always respond identically to avoid leaking which emails are registered.
    if (user) {
      const token = await issueCode(user._id, "password_reset");
      const base = (process.env.CLIENT_URL || "http://localhost:5173").split(",")[0].trim();
      const resetUrl = `${base}/reset-password?uid=${user._id}&token=${token}`;
      sendPasswordResetEmail({ to: user.email, name: user.fullName, resetUrl }).catch((e) =>
        logger.error("Password reset email failed", { error: e.message }));
      logger.info(`Password reset requested: ${user.email}`);
    }

    res.status(200).json({
      message: "If an account exists for that email, a password reset link has been sent.",
    });
  } catch (error) {
    logger.error("forgotPassword error:", { error: error.message });
    res.status(500).json({ message: "Internal server error" });
  }
};

// ── Reset Password ────────────────────────────────────────────────────────────
export const resetPassword = async (req, res) => {
  try {
    const { uid, token, newPassword, confirmPassword } = req.body;

    if (!uid || !token || !newPassword || !confirmPassword) {
      return res.status(400).json({ message: "All fields are required." });
    }
    if (!mongoose.isValidObjectId(uid)) {
      return res.status(400).json({ message: "This reset link is invalid." });
    }
    if (newPassword !== confirmPassword) {
      return res.status(400).json({ message: "Passwords do not match." });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ message: "Password must be at least 8 characters." });
    }
    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(newPassword)) {
      return res.status(400).json({ message: "Password must contain an uppercase letter, a lowercase letter, and a number." });
    }

    const result = await verifyCode(uid, "password_reset", token);
    if (!result.ok) {
      const msg = result.reason === "expired"
        ? "This reset link has expired. Please request a new one."
        : "This reset link is invalid or has already been used.";
      return res.status(400).json({ message: msg });
    }

    const user = await User.findById(uid);
    if (!user) return res.status(400).json({ message: "This reset link is invalid." });

    user.password = await bcrypt.hash(newPassword, 12);
    // Invalidate every existing session (logout all devices).
    user.passwordChangedAt = new Date(Date.now() - 1000);
    await user.save();

    logger.info(`Password reset completed: ${user.email}`);
    res.status(200).json({ message: "Password reset successful. You can now log in with your new password." });
  } catch (error) {
    logger.error("resetPassword error:", { error: error.message });
    res.status(500).json({ message: "Internal server error" });
  }
};

// ── Send Email Verification OTP ───────────────────────────────────────────────
export const sendEmailOtp = async (req, res) => {
  try {
    if (req.user.emailVerified) {
      return res.status(400).json({ message: "Your email is already verified." });
    }
    const code = await issueCode(req.user._id, "email_verification");
    sendOtpEmail({ to: req.user.email, name: req.user.fullName, code, purpose: "email_verification" })
      .catch((e) => logger.error("Verification email failed", { error: e.message }));
    res.status(200).json({ message: "A verification code has been sent to your email." });
  } catch (error) {
    logger.error("sendEmailOtp error:", { error: error.message });
    res.status(500).json({ message: "Internal server error" });
  }
};

// ── Verify Email (OTP) ────────────────────────────────────────────────────────
export const verifyEmail = async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) return res.status(400).json({ message: "Verification code is required." });

    if (req.user.emailVerified) {
      const safe = await User.findById(req.user._id).select("-password -failedLoginAttempts -lockUntil");
      return res.status(200).json(safe);
    }

    const result = await verifyCode(req.user._id, "email_verification", String(code).trim());
    if (!result.ok) {
      const msg = result.reason === "expired"
        ? "This code has expired. Please request a new one."
        : result.reason === "too_many_attempts"
          ? "Too many incorrect attempts. Please request a new code."
          : "Incorrect verification code.";
      return res.status(400).json({ message: msg });
    }

    await User.findByIdAndUpdate(req.user._id, { emailVerified: true });
    const safe = await User.findById(req.user._id).select("-password -failedLoginAttempts -lockUntil");
    logger.info(`Email verified: ${req.user.email}`);
    res.status(200).json(safe);
  } catch (error) {
    logger.error("verifyEmail error:", { error: error.message });
    res.status(500).json({ message: "Internal server error" });
  }
};

// ── Check Auth ────────────────────────────────────────────────────────────────
export const checkAuth = async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .select("-password -failedLoginAttempts -lockUntil");
    if (!user) return res.status(404).json({ message: "User not found" });
    res.status(200).json(user);
  } catch (error) {
    logger.error("checkAuth error:", { error: error.message });
    res.status(500).json({ message: "Internal server error" });
  }
};

// ── Get Users by Role ─────────────────────────────────────────────────────────
export const getUsersByRole = async (req, res) => {
  try {
    const { role } = req.query;
    if (!["student", "counselor", "faculty"].includes(role)) {
      return res.status(400).json({ message: "Invalid role query" });
    }

    // RBAC: students may only look up counselors (needed to book an appointment).
    // They must never be able to enumerate other students or faculty, which would
    // expose emails and student IDs and violate the project's data-privacy scope.
    if (req.user.role === "student" && role !== "counselor") {
      return res.status(403).json({ message: "Access denied" });
    }

    const selectFields = {
      student:  "_id fullName email profilePic course yearLevel studentIDnum",
      counselor:"_id fullName email profilePic specialization presenceStatus presenceNote presenceUpdatedAt",
      faculty:  "_id fullName email profilePic department facultyId",
    };

    const users = await User.find({ role, isActive: true })
      .select(selectFields[role])
      .sort({ fullName: 1 });

    res.json(users);
  } catch (error) {
    logger.error("getUsersByRole error:", { error: error.message });
    res.status(500).json({ message: "Internal server error" });
  }
};