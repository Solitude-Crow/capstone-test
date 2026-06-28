// src/lib/privacyConsent.js
//
// Privacy-consent helpers backed by the server (User model). The user's
// consent state travels on the authStore `user` object (loaded via /auth/me),
// so reads are synchronous; recording an acknowledgement persists it through
// the API and updates the store so it follows the user across devices.
//
// User fields (per spec): privacyConsentAccepted, privacyConsentDate,
// hidePrivacyReminder — plus privacyConsentCount, which drives the opt-out.

import { authAPI } from '@/api'
import { useAuthStore } from '@/store/authStore'

// Acknowledgements after which the "Don't remind me again" opt-out is offered
// (spec: after two completed appointments / referrals / pre-assessments).
const DONT_REMIND_THRESHOLD = 2

/** Whether the Privacy Notice should be shown before a gated submission. */
export function shouldShowPrivacyNotice(user) {
  return !user?.hidePrivacyReminder
}

/** Whether the "Don't remind me again" opt-out should be offered yet. */
export function canOfferDontRemind(user) {
  return (user?.privacyConsentCount || 0) >= DONT_REMIND_THRESHOLD
}

/**
 * Persist a fresh acknowledgement. Updates the store optimistically for an
 * instant UX, then reconciles with the authoritative server response. Safe to
 * call without awaiting (failures keep the optimistic state and reconcile on
 * the next /auth/me).
 */
export async function recordPrivacyConsent(user, { dontRemind = false } = {}) {
  const { setUser } = useAuthStore.getState()

  // Optimistic update so this session reflects the new state immediately.
  if (user) {
    setUser({
      ...user,
      privacyConsentAccepted: true,
      privacyConsentDate: new Date().toISOString(),
      privacyConsentCount: (user.privacyConsentCount || 0) + 1,
      hidePrivacyReminder: dontRemind || user.hidePrivacyReminder || false,
    })
  }

  try {
    const { data } = await authAPI.updatePrivacyConsent({ hideReminder: dontRemind })
    if (data?._id) setUser(data) // authoritative server state (full user)
  } catch {
    // Network/API failure — keep the optimistic state; the server reconciles on
    // the next /auth/me. Worst case the notice reappears once.
  }
}
