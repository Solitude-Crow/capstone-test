// lib/phHolidays.js
//
// Philippine public holidays (regular + special non-working days).
//
// Used to block counselors from opening availability on days the guidance
// office is closed. Mirrors frontend/src/lib/phHolidays.js — keep in sync.
//
// All date math is done in UTC so it matches the UTC day-range logic used
// throughout the availability/appointment controllers (dateRange()).
//
// Coverage:
//   • Fixed-date holidays → recur every year automatically (FIXED).
//   • Holy Week + National Heroes Day → computed for ANY year (movable()).
//   • Lunar / proclamation-based holidays → listed per year in DATED; update
//     and extend as official Malacañang proclamations are published.

const pad = (n) => String(n).padStart(2, "0");

// ── Fixed-date holidays (recur every year) ──────────────────────────────────
const FIXED = {
  // Regular holidays
  "01-01": "New Year's Day",
  "04-09": "Araw ng Kagitingan",
  "05-01": "Labor Day",
  "06-12": "Independence Day",
  "11-30": "Bonifacio Day",
  "12-25": "Christmas Day",
  "12-30": "Rizal Day",
  // Special (non-working) days
  "08-21": "Ninoy Aquino Day",
  "11-01": "All Saints' Day",
  "11-02": "All Souls' Day",
  "12-08": "Immaculate Conception",
  "12-24": "Christmas Eve",
  "12-31": "Last Day of the Year",
};

// ── Year-specific movable holidays (lunar / by proclamation) ────────────────
const DATED = {
  "2025-01-29": "Chinese New Year",
  "2026-02-17": "Chinese New Year",
  "2027-02-06": "Chinese New Year",
  "2025-03-31": "Eid'l Fitr",
  "2026-03-20": "Eid'l Fitr",
  "2027-03-10": "Eid'l Fitr",
  "2025-06-07": "Eid'l Adha",
  "2026-05-27": "Eid'l Adha",
  "2027-05-17": "Eid'l Adha",
};

// ── Easter Sunday (Meeus/Jones/Butcher algorithm, Gregorian) ────────────────
function easterSunday(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31); // 3 = March, 4 = April
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day));
}

const addUTCDays = (date, n) => {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + n);
  return d;
};

const movableCache = {};
function movableHolidays(year) {
  if (movableCache[year]) return movableCache[year];
  const easter = easterSunday(year);
  const key = (d) =>
    `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;

  // National Heroes Day — last Monday of August
  const aug31 = new Date(Date.UTC(year, 7, 31));
  const offset = (aug31.getUTCDay() - 1 + 7) % 7; // 1 = Monday
  const heroes = new Date(Date.UTC(year, 7, 31 - offset));

  const map = {
    [key(addUTCDays(easter, -3))]: "Maundy Thursday",
    [key(addUTCDays(easter, -2))]: "Good Friday",
    [key(addUTCDays(easter, -1))]: "Black Saturday",
    [key(heroes)]: "National Heroes Day",
  };
  movableCache[year] = map;
  return map;
}

/**
 * Returns the holiday name for a date (UTC), or null if not a PH holiday.
 * Accepts a Date or a date string ('yyyy-MM-dd' / ISO).
 */
export function getHolidayName(input) {
  if (!input) return null;
  const date = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(date.getTime())) return null;

  const y = date.getUTCFullYear();
  const mmdd = `${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
  const ymd = `${y}-${mmdd}`;

  return movableHolidays(y)[ymd] || DATED[ymd] || FIXED[mmdd] || null;
}

/** True if the given date is a PH holiday. */
export function isHoliday(input) {
  return getHolidayName(input) !== null;
}
