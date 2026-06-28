// routes/consultationHistory.route.js
import express from "express";
import {
  getStudentConsultationHistory,
  getCounselorStudentList,
} from "../controllers/consultationHistory.controller.js";
import { protectRoute } from "../middleware/auth.middleware.js";
import { counselorOnly } from "../middleware/counselorOnly.js";

const router = express.Router();
router.use(protectRoute);
router.use(counselorOnly);

router.get("/students",          getCounselorStudentList);
router.get("/students/:studentId", getStudentConsultationHistory);

export default router;