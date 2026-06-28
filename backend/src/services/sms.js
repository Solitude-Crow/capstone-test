// services/sms.js
//
// SMS sending seam. No provider is wired yet — drop Twilio / Vonage /
// AbstractAPI here later. The OTP layer is channel-agnostic, so adding SMS is
// just implementing this function and setting SMS_PROVIDER in the env.
// Returns a uniform result so callers never have to special-case its absence.

import logger from "../lib/logger.js";

export const sendSms = async ({ to, body }) => {
  if (!process.env.SMS_PROVIDER) {
    logger.warn("sendSms called but no SMS_PROVIDER configured — skipping", { to });
    return { success: false, skipped: true, reason: "not_configured" };
  }

  // Future: switch on process.env.SMS_PROVIDER and dispatch to the provider SDK.
  logger.info(`(stub) SMS to ${to}: ${body}`);
  return { success: false, skipped: true, reason: "not_implemented" };
};

export default sendSms;
