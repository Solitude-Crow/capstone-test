// services/reminder.utils.js
// Pure helpers for the reminder scheduler (no DB / mailer) so the dedup +
// window-selection logic is unit-testable. See reminder.utils.test.js.

export const fmtDate = (d) =>
  new Date(d).toLocaleDateString("en-PH", { month: "long", day: "numeric", year: "numeric" });

export const fmtTime = (t) => {
  const [h, m] = String(t).split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hr = h % 12 || 12;
  return `${hr}:${String(m).padStart(2, "0")} ${ampm}`;
};

/**
 * Decide which single reminder is due for an accepted appointment, plus any
 * earlier windows that are now moot (should be marked sent without firing).
 *
 * @param hoursUntil hours until the appointment start
 * @param sent { twoDay, oneDay, oneHour } already-sent flags
 * @returns { dueKey: 'twoDay'|'oneDay'|'oneHour'|null, moot: string[] }
 */
export const pickDueReminder = (hoursUntil, sent = {}) => {
  const moot = [];
  if (hoursUntil <= 0) return { dueKey: null, moot };
  if (hoursUntil <= 1) {
    moot.push("twoDay", "oneDay");
    return { dueKey: sent.oneHour ? null : "oneHour", moot };
  }
  if (hoursUntil <= 24) {
    moot.push("twoDay");
    return { dueKey: sent.oneDay ? null : "oneDay", moot };
  }
  if (hoursUntil <= 48) {
    return { dueKey: sent.twoDay ? null : "twoDay", moot };
  }
  return { dueKey: null, moot };
};
