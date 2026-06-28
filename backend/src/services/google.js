// services/google.js
//
// Verifies Google Identity Services ID tokens (the `credential` returned by the
// frontend Google button) using google-auth-library. We never trust the
// client's decoded claims — the token's signature + audience are validated
// against Google here on every call.

import { OAuth2Client } from "google-auth-library";

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

/**
 * Verify a Google ID token and return its payload, or throw if invalid.
 * Payload includes: sub, email, email_verified, name, picture, ...
 */
export const verifyGoogleIdToken = async (idToken) => {
  const ticket = await client.verifyIdToken({
    idToken,
    audience: process.env.GOOGLE_CLIENT_ID,
  });
  return ticket.getPayload();
};
