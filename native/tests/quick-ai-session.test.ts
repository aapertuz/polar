import assert from "node:assert/strict";
import test from "node:test";
import {
  addQuickAiContext,
  closeQuickAiSession,
  createQuickAiSession,
  openQuickAiSession,
  removeQuickAiContext,
  updateQuickAiDraft,
} from "../src/features/quick-ai/utils/quickAiSession.ts";

test("command and new mission keep separate drafts and context", () => {
  const initial = createQuickAiSession();
  const command = openQuickAiSession(initial, "command", {
    id: "pilot",
    label: "F1 Pilot",
    kind: "mission",
  });
  const drafted = updateQuickAiDraft(command, "Move the deadline");
  const newMission = openQuickAiSession(drafted, "new-mission");
  const returned = openQuickAiSession(newMission, "command");

  assert.equal(newMission.drafts.command.text, "Move the deadline");
  assert.equal(newMission.drafts["new-mission"].text, "");
  assert.deepEqual(newMission.drafts["new-mission"].context, []);
  assert.equal(returned.drafts.command.text, "Move the deadline");
  assert.deepEqual(returned.drafts.command.context, [
    { id: "pilot", label: "F1 Pilot", kind: "mission" },
  ]);
});

test("first command entry seeds mission context even after starting in New mission", () => {
  const newMission = openQuickAiSession(createQuickAiSession(), "new-mission");
  const command = openQuickAiSession(newMission, "command", {
    id: "pilot",
    label: "F1 Pilot",
    kind: "mission",
  });
  const closed = closeQuickAiSession(command);
  const reopened = openQuickAiSession(closed, "command", {
    id: "sales",
    label: "US Sales",
    kind: "mission",
  });

  assert.deepEqual(command.drafts.command.context, [
    { id: "pilot", label: "F1 Pilot", kind: "mission" },
  ]);
  assert.deepEqual(reopened.drafts.command.context, command.drafts.command.context);
});

test("context selection adds once and removal excludes the reference", () => {
  const opened = openQuickAiSession(createQuickAiSession(), "command", {
    id: "pilot",
    label: "F1 Pilot",
    kind: "mission",
  });
  const withSource = addQuickAiContext(opened, {
    id: "brief",
    label: "Pilot brief",
    kind: "source",
  });
  const deduplicated = addQuickAiContext(withSource, {
    id: "brief",
    label: "Pilot brief",
    kind: "source",
  });
  const removed = removeQuickAiContext(deduplicated, "pilot");

  assert.deepEqual(removed.drafts.command.context, [
    { id: "brief", label: "Pilot brief", kind: "source" },
  ]);
});

test("new mission opens with an empty prompt rather than simulated content", () => {
  const opened = openQuickAiSession(createQuickAiSession(), "new-mission");
  assert.equal(opened.drafts["new-mission"].text, "");
});
