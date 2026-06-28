// lib/logger.js
import winston from "winston";

const { combine, timestamp, errors, json, colorize, simple } = winston.format;

const isProduction = process.env.NODE_ENV === "production";

const logger = winston.createLogger({
  level: isProduction ? "info" : "debug",
  format: combine(
    timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    errors({ stack: true }),
    json()
  ),
  defaultMeta: { service: "mkd-guidance-api" },
  // No file transports in production: Render's filesystem is ephemeral and the
  // platform captures stdout/stderr, so we log to the console instead.
  transports: isProduction
    ? [new winston.transports.Console()]
    : [
        new winston.transports.File({ filename: "logs/error.log", level: "error" }),
        new winston.transports.File({ filename: "logs/combined.log" }),
        new winston.transports.Console({ format: combine(colorize(), simple()) }),
      ],
});

export default logger;
