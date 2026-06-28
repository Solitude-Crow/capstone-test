// routes/reports.route.js
import express from "express";
import { getFullReport } from "../controllers/reports.controller.js";
import { protectRoute } from "../middleware/auth.middleware.js";
import { counselorOnly } from "../middleware/counselorOnly.js";

const router = express.Router();
router.use(protectRoute);

router.get("/", counselorOnly, getFullReport);

export default router;
