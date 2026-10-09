import assert from "node:assert/strict";
import test from "node:test";
import { MissionPlanSchema, type MissionPlan } from "@polar/contracts";
import { hasValidSchedule } from "../src/mission-scheduling.js";

const plan: MissionPlan = {
  name: "Release portal",
  outcome: "Make the portal available.",
  successCriteria: ["Customers can sign in."],
  constraints: [],
  deadlineAt: "2026-10-15T05:00:00Z",
  scheduledAt: "2026-10-09T23:30:00-06:00",
  assessment: "Prepare rollback first.",
  recommendation: "Prepare rollback today.",
  checkpoints: [
    {
      name: "Release verified",
      detail: "Checks pass.",
      dueOn: "2026-10-11",
      actions: [
        {
          title: "Prepare rollback",
          detail: "Keep the prior version.",
          priority: "High",
          dueOn: "2026-10-09",
          dependsOn: [],
        },
        {
          title: "Run checks",
          detail: "Check the login path.",
          priority: "High",
          dueOn: "2026-10-10",
          dependsOn: ["Prepare rollback"],
        },
      ],
    },
    {
      name: "Portal released",
      detail: "Access enabled.",
      dueOn: "2026-10-14",
      actions: [
        {
          title: "Enable access",
          detail: "Open access.",
          priority: "Medium",
          dueOn: "2026-10-13",
          dependsOn: ["Run checks"],
        },
      ],
    },
  ],
  risks: [],
  assumptions: ["Dates are proposed for review."],
};

test("scheduled plans have dated checkpoints and actions in prerequisite-compatible deadline order", () => {
  assert.equal(MissionPlanSchema.safeParse(plan).success, true);
  assert.equal(hasValidSchedule(plan), true);
  const sameDay = structuredClone(plan);
  sameDay.checkpoints[0]!.actions[1]!.dueOn = "2026-10-09";
  assert.equal(hasValidSchedule(sameDay), true);
  const backward = structuredClone(sameDay);
  backward.checkpoints[0]!.actions.reverse();
  assert.equal(hasValidSchedule(backward), false);
  const unknown = structuredClone(plan);
  unknown.checkpoints[0]!.actions[0]!.dependsOn = ["Missing action"];
  assert.equal(hasValidSchedule(unknown), false);
});

test("server rejects incomplete dates, late actions and unsorted checkpoints or actions", () => {
  const invalid: MissionPlan[] = [];
  const lateAction = structuredClone(plan);
  lateAction.checkpoints[0]!.actions[1]!.dueOn = "2026-10-12";
  invalid.push(lateAction);
  const unsorted = structuredClone(plan);
  unsorted.checkpoints.reverse();
  invalid.push(unsorted);
  const missingCheckpoint = structuredClone(plan);
  missingCheckpoint.checkpoints[0]!.dueOn = null;
  invalid.push(missingCheckpoint);
  const missingAction = structuredClone(plan);
  missingAction.checkpoints[0]!.actions[0]!.dueOn = null;
  invalid.push(missingAction);
  const unsortedActions = structuredClone(plan);
  unsortedActions.checkpoints[0]!.actions[1]!.dependsOn = [];
  unsortedActions.checkpoints[0]!.actions.reverse();
  invalid.push(unsortedActions);
  const missingClock = structuredClone(plan);
  delete missingClock.scheduledAt;
  invalid.push(missingClock);
  for (const candidate of invalid) assert.equal(hasValidSchedule(candidate), false);
});

test("mission deadline bounds use the scheduling device's calendar rather than UTC", () => {
  const late = structuredClone(plan);
  late.checkpoints[1]!.dueOn = "2026-10-15";
  assert.equal(hasValidSchedule(late), false);
  const eastern = structuredClone(late);
  eastern.scheduledAt = "2026-10-09T23:30:00+06:00";
  assert.equal(hasValidSchedule(eastern), true);
});

test("legacy plans remain readable and date contracts reject impossible checkpoint dates", () => {
  const legacy = structuredClone(plan);
  delete legacy.scheduledAt;
  for (const checkpoint of legacy.checkpoints) delete checkpoint.dueOn;
  assert.equal(MissionPlanSchema.safeParse(legacy).success, true);
  assert.equal(hasValidSchedule(legacy), true);
  for (const value of ["2026-02-30", "Today", "2026-10-09T00:00:00Z", "2026-13-01"]) {
    const invalid = structuredClone(plan);
    invalid.checkpoints[0]!.dueOn = value;
    assert.equal(MissionPlanSchema.safeParse(invalid).success, false);
  }
});
