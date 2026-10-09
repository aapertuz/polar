import type { MissionPlan } from "@polar/contracts";

// Date-only deadlines use the scheduling device's local calendar, recorded in
// scheduledAt's offset. Older plans have neither checkpoint dates nor this field.
export function hasValidSchedule(plan: MissionPlan): boolean {
  if (!plan.scheduledAt && plan.checkpoints.every((checkpoint) => !checkpoint.dueOn)) return true;
  if (!plan.scheduledAt) return false;
  const offset = /([+-])(\d{2}):(\d{2})$/.exec(plan.scheduledAt);
  const offsetMinutes = offset
    ? (Number(offset[2]) * 60 + Number(offset[3])) * (offset[1] === "+" ? 1 : -1)
    : 0;
  const missionDeadline = plan.deadlineAt
    ? new Date(Date.parse(plan.deadlineAt) + offsetMinutes * 60_000).toISOString().slice(0, 10)
    : null;
  let previousCheckpoint = "";
  const actionDates = new Map<string, string>();
  for (const checkpoint of plan.checkpoints) {
    if (
      !checkpoint.dueOn ||
      checkpoint.dueOn < previousCheckpoint ||
      (missionDeadline && checkpoint.dueOn > missionDeadline)
    )
      return false;
    previousCheckpoint = checkpoint.dueOn;
    let previousAction = "";
    for (const action of checkpoint.actions) {
      if (
        !action.dueOn ||
        action.dueOn > checkpoint.dueOn ||
        action.dueOn < previousAction ||
        actionDates.has(action.title) ||
        action.dependsOn.some((dependency) => {
          const prerequisite = actionDates.get(dependency);
          return !prerequisite || prerequisite > action.dueOn!;
        })
      )
        return false;
      actionDates.set(action.title, action.dueOn);
      previousAction = action.dueOn;
    }
  }
  return actionDates.size > 0;
}
