// controllers/reports.controller.js
import mongoose from "mongoose";
import Appointment from "../models/appointment.model.js";
import Referral from "../models/referral.model.js";
import logger from "../lib/logger.js";

// ── Full dashboard analytics (Counselor only) ─────────────────────────────────
export const getFullReport = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const dateFilter = {};
    if (startDate || endDate) {
      dateFilter.createdAt = {};
      if (startDate) dateFilter.createdAt.$gte = new Date(startDate);
      if (endDate)   dateFilter.createdAt.$lte = new Date(new Date(endDate).setHours(23, 59, 59, 999));
    }

    const apptDateFilter = {};
    if (startDate || endDate) {
      apptDateFilter.date = {};
      if (startDate) apptDateFilter.date.$gte = new Date(startDate);
      if (endDate)   apptDateFilter.date.$lte = new Date(new Date(endDate).setHours(23, 59, 59, 999));
    }

    const [
      // ── Referral stats ──
      referralByStatus,
      referralByUrgency,
      referralByCategory,
      referralByDepartment,
      // ── Appointment stats ──
      appointmentByStatus,
      appointmentByType,
      monthlyAppointments,
      // ── Counselor workload ──
      counselorWorkload,
      // ── Totals ──
      totalReferrals,
      totalAppointments,
    ] = await Promise.all([
      Referral.aggregate([
        { $match: mongoose.trusted(dateFilter) },
        { $group: { _id: "$status", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      Referral.aggregate([
        { $match: mongoose.trusted(dateFilter) },
        { $group: { _id: "$urgency", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      Referral.aggregate([
        { $match: mongoose.trusted(dateFilter) },
        { $group: { _id: "$category", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      Referral.aggregate([
        { $match: mongoose.trusted(dateFilter) },
        {
          $lookup: {
            from: "users",
            localField: "facultyId",
            foreignField: "_id",
            as: "faculty",
          },
        },
        { $unwind: { path: "$faculty", preserveNullAndEmptyArrays: true } },
        {
          $group: {
            _id: { $ifNull: ["$faculty.department", "Unknown"] },
            count: { $sum: 1 },
          },
        },
        { $sort: { count: -1 } },
      ]),
      Appointment.aggregate([
        { $match: mongoose.trusted(apptDateFilter) },
        { $group: { _id: "$status", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      Appointment.aggregate([
        { $match: mongoose.trusted(apptDateFilter) },
        { $group: { _id: "$type", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      Appointment.aggregate([
        { $match: mongoose.trusted(apptDateFilter) },
        {
          $group: {
            _id: {
              year:  { $year: "$date" },
              month: { $month: "$date" },
            },
            total:     { $sum: 1 },
            completed: { $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] } },
            pending:   { $sum: { $cond: [{ $eq: ["$status", "pending"] }, 1, 0] } },
          },
        },
        { $sort: { "_id.year": 1, "_id.month": 1 } },
        { $limit: 12 },
      ]),
      Appointment.aggregate([
        { $match: mongoose.trusted(apptDateFilter) },
        {
          $group: {
            _id: "$counselorId",
            total:     { $sum: 1 },
            completed: { $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] } },
            pending:   { $sum: { $cond: [{ $eq: ["$status", "pending"] }, 1, 0] } },
          },
        },
        { $sort: { total: -1 } },
        {
          $lookup: {
            from: "users",
            localField: "_id",
            foreignField: "_id",
            as: "counselor",
          },
        },
        { $unwind: { path: "$counselor", preserveNullAndEmptyArrays: true } },
        {
          $project: {
            counselorName: "$counselor.fullName",
            total: 1,
            completed: 1,
            pending: 1,
          },
        },
      ]),
      Referral.countDocuments(dateFilter),
      Appointment.countDocuments(apptDateFilter),
    ]);

    // Compute completion rate
    const completedAppts = appointmentByStatus.find((s) => s._id === "completed")?.count ?? 0;
    const completionRate = totalAppointments > 0
      ? Math.round((completedAppts / totalAppointments) * 100)
      : 0;

    // Pending referrals count
    const pendingReferrals = referralByStatus.find((s) => s._id === "pending")?.count ?? 0;

    res.json({
      referrals: {
        total: totalReferrals,
        pending: pendingReferrals,
        byStatus: referralByStatus,
        byUrgency: referralByUrgency,
        byCategory: referralByCategory,
        byDepartment: referralByDepartment,
      },
      appointments: {
        total: totalAppointments,
        completionRate,
        byStatus: appointmentByStatus,
        byType: appointmentByType,
        monthlyTrend: monthlyAppointments,
      },
      counselorWorkload,
    });
  } catch (error) {
    logger.error("getFullReport error:", { error: error.message });
    res.status(500).json({ message: "Server error" });
  }
};
