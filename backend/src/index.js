// index.js
import express from "express";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import cors from "cors";
import helmet from "helmet";
import hpp from "hpp";
import morgan from "morgan";
import { createServer } from "http";
import { Server } from "socket.io";
import path from "path";
import { fileURLToPath } from "url";

import { connectDB } from "./lib/db.js";
import logger from "./lib/logger.js";

import authRoutes             from "./routes/auth.route.js";
import appointmentRoutes      from "./routes/appointment.route.js";
import availabilityRoutes     from "./routes/availability.route.js";
import notificationRoutes     from "./routes/notification.route.js";
import preAssessmentRoutes    from "./routes/preAssessment.route.js";
import referralRoutes         from "./routes/referral.route.js";
import presenceRoutes         from "./routes/presence.route.js";
import consultationHistoryRoutes from "./routes/consultationHistory.route.js";
import reportsRoutes             from "./routes/reports.route.js";

import { initializeSocketIO } from "./services/socket.js";
import { startReminderJobs }  from "./services/reminder.service.js";
import { apiLimiter }         from "./middleware/rateLimiter.js";
import { sanitizeInputs }     from "./middleware/sanitize.js";

dotenv.config();

const app = express();
const httpServer = createServer(app);

// Behind Render's TLS-terminating proxy: required so secure cookies are honoured
// and express-rate-limit reads the real client IP from X-Forwarded-For.
if (process.env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}

const allowedOrigins = (process.env.CLIENT_URL || "http://localhost:5173")
  .split(",")
  .map((o) => o.trim());

const io = new Server(httpServer, {
  cors: { origin: allowedOrigins, credentials: true, methods: ["GET", "POST"] },
  maxHttpBufferSize: 1e6,
});

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        // Google Identity Services serves its sign-in button / One Tap from
        // accounts.google.com — required now that Express serves the SPA itself.
        scriptSrc:  ["'self'", "https://accounts.google.com/gsi/client"],
        // The GSI button script injects Google Fonts <link> tags into the host
        // page, so fonts.googleapis.com (stylesheet) + fonts.gstatic.com (font
        // files) must be allowed or the browser blocks them via style-src/font-src.
        styleSrc:   ["'self'", "'unsafe-inline'", "https://accounts.google.com/gsi/style", "https://fonts.googleapis.com"],
        imgSrc:     ["'self'", "data:", "https://res.cloudinary.com", "https://*.googleusercontent.com"],
        connectSrc: ["'self'", "https://accounts.google.com/gsi/"],
        fontSrc:    ["'self'", "data:", "https://fonts.gstatic.com"],
        objectSrc:  ["'none'"],
        mediaSrc:   ["'self'"],
        frameSrc:   ["'self'", "https://accounts.google.com/gsi/"],
      },
    },
    crossOriginEmbedderPolicy: false,
  }),
);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) callback(null, true);
      else callback(new Error(`CORS blocked: ${origin}`));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  }),
);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(cookieParser());
app.use(hpp());

const stripMongoOperators = (obj) => {
  if (!obj || typeof obj !== "object") return;
  for (const key of Object.keys(obj)) {
    if (key.startsWith("$") || key.includes(".")) {
      delete obj[key];
    } else if (typeof obj[key] === "object") {
      stripMongoOperators(obj[key]);
    }
  }
};
app.use((req, _res, next) => {
  if (req.body)   stripMongoOperators(req.body);
  if (req.params) stripMongoOperators(req.params);
  next();
});

app.use(sanitizeInputs);

if (process.env.NODE_ENV !== "test") {
  app.use(
    morgan("combined", {
      stream: { write: (msg) => logger.info(msg.trim()) },
      skip:   (req) => req.url === "/api/health",
    }),
  );
}

app.use("/api", apiLimiter);

initializeSocketIO(io);

app.get("/api/health", (_req, res) => {
  res.status(200).json({
    status: "ok",
    message: "MKD Guidance API is running",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
  });
});

// ── Routes ────────────────────────────────────────────────────────────────────
app.use("/api/auth",                 authRoutes);
app.use("/api/appointments",         appointmentRoutes);
app.use("/api/availability",         availabilityRoutes);
app.use("/api/notifications",        notificationRoutes);
app.use("/api/pre-assessments",      preAssessmentRoutes);
app.use("/api/referrals",            referralRoutes);
app.use("/api/presence",             presenceRoutes);
app.use("/api/consultation-history", consultationHistoryRoutes);
app.use("/api/reports",              reportsRoutes);

// ── Serve the built React app (single-service deploy, e.g. Render) ─────────────
// In production the Vite build is served by Express from the same origin, so the
// frontend's relative "/api" and Socket.IO paths work without CORS or cross-site
// cookie issues. The Vite dev proxy still handles this during local development.
if (process.env.NODE_ENV === "production") {
  const __dirname  = path.dirname(fileURLToPath(import.meta.url));
  const clientDist = path.resolve(__dirname, "../../frontend/dist");

  app.use(express.static(clientDist));

  // SPA fallback: any non-API GET returns index.html so client-side routing works.
  app.use((req, res, next) => {
    if (req.method !== "GET" || req.path.startsWith("/api") || req.path.startsWith("/socket.io")) {
      return next();
    }
    res.sendFile(path.join(clientDist, "index.html"));
  });
}

// ── 404 ───────────────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ message: `Route ${req.method} ${req.originalUrl} not found` });
});

// ── Error handler ─────────────────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  logger.error("Unhandled error:", { error: err.message, stack: err.stack, url: req.originalUrl });
  if (err.name === "ValidationError")
    return res.status(422).json({ message: "Validation error", details: err.message });
  if (err.name === "CastError")
    return res.status(400).json({ message: "Invalid ID format" });
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || "field";
    return res.status(400).json({ message: `Duplicate value for ${field}` });
  }
  const statusCode = err.statusCode || 500;
  const message    = process.env.NODE_ENV === "production" ? "Something went wrong" : err.message;
  res.status(statusCode).json({ message });
});

// ── Shutdown ──────────────────────────────────────────────────────────────────
const shutdown = async (signal) => {
  logger.info(`Received ${signal}. Shutting down gracefully...`);
  httpServer.close(() => {
    logger.info("HTTP server closed");
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10000);
};
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT",  () => shutdown("SIGINT"));
process.on("unhandledRejection", (reason) => {
  logger.error("Unhandled rejection:", { reason: String(reason) });
});
process.on("uncaughtException", (err) => {
  logger.error("Uncaught exception:", { error: err.message });
  process.exit(1);
});

const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => {
  logger.info(`MKD Guidance server running on port ${PORT} [${process.env.NODE_ENV}]`);
  connectDB();
  startReminderJobs();
});

