// services/presence.service.js
//
// Automatic counselor presence. Effective status is DERIVED from live inputs
// rather than set manually:
//
//   on_leave (manual, sticky)  >  in_session  >  offline (disconnected)
//        >  away (idle 10 min)  >  available (connected & active)
//
// Inputs:
//   • socket connect/disconnect  → online/offline
//   • client idle/active events  → away/online
//   • accepted-appointment sweep → in_session
//
// `on_leave` is the only manual status (set via PresenceStatusPicker) and is
// never auto-overridden until the counselor clears it.

import mongoose from "mongoose";
import User from "../models/user.model.js";
import Appointment from "../models/appointment.model.js";
import logger from "../lib/logger.js";

// Broadcast fn injected by socket.js (avoids a circular import).
let broadcast = () => {};
export const setPresenceBroadcaster = (fn) => { broadcast = fn; };

// In-memory inputs (counselors only), keyed by string userId.
const connections = new Map(); // userId -> Set<socketId>
const idleUsers   = new Set(); // userIds currently idle
const inSession    = new Set(); // userIds currently within an accepted appointment

const derive = (id, currentStatus) => {
  if (currentStatus === "on_leave") return "on_leave"; // sticky manual override
  if (inSession.has(id)) return "in_session";
  const connected = (connections.get(id)?.size ?? 0) > 0;
  if (!connected) return "offline";
  if (idleUsers.has(id)) return "away";
  return "available";
};

// Persist + broadcast only when the derived status actually changes.
const apply = async (id) => {
  try {
    const user = await User.findById(id).select("role presenceStatus presenceNote");
    if (!user || user.role !== "counselor") return;

    const next = derive(id, user.presenceStatus);
    if (next === user.presenceStatus) return;

    user.presenceStatus = next;
    user.presenceUpdatedAt = new Date();
    await user.save();

    broadcast("counselor:presenceUpdated", {
      counselorId: user._id,
      presenceStatus: next,
      presenceNote: user.presenceNote,
      presenceUpdatedAt: user.presenceUpdatedAt,
    });
    logger.info(`Presence(auto): counselor ${id} → ${next}`);
  } catch (e) {
    logger.warn("presence apply failed", { error: e.message, id });
  }
};

export const presenceConnect = async (userId, socketId, role) => {
  if (role !== "counselor") return;
  const id = String(userId);
  if (!connections.has(id)) connections.set(id, new Set());
  connections.get(id).add(socketId);
  idleUsers.delete(id); // a fresh connection means they're active
  await apply(id);
};

export const presenceDisconnect = async (userId, socketId, role) => {
  if (role !== "counselor") return;
  const id = String(userId);
  const set = connections.get(id);
  if (set) {
    set.delete(socketId);
    if (set.size === 0) {
      connections.delete(id);
      idleUsers.delete(id);
    }
  }
  await apply(id);
};

export const presenceIdle = async (userId, role) => {
  if (role !== "counselor") return;
  const id = String(userId);
  idleUsers.add(id);
  await apply(id);
};

export const presenceActive = async (userId, role) => {
  if (role !== "counselor") return;
  const id = String(userId);
  idleUsers.delete(id);
  await apply(id);
};

// Called when a counselor manually clears On Leave → resume automatic status.
export const recomputePresence = async (userId) => {
  await apply(String(userId));
};

// Flag counselors currently within an accepted appointment's time window.
// Compares against local time; appointment date carries the calendar day and
// startTime/endTime ("HH:MM") set the window via setHours (local).
const sweepInSession = async () => {
  try {
    const now = new Date();
    const dayMs = 24 * 60 * 60 * 1000;
    const appts = await Appointment.find({
      status: "accepted",
      date: mongoose.trusted({ $gte: new Date(now.getTime() - dayMs), $lte: new Date(now.getTime() + dayMs) }),
    })
      .select("counselorId date startTime endTime")
      .lean();

    const active = new Set();
    for (const a of appts) {
      const [sh, sm] = a.startTime.split(":").map(Number);
      const [eh, em] = a.endTime.split(":").map(Number);
      const s = new Date(a.date); s.setHours(sh, sm, 0, 0);
      const e = new Date(a.date); e.setHours(eh, em, 0, 0);
      if (s <= now && now < e) active.add(String(a.counselorId));
    }

    // Everyone entering or leaving "in session" needs a recompute.
    const changed = new Set([...active, ...inSession]);
    inSession.clear();
    for (const id of active) inSession.add(id);
    for (const id of changed) await apply(id);
  } catch (e) {
    logger.warn("presence sweep failed", { error: e.message });
  }
};

let sweepTimer = null;

export const initPresence = async () => {
  // On boot, clear any stale presence left over from a previous run
  // (everything except a deliberate On Leave).
  try {
    await User.updateMany(
      { role: "counselor", presenceStatus: mongoose.trusted({ $ne: "on_leave" }) },
      { $set: { presenceStatus: "offline", presenceUpdatedAt: new Date() } },
    );
  } catch (e) {
    logger.warn("presence init reset failed", { error: e.message });
  }
  if (!sweepTimer) {
    sweepTimer = setInterval(sweepInSession, 60 * 1000);
    sweepInSession();
  }
};
