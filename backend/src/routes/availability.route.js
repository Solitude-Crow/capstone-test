// routes/availability.route.js
import express from "express";
import {
  setAvailability,
  getCounselorAvailability,
  deleteAvailability,
} from "../controllers/availability.controller.js";
import { protectRoute } from "../middleware/auth.middleware.js";
import { counselorOnly } from "../middleware/counselorOnly.js";
import { setAvailabilityValidator } from "../middleware/validators.js";

const router = express.Router();
router.use(protectRoute);

router.post("/", counselorOnly, setAvailabilityValidator, setAvailability);
router.get("/", getCounselorAvailability);
router.delete("/:id", counselorOnly, deleteAvailability);

export default router;
