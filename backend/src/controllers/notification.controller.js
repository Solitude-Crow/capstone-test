// controllers/notification.controller.js
import Notification from "../models/notification.model.js";
import { emitSocketEvent } from "../services/socket.js";
import logger from "../lib/logger.js";

export const getMyNotifications = async (req, res) => {
  try {
    const userId = req.user._id;
    const { page = 1, limit = 20, unreadOnly } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const query = { userId };
    if (unreadOnly === "true") query.isRead = false;

    const [notifications, total] = await Promise.all([
      Notification.find(query)
        .populate({
          path: "appointmentId",
          select: "type date startTime endTime status",
          populate: [
            { path: "studentId", select: "fullName email" },
            { path: "counselorId", select: "fullName email" },
          ],
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Notification.countDocuments(query),
    ]);

    res.json({
      notifications,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    logger.error("getMyNotifications error:", { error: error.message });
    res.status(500).json({ message: "Server error" });
  }
};

export const getUnreadNotificationCount = async (req, res) => {
  try {
    const count = await Notification.countDocuments({ userId: req.user._id, isRead: false });
    res.json({ count });
  } catch (error) {
    logger.error("getUnreadCount error:", { error: error.message });
    res.status(500).json({ message: "Server error" });
  }
};

export const markNotificationAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const notification = await Notification.findById(id);
    if (!notification) return res.status(404).json({ message: "Notification not found" });
    if (notification.userId.toString() !== userId.toString()) {
      return res.status(403).json({ message: "Not authorized" });
    }

    notification.isRead = true;
    await notification.save();

    emitSocketEvent(userId.toString(), "notification:read", { notificationId: id });
    res.json(notification);
  } catch (error) {
    logger.error("markNotificationAsRead error:", { error: error.message });
    res.status(500).json({ message: "Server error" });
  }
};

export const markAllNotificationsAsRead = async (req, res) => {
  try {
    const userId = req.user._id;
    const result = await Notification.updateMany({ userId, isRead: false }, { isRead: true });

    emitSocketEvent(userId.toString(), "notification:allRead", { count: result.modifiedCount });
    res.json({ message: "All notifications marked as read", count: result.modifiedCount });
  } catch (error) {
    logger.error("markAllNotificationsAsRead error:", { error: error.message });
    res.status(500).json({ message: "Server error" });
  }
};

export const deleteNotification = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const notification = await Notification.findById(id);
    if (!notification) return res.status(404).json({ message: "Notification not found" });
    if (notification.userId.toString() !== userId.toString()) {
      return res.status(403).json({ message: "Not authorized" });
    }

    await Notification.findByIdAndDelete(id);
    emitSocketEvent(userId.toString(), "notification:deleted", { notificationId: id });
    res.json({ message: "Notification deleted" });
  } catch (error) {
    logger.error("deleteNotification error:", { error: error.message });
    res.status(500).json({ message: "Server error" });
  }
};
