import assert from "node:assert/strict";
import test from "node:test";
import { actionTiming } from "../src/utils/actionTiming.ts";

const now = new Date(2026, 9, 9, 12).getTime();
test("timeline uses Today, Tomorrow, Next for days 2–6 and Upcoming from day 7", () => {
  assert.equal(actionTiming("2026-10-09", now), "Today");
  assert.equal(actionTiming("2026-10-10", now), "Tomorrow");
  assert.equal(actionTiming("2026-10-11", now), "Next");
  assert.equal(actionTiming("2026-10-13", now), "Next");
  assert.equal(actionTiming("2026-10-15", now), "Next");
  assert.equal(actionTiming("2026-10-16", now), "Upcoming");
  assert.equal(actionTiming("2026-10-22", now), "Upcoming");
  assert.equal(actionTiming("2026-10-23", now), "Upcoming");
});
test("missing/invalid dates do not become invented deadlines and past dates remain visible", () => {
  for (const value of [undefined, null, "", "2026-02-30", "2026-13-01", "tomorrow"])
    assert.equal(actionTiming(value, now), "Upcoming");
  assert.equal(actionTiming("2026-10-08", now), "Overdue · Oct 8th");
  assert.equal(actionTiming("2025-12-31", now), "Overdue · Dec 31st, 2025");
});
test("labels use local calendar days, including midnight, DST and year boundaries", () => {
  assert.equal(actionTiming("2026-10-10", new Date(2026, 9, 9, 23, 59).getTime()), "Tomorrow");
  assert.equal(actionTiming("2026-10-10", new Date(2026, 9, 10, 0, 1).getTime()), "Today");
  assert.equal(actionTiming("2026-03-08", new Date(2026, 2, 7, 23).getTime()), "Tomorrow");
  assert.equal(actionTiming("2026-03-09", new Date(2026, 2, 7, 23).getTime()), "Next");
  assert.equal(actionTiming("2027-01-01", new Date(2026, 11, 30, 12).getTime()), "Next");
});
