import assert from "node:assert/strict";
import test from "node:test";
import { formatPlanDate } from "../src/features/missions/utils/planDates.ts";

test("plan deadlines retain exact calendar dates regardless of the viewing time zone", () => {
  assert.equal(formatPlanDate("2026-10-09"), "Oct 9, 2026");
  assert.equal(formatPlanDate("2027-01-01"), "Jan 1, 2027");
  assert.equal(formatPlanDate("2028-02-29"), "Feb 29, 2028");
  for (const date of [null, undefined, "", "2026-02-30", "2026-13-01", "2026-10-9"])
    assert.equal(formatPlanDate(date), "");
});
