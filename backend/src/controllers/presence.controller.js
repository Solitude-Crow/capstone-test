// controllers/presence.controller.js
import User from "../models/user.model.js";
import { emitBroadcast } from "../services/socket.js";
import { recomputePresence } from "../services/presence.service.js";
import Notification from "../models/notification.model.js";
import logger from "../lib/logger.js";

// Online / Away / In Session / Offline are AUTOMATIC. The only statuses a
// counselor sets by hand are "On Leave" and clearing it ("Available").
const MANUAL_STATUSES = ["on_leave", "available"];

const PRESENCE_LABELS = {
  available:  "Available",
  in_session: "In Session",
  away:       "Away",
  on_leave:   "On Leave",
  offline:    "Offline",
};

// ── Get all counselor presence statuses ──────────────────────────────────────
export const getCounselorPresence = async (req, res) => {
  try {
    const counselors = await User.find({ role: "counselor", isActive: true })
      .select("_id fullName profilePic specialization presenceStatus presenceUpdatedAt presenceNote")
      .lean();
    res.json(counselors);
  } catch (error) {
    logger.error("getCounselorPresence error:", { error: error.message });
    res.status(500).json({ message: "Server error" });
  }
};

// ── Update own presence status (Counselor only) ───────────────────────────────
export const updatePresenceStatus = async (req, res) => {
  try {
    const { status, note } = req.body;

    if (!MANUAL_STATUSES.includes(status)) {
      return res.status(400).json({
        message: "You can only set 'On Leave' or 'Available'. Online, Away, In Session and Offline are automatic.",
      });
    }

    const prevStatus = req.user.presenceStatus;
    const updated = await User.findByIdAndUpdate(
      req.user._id,
      {
        presenceStatus:   status,
        presenceUpdatedAt: new Date(),
        presenceNote:     note?.trim() || "",
      },
      { new: true }
    ).select("_id fullName profilePic specialization presenceStatus presenceUpdatedAt presenceNote");

    // Broadcast to all connected clients so dashboards update in real-time
    emitBroadcast("counselor:presenceUpdated", {
      counselorId:     updated._id,
      fullName:        updated.fullName,
      presenceStatus:  updated.presenceStatus,
      presenceNote:    updated.presenceNote,
      presenceUpdatedAt: updated.presenceUpdatedAt,
    });

    // Notify students on availability transitions (fire-and-forget)
    const wasUnavailable = ["away", "on_leave", "offline", "in_session"].includes(prevStatus);
    const nowUnavailable = ["away", "on_leave", "offline"].includes(status);
    const wasAvailable   = ["available", "in_session"].includes(prevStatus);

    if (status === "available" && wasUnavailable) {
      User.find({ role: "student", isActive: true }).select("_id").then(async (students) => {
        for (const s of students) {
          await Notification.create({
            userId: s._id,
            type: "counselor_available",
            message: `${updated.fullName} is now available for counseling.`,
          }).catch(() => {});
        }
      });
    } else if (nowUnavailable && wasAvailable) {
      const msg = {
        away:     `${updated.fullName} is temporarily away.`,
        on_leave: `${updated.fullName} is currently on leave.`,
        offline:  `${updated.fullName} is now offline.`,
      }[status] ?? `${updated.fullName} is currently unavailable.`;

      User.find({ role: "student", isActive: true }).select("_id").then(async (students) => {
        for (const s of students) {
          await Notification.create({
            userId: s._id,
            type: "counselor_unavailable",
            message: msg,
          }).catch(() => {});
        }
      });
    }

    // Clearing On Leave (→ Available) resumes automatic detection: re-derive
    // from live connection / idle / in-session state right away.
    if (status === "available") {
      recomputePresence(req.user._id).catch(() => {});
    }

    logger.info(`Counselor ${req.user._id} presence: ${prevStatus} → ${status}`);
    res.json(updated);
  } catch (error) {
    logger.error("updatePresenceStatus error:", { error: error.message });
    res.status(500).json({ message: "Server error" });
  }
};