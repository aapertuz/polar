import assert from "node:assert/strict";
import test from "node:test";
import {
  MissionInterpreterOutputSchema,
  MissionActionUpdateSchema,
  MissionPlanSchema,
  ActionConversationMessageSchema,
  ActionEvidenceSubmissionSchema,
  WorkspaceContextSourceMutationSchema,
} from "@polar/contracts";
import {
  hasValidDependencies,
  makeChunks,
  selectChunks,
  validCitations,
  type ContextManifest,
  selectDependencyReadyAction,
} from "../src/missions.js";
import { missionContextSourceIds, withActionDeadline } from "../src/action-updates.js";

const plan = {
  name: "Prepare launch",
  outcome: "Release the new service safely.",
  successCriteria: ["The service is available to customers."],
  constraints: ["Keep the current API compatible."],
  deadlineAt: null,
  assessment: "The implementation is ready for a staged release.",
  recommendation: "Verify the production candidate before release.",
  checkpoints: [
    {
      name: "Validate",
      detail: "Confirm release readiness.",
      actions: [
        {
          title: "Run smoke checks",
          detail: "Check the main paths.",
          priority: "High" as const,
          dependsOn: [],
        },
        {
          title: "Publish release",
          detail: "Release after verification.",
          priority: "Medium" as const,
          dependsOn: ["Run smoke checks"],
        },
      ],
    },
  ],
  risks: [],
  assumptions: [],
};

test("mission proposal contract requires structured clarification and complete plan fields", () => {
  assert.equal(MissionPlanSchema.safeParse(plan).success, true);
  assert.equal(MissionPlanSchema.safeParse({ ...plan, unsupported: true }).success, false);
  assert.equal(
    MissionInterpreterOutputSchema.safeParse({
      reply: "What is the target date?",
      questions: ["What is the target date?"],
      proposal: null,
      citations: [],
    }).success,
    true,
  );
  assert.equal(
    MissionInterpreterOutputSchema.safeParse({
      reply: "Ready",
      questions: [],
      proposal: { ...plan, checkpoints: [] },
      citations: [],
    }).success,
    false,
  );
});

test("action updates validate editable fields and reject empty or duplicated assignments", () => {
  const memberId = "11111111-1111-4111-8111-111111111111";
  const sourceId = "22222222-2222-4222-8222-222222222222";
  assert.equal(
    MissionActionUpdateSchema.safeParse({
      dueOn: null,
      priority: "Low",
      assigneeIds: [memberId],
      contextSourceIds: [sourceId],
    }).success,
    true,
  );
  assert.equal(MissionActionUpdateSchema.safeParse({}).success, false);
  assert.equal(MissionActionUpdateSchema.safeParse({ dueOn: "2026-02-30" }).success, false);
  assert.equal(
    MissionActionUpdateSchema.safeParse({ assigneeIds: [memberId, memberId] }).success,
    false,
  );
  assert.equal(
    MissionActionUpdateSchema.safeParse({ contextSourceIds: [sourceId, sourceId] }).success,
    false,
  );
  assert.equal(MissionActionUpdateSchema.safeParse({ status: "completed" }).success, false);
  assert.equal(MissionActionUpdateSchema.safeParse({ priority: "Urgent" }).success, false);
  assert.equal(MissionActionUpdateSchema.safeParse({ title: "Unscoped edit" }).success, false);
});

