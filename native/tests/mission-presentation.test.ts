import assert from "node:assert/strict";
import test from "node:test";
import {
  presentActions,
  upcomingActions,
} from "../src/features/missions/utils/actionPresentation.ts";

test("persisted action fields are presented and completed actions leave upcoming work", () => {
  const actions = presentActions(
    [
      {
        id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
        title: "Collect responses",
        detail: "Contact attendees.",
        category: "HR",
        priority: "high",
        status: "upcoming",
        dependencies: [],
        dueOn: "2026-10-12",
        assigneeIds: [
          "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        ],
        contextSourceIds: ["eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee"],
      },
      {
        id: "ffffffff-ffff-4fff-8fff-ffffffffffff",
        title: "Close the pilot",
        detail: "Review the results.",
        priority: "medium",
        status: "completed",
        dueOn: null,
      },
    ],
    "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  );

  assert.equal(actions[0]?.id, "dddddddd-dddd-4ddd-8ddd-dddddddddddd");
  assert.equal(actions[0]?.priority, "High");
  assert.equal(actions[0]?.category, "HR");
  assert.equal(actions[1]?.category, "Uncategorized");
  assert.equal(actions[0]?.dueOn, "2026-10-12");
  assert.deepEqual(actions[0]?.assigneeIds, [
    "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  ]);
  assert.deepEqual(actions[0]?.contextSourceIds, ["eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee"]);
  assert.deepEqual(actions[1]?.assigneeIds, ["bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"]);
  assert.deepEqual(
    upcomingActions(actions).map((action) => action.id),
    ["dddddddd-dddd-4ddd-8ddd-dddddddddddd"],
  );
  assert.equal(upcomingActions(actions)[0]?.category, "HR");
});
