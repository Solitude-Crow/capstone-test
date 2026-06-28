// middleware/auth.middleware.js
import jwt from "jsonwebtoken";
import User from "../models/user.model.js";
import logger from "../lib/logger.js";

export const protectRoute = async (req, res, next) => {
  try {
    const token =
      req.cookies?.jwt ||
      (req.headers.authorization?.startsWith("Bearer ")
        ? req.headers.authorization.split(" ")[1]
        : null);

    if (!token) {
      return res.status(401).json({ message: "Unauthorized – No token provided" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select("-password");

    if (!user) {
      return res.status(401).json({ message: "Unauthorized – User not found" });
    }

    if (!user.isActive) {
      return res.status(403).json({ message: "Account is deactivated" });
    }

    // Invalidate any token issued before the user's last password change.
    // This is how "log out from all devices" is enforced after a password
    // change: tokens minted earlier (other devices) fail this check.
    if (user.passwordChangedAt && decoded.iat) {
      const changedAtSec = Math.floor(user.passwordChangedAt.getTime() / 1000);
      if (decoded.iat < changedAtSec) {
        return res.status(401).json({ message: "Unauthorized – Session expired, please log in again" });
      }
    }

    req.user = user;
    req.token = token;
    next();
  } catch (error) {
    logger.warn("protectRoute error:", { error: error.message });

    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({ message: "Unauthorized – Invalid token" });
    }
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({ message: "Unauthorized – Token expired" });
    }
    res.status(500).json({ message: "Internal server error" });
  }
};