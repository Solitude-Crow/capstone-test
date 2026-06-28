// controllers/availability.controller.js
import mongoose from "mongoose";
import Availability from "../models/availability.model.js";
import { emitSocketEvent } from "../services/socket.js";
import { getHolidayName } from "../lib/phHolidays.js";
import logger from "../lib/logger.js";

const dateRange = (dateInput) => {
  const d = new Date(dateInput);
  const start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
  const end   = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59, 999));
  return mongoose.trusted({ $gte: start, $lte: end });
};

// Returns the first pair of overlapping slots, or null when all are disjoint.
// Times are "HH:MM" 24-hour strings, so lexicographic comparison is correct.
// Intervals [aStart,aEnd) and [bStart,bEnd) overlap iff aStart < bEnd && bStart < aEnd.
const findOverlap = (slots = []) => {
  const sorted = [...slots].sort((a, b) => a.startTime.localeCompare(b.startTime));
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].startTime < sorted[i - 1].endTime) {
      return [sorted[i - 1], sorted[i]];
    }
  }
  return null;
};

// ── Set Availability ──────────────────────────────────────────────────────────
export const setAvailability = async (req, res) => {
  try {
    const counselorId = req.user._id;
    const { date, availableSlots, isHoliday, holidayNote } = req.body;

    const range = dateRange(date);

    if (range.$gte < new Date(new Date().setUTCHours(0, 0, 0, 0))) {
      return res.status(400).json({ message: "Cannot set availability for past dates" });
    }

    const holiday = getHolidayName(range.$gte);
    if (holiday) {
      return res.status(400).json({
        message: `${holiday} is a Philippine holiday — the guidance office is closed on this date`,
      });
    }

    for (const slot of availableSlots || []) {
      if (slot.startTime >= slot.endTime) {
        return res.status(400).json({
          message: `Invalid slot: ${slot.startTime}–${slot.endTime} (end must be after start)`,
        });
      }
    }

    // Reject overlapping slots within the submitted set.
    const newOverlap = findOverlap(availableSlots || []);
    if (newOverlap) {
      const [a, b] = newOverlap;
      return res.status(400).json({
        message: `Overlapping time slots: ${a.startTime}–${a.endTime} and ${b.startTime}–${b.endTime}`,
      });
    }

    const existing = await Availability.findOne({ counselorId, date: range });
    let savedAvailability;

    if (existing) {
      const bookedSlots = existing.availableSlots.filter((s) => s.isBooked);
      const newUnbookedSlots = (availableSlots || []).map((s) => ({
        startTime: s.startTime,
        endTime: s.endTime,
        isBooked: false,
      }));

      // A new slot must not overlap a slot that is already booked.
      const combinedOverlap = findOverlap([...bookedSlots, ...newUnbookedSlots]);
      if (combinedOverlap) {
        const [a, b] = combinedOverlap;
        return res.status(400).json({
          message: `A new slot overlaps an already-booked slot (${a.startTime}–${a.endTime} vs ${b.startTime}–${b.endTime}).`,
        });
      }

      existing.availableSlots = [...bookedSlots, ...newUnbookedSlots];
      if (isHoliday !== undefined) existing.isHoliday = isHoliday;
      if (holidayNote) existing.holidayNote = holidayNote;
      savedAvailability = await existing.save();
    } else {
      savedAvailability = await Availability.create({
        counselorId,
        date: range.$gte,
        availableSlots: availableSlots || [],
        isHoliday: isHoliday || false,
        holidayNote: holidayNote || "",
      });
    }

    emitSocketEvent(counselorId.toString(), "availability:updated", { availability: savedAvailability });
    res.status(201).json(savedAvailability);
  } catch (error) {
    logger.error("setAvailability error:", { error: error.message });
    res.status(500).json({ message: "Server error" });
  }
};

// ── Get Counselor Availability ────────────────────────────────────────────────
export const getCounselorAvailability = async (req, res) => {
  try {
    const { counselorId, startDate, endDate } = req.query;

    if (!counselorId) {
      return res.status(400).json({ message: "counselorId is required" });
    }

    const query = { counselorId };
    if (startDate && endDate) {
      const start = new Date(startDate);
      start.setUTCHours(0, 0, 0, 0);
      const end = new Date(endDate);
      end.setUTCHours(23, 59, 59, 999);
      query.date = mongoose.trusted({ $gte: start, $lte: end });
    }

    const availabilities = await Availability.find(query).sort({ date: 1 }).lean();
    res.json(availabilities);
  } catch (error) {
    logger.error("getCounselorAvailability error:", { error: error.message });
    res.status(500).json({ message: "Server error" });
  }
};

// ── Delete Availability ───────────────────────────────────────────────────────
export const deleteAvailability = async (req, res) => {
  try {
    const { id } = req.params;
    const counselorId = req.user._id;

    const availability = await Availability.findById(id);
    if (!availability) return res.status(404).json({ message: "Availability not found" });
    if (availability.counselorId.toString() !== counselorId.toString()) {
      return res.status(403).json({ message: "Not authorized" });
    }
    if (availability.availableSlots.some((s) => s.isBooked)) {
      return res.status(400).json({ message: "Cannot delete availability with booked appointments" });
    }

    await Availability.findByIdAndDelete(id);
    res.json({ message: "Availability deleted" });
  } catch (error) {
    logger.error("deleteAvailability error:", { error: error.message });
    res.status(500).json({ message: "Server error" });
  }
};