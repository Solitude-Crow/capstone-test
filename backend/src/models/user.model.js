// models/user.model.js
import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      maxlength: 255,
      match: [/^\S+@\S+\.\S+$/, "Invalid email format"],
    },
    role: {
      type: String,
      required: true,
      enum: ["student", "counselor", "faculty"],
      default: "student",
    },
    fullName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    password: {
      type: String,
      // Required for local accounts only — Google accounts have no password.
      required: function () {
        return this.provider !== "google";
      },
      minlength: 8,
    },
    profilePic: {
      type: String,
      default: "",
    },

    // ── Auth provider ─────────────────────────────────────────────────────────
    provider: {
      type: String,
      enum: ["local", "google"],
      default: "local",
    },
    googleId: {
      type: String,
      unique: true,
      sparse: true,
    },

    // ── Student-specific ──────────────────────────────────────────────────────
    studentIDnum: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
      maxlength: 20,
    },
    yearLevel: {
      type: String,
      enum: ["1st Year", "2nd Year", "3rd Year", "4th Year", null],
      sparse: true,
    },
    course: {
      type: String,
      enum: ["ABIS", "BSIS", "BECED", "BSED", "BHUMS", null],
      sparse: true,
    },

    // ── Counselor-specific ────────────────────────────────────────────────────
    specialization: {
      type: String,
      trim: true,
      maxlength: 200,
    },
    // Real-time presence status — updated manually or by appointment triggers
    presenceStatus: {
      type: String,
      enum: ["available", "in_session", "away", "on_leave", "offline"],
      default: "offline",
    },
    presenceUpdatedAt: {
      type: Date,
    },
    presenceNote: {
      type: String,
      trim: true,
      maxlength: 200,
    },

    // ── Faculty-specific ──────────────────────────────────────────────────────
    department: {
      type: String,
      trim: true,
      maxlength: 100,
    },
    facultyId: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
      maxlength: 20,
    },

    // ── Security fields ───────────────────────────────────────────────────────
    isActive: {
      type: Boolean,
      default: true,
    },
    emailVerified: {
      type: Boolean,
      default: false,
    },
    failedLoginAttempts: {
      type: Number,
      default: 0,
    },
    lockUntil: {
      type: Date,
    },
    passwordChangedAt: {
      type: Date,
    },

    // ── Profile-update rate limiting (max 2 per rolling 7-day window) ──────────
    profileUpdateCount: {
      type: Number,
      default: 0,
    },
    profileUpdateWindowStart: {
      type: Date,
    },

    // ── Privacy consent (Data Privacy Act of 2012) ────────────────────────────
    privacyConsentAccepted: {
      type: Boolean,
      default: false,
    },
    privacyConsentDate: {
      type: Date,
    },
    // Number of acknowledgements — drives the "Don't remind me again" opt-out.
    privacyConsentCount: {
      type: Number,
      default: 0,
    },
    hidePrivacyReminder: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// Indexes
userSchema.index({ role: 1 });
userSchema.index({ role: 1, isActive: 1 });
userSchema.index({ presenceStatus: 1 });

// Virtual: is account locked?
userSchema.virtual("isLocked").get(function () {
  return this.lockUntil && this.lockUntil > Date.now();
});

// Increment failed login attempts & lock if threshold reached
userSchema.methods.incLoginAttempts = async function () {
  const MAX_ATTEMPTS = 10;
  const LOCK_DURATION = 15 * 60 * 1000;

  if (this.lockUntil && this.lockUntil < Date.now()) {
    return this.updateOne({ $set: { failedLoginAttempts: 1 }, $unset: { lockUntil: 1 } });
  }

  const updates = { $inc: { failedLoginAttempts: 1 } };
  if (this.failedLoginAttempts + 1 >= MAX_ATTEMPTS) {
    updates.$set = { lockUntil: new Date(Date.now() + LOCK_DURATION) };
  }
  return this.updateOne(updates);
};

userSchema.methods.resetLoginAttempts = function () {
  return this.updateOne({ $set: { failedLoginAttempts: 0 }, $unset: { lockUntil: 1 } });
};

const User = mongoose.model("User", userSchema);
export default User;