// services/reminder.utils.test.js
// Unit tests for reminder window-selection + dedup. Run: node --test / npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { pickDueReminder, fmtTime } from "./reminder.utils.js";

test("advance booking fires each window once, in order", () => {
  // 2 days out → twoDay
  assert.deepEqual(pickDueReminder(47, {}), { dueKey: "twoDay", moot: [] });
  // 1 day out → oneDay (and twoDay becomes moot)
  assert.deepEqual(pickDueReminder(23, { twoDay: true }), { dueKey: "oneDay", moot: ["twoDay"] });
  // 1 hour out → oneHour (twoDay+oneDay moot)
  assert.deepEqual(pickDueReminder(0.5, { twoDay: true, oneDay: true }), { dueKey: "oneHour", moot: ["twoDay", "oneDay"] });
});

test("already-sent windows are not re-fired (dedup)", () => {
  assert.equal(pickDueReminder(40, { twoDay: true }).dueKey, null);
  assert.equal(pickDueReminder(20, { oneDay: true }).dueKey, null);
  assert.equal(pickDueReminder(0.5, { oneHour: true }).dueKey, null);
});

test("last-minute booking only fires the imminent reminder, marks earlier moot", () => {
  // Booked 40 min out, nothing sent → only oneHour fires; twoDay/oneDay marked moot
  const r = pickDueReminder(0.67, {});
  assert.equal(r.dueKey, "oneHour");
  assert.deepEqual(r.moot, ["twoDay", "oneDay"]);
});

test("missed 2-day window still sends 1-day and marks 2-day moot", () => {
  // Cron was down through 48h; at 20h with nothing sent → oneDay, twoDay moot
  const r = pickDueReminder(20, {});
  assert.equal(r.dueKey, "oneDay");
  assert.deepEqual(r.moot, ["twoDay"]);
});

test("beyond 48h or already started → nothing due", () => {
  assert.deepEqual(pickDueReminder(72, {}), { dueKey: null, moot: [] });
  assert.deepEqual(pickDueReminder(0, {}), { dueKey: null, moot: [] });
  assert.deepEqual(pickDueReminder(-3, {}), { dueKey: null, moot: [] });
});

test("fmtTime formats 24h HH:MM into 12h", () => {
  assert.equal(fmtTime("08:00"), "8:00 AM");
  assert.equal(fmtTime("13:30"), "1:30 PM");
  assert.equal(fmtTime("00:05"), "12:05 AM");
  assert.equal(fmtTime("12:00"), "12:00 PM");
});
