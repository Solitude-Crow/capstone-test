// routes/presence.route.js
import express from "express";
import { getCounselorPresence, updatePresenceStatus } from "../controllers/presence.controller.js";
import { protectRoute } from "../middleware/auth.middleware.js";
import { counselorOnly } from "../middleware/counselorOnly.js";

const router = express.Router();
router.use(protectRoute);

router.get("/",        getCounselorPresence);  // All roles — used on booking & dashboard
router.patch("/me",    counselorOnly, updatePresenceStatus);

export default router;