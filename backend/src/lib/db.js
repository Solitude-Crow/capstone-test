// lib/db.js
import mongoose from "mongoose";
import logger from "./logger.js";

export const connectDB = async () => {
  try {
    mongoose.set("sanitizeFilter", true); // Prevent NoSQL injection via query selectors

    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      // These options improve security and performance
      autoIndex: process.env.NODE_ENV !== "production", // Disable autoIndex in prod
    });

    logger.info(`MongoDB Connected: ${conn.connection.host}`);

    mongoose.connection.on("error", (err) => {
      logger.error("MongoDB connection error:", err);
    });

    mongoose.connection.on("disconnected", () => {
      logger.warn("MongoDB disconnected. Attempting to reconnect...");
    });
  } catch (error) {
    logger.error("MongoDB connection failed", { error: error.message });
    process.exit(1);
  }
};
