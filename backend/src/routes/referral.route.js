// routes/referral.route.js
import express from "express";
import {
  createReferral,
  getReferrals,
  getAllReferrals,
  getReferralById,
  updateReferralStatus,
  convertReferralToAppointment,
  getReferralAnalytics,
  getCounselorSchedules,
  requestAppointmentFromReferral,
  deleteReferral,
} from "../controllers/referral.controller.js";
import { protectRoute } from "../middleware/auth.middleware.js";
import { facultyOnly } from "../middleware/facultyOnly.js";
import { counselorOnly } from "../middleware/counselorOnly.js";

const router = express.Router();
router.use(protectRoute);

router.get("/analytics",          counselorOnly, getReferralAnalytics);
router.get("/all",                counselorOnly, getAllReferrals);
router.get("/counselor-schedules",               getCounselorSchedules);
router.get("/",                                  getReferrals);
router.post("/",                  facultyOnly,   createReferral);
router.get("/:id",                               getReferralById);
router.patch("/:id/status",       counselorOnly, updateReferralStatus);
router.post("/:id/convert",       counselorOnly, convertReferralToAppointment);
router.post("/:id/request-appointment", facultyOnly, requestAppointmentFromReferral);
router.delete("/:id",                   facultyOnly, deleteReferral);

export default router;