test("action activity contracts require idempotency and constrain references", () => {
  const idempotencyKey = "33333333-3333-4333-8333-333333333333";
  assert.equal(
    ActionConversationMessageSchema.safeParse({
      content: "Verified the outcome.",
      idempotencyKey,
      conclusion: true,
    }).success,
    true,
  );
  assert.equal(
    ActionConversationMessageSchema.safeParse({ content: "Missing idempotency" }).success,
    false,
  );
  assert.equal(
    ActionEvidenceSubmissionSchema.safeParse({ kind: "text", content: "Result", idempotencyKey })
      .success,
    true,
  );
  assert.equal(
    ActionEvidenceSubmissionSchema.safeParse({
      kind: "reference",
      content: "Report",
      referenceUrl: "https://example.test/report",
      idempotencyKey,
    }).success,
    true,
  );
  assert.equal(
    ActionEvidenceSubmissionSchema.safeParse({
      kind: "reference",
      content: "Report",
      referenceUrl: "file:///private/report",
      idempotencyKey,
    }).success,
    false,
  );
  assert.equal(
    ActionEvidenceSubmissionSchema.safeParse({
      kind: "document",
      content: "Extracted report",
      referenceUrl: "https://example.test",
      idempotencyKey,
    }).success,
    false,
  );
});

test("action deadline updates modify exactly one saved plan action and preserve other fields", () => {
  const content = {
    name: "Pilot",
    sourceReferences: [{ id: "source-1" }],
    checkpoints: [
      {
        name: "Prepare",
        dueOn: "2026-10-12",
        actions: [
          { title: "Confirm venue", dueOn: "2026-10-10", detail: "Call the venue." },
          { title: "Invite team", dueOn: null, detail: "Send the invite." },
        ],
      },
      { name: "Deliver", actions: [{ title: "Run event", dueOn: "2026-10-12" }] },
    ],
  };
  const next = withActionDeadline(content, "Prepare", "Confirm venue", "2026-10-11");
  assert.ok(next?.checkpoints instanceof Array);
  const checkpoints = next.checkpoints as {
    actions: { title: string; dueOn?: string | null }[];
  }[];
  assert.equal(checkpoints[0]?.actions[0]?.dueOn, "2026-10-11");
  assert.equal(content.checkpoints[0]?.actions[0]?.dueOn, "2026-10-10");
  assert.deepEqual(missionContextSourceIds(content), ["source-1"]);
  assert.equal(withActionDeadline(content, "Missing", "Confirm venue", null), null);
});

test("proposal dependencies require known unique actions and an acyclic graph", () => {
  assert.equal(hasValidDependencies(plan), true);
  assert.equal(
    hasValidDependencies({
      ...plan,
      checkpoints: [
        {
          ...plan.checkpoints[0]!,
          actions: [
            plan.checkpoints[0]!.actions[0]!,
            { ...plan.checkpoints[0]!.actions[1]!, dependsOn: ["Missing action"] },
          ],
        },
      ],
    }),
    false,
  );
  assert.equal(
    hasValidDependencies({
      ...plan,
      checkpoints: [
        {
          ...plan.checkpoints[0]!,
          actions: [
            { ...plan.checkpoints[0]!.actions[0]!, dependsOn: ["Run smoke checks"] },
            { ...plan.checkpoints[0]!.actions[1]!, dependsOn: ["Run smoke checks"] },
          ],
        },
      ],
    }),
    false,
  );
  assert.equal(
    hasValidDependencies({
      ...plan,
      checkpoints: [
        {
          ...plan.checkpoints[0]!,
          actions: [
            plan.checkpoints[0]!.actions[0]!,
            { ...plan.checkpoints[0]!.actions[1]!, title: "Run smoke checks" },
          ],
        },
      ],
    }),
    false,
  );
});

test("next action selection never skips incomplete dependencies or falls back to blocked work", () => {
  const actions = [
    {
      id: "a",
      title: "Prepare",
      status: "upcoming",
      dependencies: [],
      dueOn: "2026-10-11",
      priority: "medium",
      position: 1,
    },
    {
      id: "b",
      title: "Release",
      status: "upcoming",
      dependencies: ["Prepare"],
      dueOn: "2026-10-10",
      priority: "high",
      position: 2,
    },
  ];
  assert.equal(selectDependencyReadyAction(actions)?.id, "a");
  assert.equal(selectDependencyReadyAction([actions[1]!]), null);
  assert.equal(
    selectDependencyReadyAction([{ ...actions[0]!, status: "completed" }, actions[1]!])?.id,
    "b",
  );
});

