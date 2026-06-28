// services/socket.js
import jwt from "jsonwebtoken";
import User from "../models/user.model.js";
import logger from "../lib/logger.js";
import {
  setPresenceBroadcaster, initPresence,
  presenceConnect, presenceDisconnect, presenceIdle, presenceActive,
} from "./presence.service.js";

const userSockets = new Map(); // userId -> socket
let ioInstance;

export const initializeSocketIO = (io) => {
  ioInstance = io;

  // Wire automatic counselor presence to the socket lifecycle.
  setPresenceBroadcaster(emitBroadcast);
  initPresence();

  // ── Authentication middleware ────────────────────────────────────────────────
  io.use(async (socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization?.split(" ")[1];

      if (!token) return next(new Error("Authentication error: No token"));

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.userId).select("-password");
      if (!user) return next(new Error("Authentication error: User not found"));

      // Reject reconnections made with a token issued before the last password
      // change (keeps socket auth consistent with protectRoute).
      if (user.passwordChangedAt && decoded.iat) {
        const changedAtSec = Math.floor(user.passwordChangedAt.getTime() / 1000);
        if (decoded.iat < changedAtSec) return next(new Error("Authentication error: session expired"));
      }

      socket.user = {
        id: user._id.toString(),
        role: user.role,
        fullName: user.fullName,
      };
      next();
    } catch (error) {
      logger.warn("Socket auth error:", { error: error.message });
      next(new Error("Authentication error"));
    }
  });

  // ── Connection handler ───────────────────────────────────────────────────────
  io.on("connection", (socket) => {
    const { id, role, fullName } = socket.user;
    logger.info(`Socket connected: ${fullName} (${role})`);

    userSockets.set(id, socket);
    socket.join(`user:${id}`);

    socket.emit("connected", {
      message: "Connected to MKD Guidance socket server",
      user: { id, role, fullName },
    });

    setupAppointmentEvents(socket);
    setupNotificationEvents(socket);

    // ── Automatic presence ──────────────────────────────────────────────────
    presenceConnect(id, socket.id, role);
    socket.on("presence:idle",   () => presenceIdle(id, role));
    socket.on("presence:active", () => presenceActive(id, role));

    socket.on("disconnect", () => {
      logger.info(`Socket disconnected: ${fullName}`);
      userSockets.delete(id);
      presenceDisconnect(id, socket.id, role);
    });
  });
};

// ── Appointment socket events ─────────────────────────────────────────────────
const setupAppointmentEvents = (socket) => {
  socket.on(
    "appointment:statusUpdate",
    ({ appointmentId, status, studentId, counselorId }) => {
      emitToUser(studentId, "appointment:statusUpdated", { appointmentId, status });
      emitToUser(counselorId, "appointment:statusUpdated", { appointmentId, status });
    },
  );

  socket.on(
    "appointment:reschedule",
    ({ appointmentId, newDetails, studentId, counselorId }) => {
      emitToUser(studentId, "appointment:rescheduled", { appointmentId, newDetails });
      emitToUser(counselorId, "appointment:rescheduled", { appointmentId, newDetails });
    },
  );

  socket.on(
    "appointment:cancel",
    ({ appointmentId, reason, studentId, counselorId }) => {
      emitToUser(studentId, "appointment:cancelled", { appointmentId, reason });
      emitToUser(counselorId, "appointment:cancelled", { appointmentId, reason });
    },
  );
};

// ── Notification socket events ────────────────────────────────────────────────
const setupNotificationEvents = (socket) => {
  socket.on("notification:markAsRead", ({ notificationId }) => {
    socket.emit("notification:marked", { notificationId, isRead: true });
  });
};

// ── Utility exports ───────────────────────────────────────────────────────────
const emitToUser = (userId, event, data) => {
  if (!userId) return false;
  const userSocket = userSockets.get(userId.toString());
  if (userSocket) {
    userSocket.emit(event, data);
    return true;
  }
  return false;
};

export const emitSocketEvent = (userId, event, data) =>
  emitToUser(userId, event, data);

export const emitNotificationEvent = (userId, type, data) => {
  if (!ioInstance) return false;
  ioInstance.to(`user:${userId}`).emit(`notification:${type}`, data);
  ioInstance.to(`user:${userId}`).emit("notification:new", { type, ...data });
  return true;
};

export const emitBroadcast = (event, data) => {
  if (!ioInstance) return false;
  ioInstance.emit(event, data);
  return true;
};