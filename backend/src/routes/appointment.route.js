// routes/appointment.route.js
import express from "express";
import {
  createAppointment,
  getMyAppointments,
  updateAppointmentStatus,
  rescheduleAppointment,
  cancelAppointment,
  deleteAppointment,
  addFeedback,
} from "../controllers/apppointment.controller.js";
import { protectRoute } from "../middleware/auth.middleware.js";
import { studentOnly } from "../middleware/studentOnly.js";
import { counselorOnly } from "../middleware/counselorOnly.js";
import {
  createAppointmentValidator,
  updateStatusValidator,
  rescheduleValidator,
} from "../middleware/validators.js";

const router = express.Router();
router.use(protectRoute);

router.post("/", studentOnly, createAppointmentValidator, createAppointment);
router.get("/me", getMyAppointments);
router.patch("/:id/status", counselorOnly, updateStatusValidator, updateAppointmentStatus);
router.patch("/:id/reschedule", rescheduleValidator, rescheduleAppointment);
router.patch("/:id/cancel", cancelAppointment);
router.delete("/:id", deleteAppointment);
router.post("/:id/feedback", studentOnly, addFeedback);

export default router;
