import test from "node:test";
import assert from "node:assert/strict";
import { getCountdown } from "../src/features/missions/utils/countdown.ts";
const now = Date.parse("2026-10-07T12:00:00Z");
test("countdown derives days, hours and minutes from an absolute deadline", () => {
  assert.deepEqual(getCountdown("2026-10-09T15:35:00Z", now), {
    days: 2,
    hours: 3,
    minutes: 35,
    expired: false,
  });
  assert.deepEqual(
    getCountdown("2026-10-09T09:35:00-06:00", now),
    getCountdown("2026-10-09T15:35:00Z", now),
  );
});
test("deadline calculations catch up after sleep and roll across minute/day boundaries", () => {
  const deadline = "2026-10-08T12:00:00Z";
  assert.equal(getCountdown(deadline, now)?.days, 1);
  assert.deepEqual(getCountdown(deadline, now + 60_000), {
    days: 0,
    hours: 23,
    minutes: 59,
    expired: false,
  });
  assert.deepEqual(getCountdown(deadline, now + 86_400_000 - 1), {
    days: 0,
    hours: 0,
    minutes: 1,
    expired: false,
  });
});
test("expired deadlines stay at zero; absent and invalid deadlines have no countdown", () => {
  for (const date of ["2026-10-07T12:00:00Z", "2026-10-06T12:00:00Z"]) {
    assert.deepEqual(getCountdown(date, now), { days: 0, hours: 0, minutes: 0, expired: true });
  }
  assert.equal(getCountdown(undefined, now), null);
  assert.equal(getCountdown("invalid", now), null);
});
