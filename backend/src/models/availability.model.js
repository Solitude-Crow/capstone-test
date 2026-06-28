// models/availability.model.js
import mongoose from "mongoose";

const slotSchema = new mongoose.Schema(
  {
    startTime: {
      type: String,
      required: true,
      match: [/^\d{2}:\d{2}$/, "Time must be in HH:MM format"],
    },
    endTime: {
      type: String,
      required: true,
      match: [/^\d{2}:\d{2}$/, "Time must be in HH:MM format"],
    },
    isBooked: {
      type: Boolean,
      default: false,
    },
    appointmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Appointment",
      default: null,
    },
  },
  { _id: true }
);

const availabilitySchema = new mongoose.Schema(
  {
    counselorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    date: {
      type: Date,
      required: true,
    },
    availableSlots: [slotSchema],
    isHoliday: {
      type: Boolean,
      default: false,
    },
    holidayNote: {
      type: String,
      maxlength: 200,
      trim: true,
    },
  },
  { timestamps: true }
);

// Compound unique index: one availability doc per counselor per date
availabilitySchema.index({ counselorId: 1, date: 1 }, { unique: true });

const Availability = mongoose.model("Availability", availabilitySchema);
export default Availability;
