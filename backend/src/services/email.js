// services/email.js
import nodemailer from "nodemailer";
import logger from "../lib/logger.js";

let transporter = null;

const getTransporter = () => {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT) || 587,
      secure: parseInt(process.env.SMTP_PORT) === 465,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
      tls: {
        rejectUnauthorized: process.env.NODE_ENV === "production",
      },
    });
  }
  return transporter;
};

const sendMail = async ({ to, subject, html, text }) => {
  try {
    const t = getTransporter();
    const info = await t.sendMail({
      from: process.env.EMAIL_FROM,
      to,
      subject,
      html,
      text,
    });
    logger.info(`Email sent to ${to}: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    logger.error("Email send error:", { error: error.message, to, subject });
    return { success: false, error: error.message };
  }
};

// ─── Email Templates ──────────────────────────────────────────────────────────

export const sendAppointmentConfirmation = async ({
  to,
  studentName,
  counselorName,
  date,
  startTime,
  endTime,
  type,
}) => {
  const subject = "Appointment Confirmation – MKD Guidance Office";
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #2c5282;">MKD Guidance Office</h2>
      <p>Dear ${studentName},</p>
      <p>Your appointment has been <strong>confirmed</strong>.</p>
      <table style="border-collapse: collapse; width: 100%; margin: 16px 0;">
        <tr><td style="padding: 8px; border: 1px solid #e2e8f0;"><strong>Counselor</strong></td><td style="padding: 8px; border: 1px solid #e2e8f0;">${counselorName}</td></tr>
        <tr><td style="padding: 8px; border: 1px solid #e2e8f0;"><strong>Type</strong></td><td style="padding: 8px; border: 1px solid #e2e8f0;">${type}</td></tr>
        <tr><td style="padding: 8px; border: 1px solid #e2e8f0;"><strong>Date</strong></td><td style="padding: 8px; border: 1px solid #e2e8f0;">${new Date(date).toLocaleDateString("en-PH", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</td></tr>
        <tr><td style="padding: 8px; border: 1px solid #e2e8f0;"><strong>Time</strong></td><td style="padding: 8px; border: 1px solid #e2e8f0;">${startTime} – ${endTime}</td></tr>
      </table>
      <p>Please arrive on time. If you need to reschedule or cancel, please do so at least 24 hours in advance.</p>
      <p style="color: #718096; font-size: 12px;">This is an automated message from the MKD Guidance Office system.</p>
    </div>`;
  return sendMail({
    to,
    subject,
    html,
    text: `Appointment confirmed with ${counselorName} on ${date} at ${startTime}.`,
  });
};

export const sendAppointmentStatusUpdate = async ({
  to,
  recipientName,
  status,
  date,
  startTime,
  counselorName,
  studentName,
  notes,
}) => {
  const statusLabels = {
    accepted: "Accepted",
    rejected: "Declined",
    rescheduled: "Rescheduled",
    cancelled: "Cancelled",
    completed: "Completed",
  };
  const subject = `Appointment ${statusLabels[status] || status} – MKD Guidance Office`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #2c5282;">MKD Guidance Office</h2>
      <p>Dear ${recipientName},</p>
      <p>Your appointment status has been updated to: <strong>${statusLabels[status] || status}</strong></p>
      <p><strong>Date:</strong> ${new Date(date).toLocaleDateString("en-PH", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</p>
      <p><strong>Time:</strong> ${startTime}</p>
      ${notes ? `<p><strong>Notes:</strong> ${notes}</p>` : ""}
      <p style="color: #718096; font-size: 12px;">This is an automated message from the MKD Guidance Office system.</p>
    </div>`;
  return sendMail({
    to,
    subject,
    html,
    text: `Your appointment status: ${status}.`,
  });
};

export const sendPreAssessmentSubmitted = async ({
  to,
  counselorName,
  studentName,
  appointmentDate,
}) => {
  const subject = "New Pre-Assessment Submitted – MKD Guidance Office";
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #2c5282;">MKD Guidance Office</h2>
      <p>Dear ${counselorName},</p>
      <p>Student <strong>${studentName}</strong> has submitted a pre-assessment form for their upcoming appointment on <strong>${new Date(appointmentDate).toLocaleDateString("en-PH", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</strong>.</p>
      <p>Please log in to the system to review the pre-assessment details before the session.</p>
      <p style="color: #718096; font-size: 12px;">This is an automated message from the MKD Guidance Office system. Pre-assessment data is confidential.</p>
    </div>`;
  return sendMail({
    to,
    subject,
    html,
    text: `Student ${studentName} submitted pre-assessment for ${appointmentDate}.`,
  });
};

export const sendPasswordResetEmail = async ({ to, name, resetUrl }) => {
  const subject = "Reset your password – MKD Guidance Office";
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #2c5282;">MKD Guidance Office</h2>
      <p>Dear ${name || "there"},</p>
      <p>We received a request to reset your password. Click the button below to choose a new one. This link expires in <strong>1 hour</strong>.</p>
      <p style="margin: 24px 0;">
        <a href="${resetUrl}" style="background:#1e3a5f;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;display:inline-block;font-weight:bold;">Reset Password</a>
      </p>
      <p style="font-size:12px;color:#718096;">If the button doesn't work, copy and paste this link into your browser:<br>${resetUrl}</p>
      <p>If you didn't request this, you can safely ignore this email — your password will not change.</p>
      <p style="color: #718096; font-size: 12px;">This is an automated message from the MKD Guidance Office system.</p>
    </div>`;
  return sendMail({
    to,
    subject,
    html,
    text: `Reset your password (expires in 1 hour): ${resetUrl}`,
  });
};

export const sendOtpEmail = async ({ to, name, code, purpose = "verification" }) => {
  const action = purpose === "email_verification" ? "verify your email address" : "continue";
  const subject = "Your verification code – MKD Guidance Office";
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #2c5282;">MKD Guidance Office</h2>
      <p>Dear ${name || "there"},</p>
      <p>Use the following code to ${action}. It expires in <strong>5 minutes</strong>.</p>
      <p style="margin: 24px 0; text-align:center;">
        <span style="font-size:32px;letter-spacing:8px;font-weight:bold;color:#1e3a5f;background:#f1f5f9;padding:14px 24px;border-radius:10px;display:inline-block;">${code}</span>
      </p>
      <p>For your security, do not share this code with anyone.</p>
      <p>If you didn't request this code, you can safely ignore this email.</p>
      <p style="color: #718096; font-size: 12px;">This is an automated message from the MKD Guidance Office system.</p>
    </div>`;
  return sendMail({
    to,
    subject,
    html,
    text: `Your verification code is ${code} (expires in 5 minutes).`,
  });
};

export const sendAppointmentReminder = async ({ to, name, message, date, startTime, type }) => {
  const subject = "Appointment Reminder – MKD Guidance Office";
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #2c5282;">MKD Guidance Office</h2>
      <p>Dear ${name || "there"},</p>
      <p>${message}</p>
      ${date ? `<table style="border-collapse: collapse; width: 100%; margin: 16px 0;">
        ${type ? `<tr><td style="padding: 8px; border: 1px solid #e2e8f0;"><strong>Type</strong></td><td style="padding: 8px; border: 1px solid #e2e8f0;">${type}</td></tr>` : ""}
        <tr><td style="padding: 8px; border: 1px solid #e2e8f0;"><strong>Date</strong></td><td style="padding: 8px; border: 1px solid #e2e8f0;">${new Date(date).toLocaleDateString("en-PH", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</td></tr>
        ${startTime ? `<tr><td style="padding: 8px; border: 1px solid #e2e8f0;"><strong>Time</strong></td><td style="padding: 8px; border: 1px solid #e2e8f0;">${startTime}</td></tr>` : ""}
      </table>` : ""}
      <p>Please arrive on time. If you need to reschedule or cancel, please do so as early as possible.</p>
      <p style="color: #718096; font-size: 12px;">This is an automated reminder from the MKD Guidance Office system.</p>
    </div>`;
  return sendMail({ to, subject, html, text: message });
};

export default sendMail;