test("workspace excerpts are relevance-ranked, bounded, and repeatable", () => {
  const sourceId = "11111111-1111-4111-8111-111111111111";
  const source = makeChunks(
    "workspace",
    sourceId,
    2,
    "Unrelated staffing history.\n\nThe launch requires a customer pilot and a rollback owner.",
    "Launch policy",
    "a".repeat(64),
    "note",
  );
  const first = selectChunks([source], "customer pilot rollback", 65);
  const second = selectChunks([source], "customer pilot rollback", 65);
  assert.deepEqual(
    first.map(({ excerptId, text }) => ({ excerptId, text })),
    second.map(({ excerptId, text }) => ({ excerptId, text })),
  );
  assert.equal(first.reduce((sum, chunk) => sum + chunk.text.length, 0) <= 65, true);
  assert.equal(first[0]?.text.includes("customer pilot"), true);
});

test("model citations must identify an excerpt from this scoped context manifest", () => {
  const manifest: ContextManifest = {
    schemaVersion: 1,
    workspaceId: "workspace-1",
    workspaceRevision: 3,
    audience: "workspace:workspace-1",
    requestedBy: "user-1",
    briefHash: "b".repeat(64),
    sources: [
      {
        scope: "workspace",
        id: "11111111-1111-4111-8111-111111111111",
        title: "Policy",
        revision: 2,
        contentHash: "a".repeat(64),
        excerptIds: ["policy-part-1"],
        omittedExcerptCount: 1,
        provenance: "note",
      },
    ],
  };
  assert.equal(
    validCitations(
      [
        {
          scope: "workspace",
          sourceId: manifest.sources[0]!.id,
          revision: 2,
          excerptId: "policy-part-1",
        },
      ],
      manifest,
    ),
    true,
  );
  assert.equal(
    validCitations(
      [
        {
          scope: "mission",
          sourceId: manifest.sources[0]!.id,
          revision: 2,
          excerptId: "policy-part-1",
        },
      ],
      manifest,
    ),
    false,
  );
  assert.equal(
    validCitations(
      [
        {
          scope: "workspace",
          sourceId: manifest.sources[0]!.id,
          revision: 1,
          excerptId: "policy-part-1",
        },
      ],
      manifest,
    ),
    false,
  );
  assert.equal(
    validCitations(
      [
        {
          scope: "workspace",
          sourceId: manifest.sources[0]!.id,
          revision: 2,
          excerptId: "not-supplied",
        },
      ],
      manifest,
    ),
    false,
  );
});

test("workspace source input rejects oversized notes and mismatched content fields", () => {
  const source = {
    id: "11111111-1111-4111-8111-111111111111",
    kind: "note" as const,
    title: "Policy",
    fileName: null,
    contentHash: null,
    extractedText: "Keep releases reversible.",
  };
  assert.equal(WorkspaceContextSourceMutationSchema.safeParse({ source }).success, true);
  assert.equal(
    WorkspaceContextSourceMutationSchema.safeParse({
      source: { ...source, extractedText: "x".repeat(100_001) },
    }).success,
    false,
  );
});

test("action dates validate real calendar dates while older proposals remain compatible", () => {
  const withDate = (dueOn: unknown) => ({
    ...plan,
    checkpoints: [
      { ...plan.checkpoints[0], actions: [{ ...plan.checkpoints[0]!.actions[0], dueOn }] },
    ],
  });
  assert.equal(MissionPlanSchema.safeParse(plan).success, true);
  assert.equal(MissionPlanSchema.safeParse(withDate(null)).success, true);
  assert.equal(MissionPlanSchema.safeParse(withDate("2026-10-13")).success, true);
  assert.equal(MissionPlanSchema.safeParse(withDate("2028-02-29")).success, true);
  for (const dueOn of ["Next", "2026-02-30", "2026-10-13T00:00:00Z", "2026-13-01"]) {
    assert.equal(MissionPlanSchema.safeParse(withDate(dueOn)).success, false);
  }
});
