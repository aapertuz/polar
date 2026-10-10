import assert from "node:assert/strict";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import test from "node:test";
import { eq } from "drizzle-orm";
import { createApp } from "../../src/app.js";
import { createAuth } from "../../src/auth.js";
import { getServerConfig } from "../../src/config.js";
import { createDatabase } from "../../src/db/client.js";
import { authUser } from "../../src/db/schema.js";

test("development mission flow persists context, clarification, proposal, activation, and next action", async () => {
  const config = getServerConfig(process.env);
  assert.equal(config.environment, "development");
  assert.equal(process.env.NODE_ENV, "test");
  const { db, pool } = createDatabase(config.databaseUrl);
  const app = createApp({ db, auth: createAuth(db, config), config });
  const email = `polar-mission-${randomUUID()}@example.test`;
  const origin = { origin: config.betterAuthUrl };
  try {
    const signup = await app.inject({
      method: "POST",
      url: "/api/auth/sign-up/email",
      headers: origin,
      payload: { email, password: randomBytes(24).toString("hex"), name: "Mission verification" },
    });
    assert.equal(signup.statusCode, 200);
    const token = signup.json().token as string;
    const bootstrap = await app.inject({
      method: "GET",
      url: "/api/app/bootstrap",
      headers: { authorization: `Bearer ${token}` },
    });
    assert.equal(bootstrap.statusCode, 200);
    const workspaceId = bootstrap.json().workspaces[0].id as string;
    const headers = { authorization: `Bearer ${token}`, "x-polar-workspace-id": workspaceId };
    const emptyContext = await app.inject({
      method: "GET",
      url: "/api/app/workspace-context",
      headers,
    });
    assert.equal(emptyContext.statusCode, 200, emptyContext.body);
    assert.equal(emptyContext.json().sources.length, 0);
    const brief = await app.inject({
      method: "PUT",
      url: "/api/app/workspace-context/brief",
      headers,
      payload: {
        brief: "Polar's company policy requires reversible releases and a customer pilot.",
        expectedRevision: emptyContext.json().revision,
      },
    });
    assert.equal(brief.statusCode, 200, brief.body);
    const briefRetry = await app.inject({
      method: "PUT",
      url: "/api/app/workspace-context/brief",
      headers,
      payload: {
        brief: "Polar's company policy requires reversible releases and a customer pilot.",
        expectedRevision: emptyContext.json().revision,
      },
    });
    assert.equal(briefRetry.statusCode, 200, briefRetry.body);
    assert.equal(briefRetry.json().revision, brief.json().revision);
    const reusedBriefRevision = await app.inject({
      method: "PUT",
      url: "/api/app/workspace-context/brief",
      headers,
      payload: { brief: "Different content", expectedRevision: emptyContext.json().revision },
    });
    assert.equal(reusedBriefRevision.statusCode, 409);
    const workspaceSourceId = randomUUID();
    const workspaceText =
      "Every release needs a rollback owner. Use a small customer cohort first.";
    const workspaceSource = await app.inject({
      method: "POST",
      url: "/api/app/workspace-context/sources",
      headers,
      payload: {
        source: {
          id: workspaceSourceId,
          kind: "note",
          title: "Release policy",
          fileName: null,
          contentHash: null,
          extractedText: workspaceText,
        },
      },
    });
    assert.equal(workspaceSource.statusCode, 200, workspaceSource.body);
    const largeWorkspaceText =
      "Large workspace document request-body fixture; no real company information.".repeat(700);
    const largeWorkspaceSourceId = randomUUID();
    const largeWorkspaceDocument = await app.inject({
      method: "POST",
      url: "/api/app/workspace-context/sources",
      headers,
      payload: {
        source: {
          id: largeWorkspaceSourceId,
          kind: "document",
          title: "Large request fixture",
          fileName: "large-request-fixture.md",
          contentHash: createHash("sha256").update(largeWorkspaceText).digest("hex"),
          extractedText: largeWorkspaceText,
        },
      },
    });
    assert.equal(largeWorkspaceDocument.statusCode, 200, largeWorkspaceDocument.body);
    assert.equal(largeWorkspaceDocument.json().extractedText, largeWorkspaceText);
    const largeWorkspaceReplacementText =
      "Updated large workspace document request-body fixture; still synthetic.".repeat(700);
    const replacedLargeWorkspaceDocument = await app.inject({
      method: "PUT",
      url: `/api/app/workspace-context/sources/${largeWorkspaceSourceId}`,
      headers,
      payload: {
        expectedRevision: 1,
        source: {
          id: largeWorkspaceSourceId,
          kind: "document",
          title: "Large request fixture",
          fileName: "large-request-fixture.md",
          contentHash: createHash("sha256").update(largeWorkspaceReplacementText).digest("hex"),
          extractedText: largeWorkspaceReplacementText,
        },
      },
    });
    assert.equal(
      replacedLargeWorkspaceDocument.statusCode,
      200,
      replacedLargeWorkspaceDocument.body,
    );
    assert.equal(
      replacedLargeWorkspaceDocument.json().extractedText,
      largeWorkspaceReplacementText,
    );
    const removedLargeWorkspaceDocument = await app.inject({
      method: "DELETE",
      url: `/api/app/workspace-context/sources/${largeWorkspaceSourceId}`,
      headers: { ...headers, "if-match": "2" },
    });
    assert.equal(removedLargeWorkspaceDocument.statusCode, 200);
    const deviceId = randomUUID();
    const registered = await app.inject({
      method: "POST",
      url: "/api/app/devices",
      headers,
      payload: { deviceId, label: "Development mission test" },
    });
    assert.equal(registered.statusCode, 200);

    const created = await app.inject({
      method: "POST",
      url: "/api/app/mission-drafts",
      headers,
      payload: { goal: "" },
    });
    assert.equal(created.statusCode, 200);
    const draftId = created.json().id as string;
    const text =
      "The release must preserve the current API. Start with a small customer cohort and keep a rollback path.\n" +
      "Large mission attachment request-body fixture.".repeat(800);
    const sourceId = randomUUID();
    const source = await app.inject({
      method: "POST",
      url: `/api/app/mission-drafts/${draftId}/sources`,
      headers,
      payload: {
        id: sourceId,
        fileName: "launch-brief.md",
        contentHash: createHash("sha256").update(text).digest("hex"),
        extractedText: text,
        provenance: "markdown",
      },
    });
    assert.equal(source.statusCode, 200);
    const otherWorkspace = await app.inject({
      method: "GET",
      url: `/api/app/mission-drafts/${draftId}`,
      headers: { ...headers, "x-polar-workspace-id": randomUUID() },
    });
    assert.equal(otherWorkspace.statusCode, 403);

    const sent = await app.inject({
      method: "POST",
      url: `/api/app/mission-drafts/${draftId}/messages`,
      headers,
      payload: { content: "The release brief has the rollout and rollback constraints." },
    });
    assert.equal(sent.statusCode, 200);
    const requestId = sent.json().requestId as string;
    const claim = await app.inject({
      method: "GET",
      url: "/api/app/reasoning/claim",
      headers: { ...headers, "x-polar-device-id": deviceId },
    });
    assert.equal(claim.statusCode, 200);
    const job = claim.json().job;
    assert.equal(job.id, requestId);
    assert.equal(job.payload.mission.sources[0].title, "launch-brief.md");
    assert.equal(
      job.payload.workspaceContext.brief,
      "Polar's company policy requires reversible releases and a customer pilot.",
    );
    assert.equal(job.payload.workspaceContext.sources[0].id, workspaceSourceId);
    assert.equal(job.payload.mission.conversation.at(-1).role, "user");
    assert.equal(job.payload.mission.goal, "");

    const output = {
      reply:
        "The rollout and rollback constraints are clear. I have a practical first plan for you to review.",
      questions: [],
      citations: [],
      proposal: {
        name: "Launch the customer portal",
        outcome: "Release the portal to customers while preserving the current API.",
        successCriteria: ["The first cohort can use the portal.", "Rollback is ready."],
        constraints: ["Preserve the current API."],
        deadlineAt: null,
        scheduledAt: "2026-10-09T12:00:00-06:00",
        assessment: "The release is ready for a staged rollout.",
        recommendation: "Verify the pilot cohort before broadening access.",
        checkpoints: [
          {
            name: "Staged rollout",
            detail: "Validate the release with a small cohort.",
            dueOn: "2026-10-12",
            actions: [
              {
                title: "Verify rollback",
                dueOn: "2026-10-10",
                detail: "Confirm the rollback path works.",
                priority: "High",
                dependsOn: [],
              },
              {
                title: "Enable pilot cohort",
                dueOn: "2026-10-11",
                detail: "Release to the first customers.",
                priority: "High",
                dependsOn: ["Verify rollback"],
              },
            ],
          },
        ],
        risks: ["Pilot feedback may uncover compatibility issues."],
        assumptions: ["The cohort can be enabled independently."],
      },
    };
    // A detailed, contract-valid plan must survive submission and persistence,
    // including regeneration, rather than hitting Fastify's default 32 KiB cap.
    const supportingDetail = (index: number) =>
      `Synthetic supporting condition ${index}: ${"Review the pilot evidence. ".repeat(17)}`;
    output.proposal.successCriteria.push(
      ...Array.from({ length: 18 }, (_, i) => supportingDetail(i)),
    );
    output.proposal.constraints.push(...Array.from({ length: 19 }, (_, i) => supportingDetail(i)));
    output.proposal.risks.push(...Array.from({ length: 19 }, (_, i) => supportingDetail(i)));
    output.proposal.assumptions.push(...Array.from({ length: 19 }, (_, i) => supportingDetail(i)));
    assert.ok(Buffer.byteLength(JSON.stringify(output)) > 32 * 1024);
    const clarification = await app.inject({
      method: "POST",
      url: `/api/app/reasoning/${requestId}/result`,
      headers,
      payload: {
        deviceId,
        leaseToken: job.leaseToken,
        output: {
          ...output,
          reply: "I have the rollout context.",
          questions: ["Who will approve the pilot?"],
          proposal: output.proposal,
        },
        provider: "chatgpt",
        model: "gpt-6.1-sol",
      },
    });
    assert.equal(clarification.statusCode, 200, clarification.body);
    assert.equal(clarification.json().proposalId, null);
    const clarifiedDraft = await app.inject({
      method: "GET",
      url: `/api/app/mission-drafts/${draftId}`,
      headers,
    });
    assert.equal(
      clarifiedDraft.json().goal,
      "The release brief has the rollout and rollback constraints.",
    );
    assert.match(clarifiedDraft.json().messages[1].content, /Who will approve the pilot\?/);
    assert.equal(clarifiedDraft.json().proposal, null);

    const answered = await app.inject({
      method: "POST",
      url: `/api/app/mission-drafts/${draftId}/messages`,
      headers,
      payload: { content: "The product lead will approve the pilot." },
    });
    assert.equal(answered.statusCode, 200);
    const secondClaim = await app.inject({
      method: "GET",
      url: "/api/app/reasoning/claim",
      headers: { ...headers, "x-polar-device-id": deviceId },
    });
    const secondJob = secondClaim.json().job;
    assert.equal(secondJob.id, answered.json().requestId);
    const unscheduled = structuredClone(output);
    const legacyProposal = unscheduled.proposal as Partial<typeof unscheduled.proposal>;
    delete legacyProposal.scheduledAt;
    for (const checkpoint of unscheduled.proposal.checkpoints) {
      delete (checkpoint as Partial<typeof checkpoint>).dueOn;
    }
    const rejectedUnscheduled = await app.inject({
      method: "POST",
      url: `/api/app/reasoning/${secondJob.id}/result`,
      headers,
      payload: {
        deviceId,
        leaseToken: secondJob.leaseToken,
        output: unscheduled,
        provider: "chatgpt",
        model: "gpt-6.1-sol",
      },
    });
    assert.equal(rejectedUnscheduled.statusCode, 400, rejectedUnscheduled.body);
    assert.equal(rejectedUnscheduled.json().error, "INVALID_SCHEDULE");
    const failUnscheduled = await app.inject({
      method: "POST",
      url: `/api/app/reasoning/${secondJob.id}/failure`,
      headers: { ...headers, "x-polar-device-id": deviceId },
      payload: { leaseToken: secondJob.leaseToken, errorCode: "INVALID_SCHEDULE" },
    });
    assert.equal(failUnscheduled.statusCode, 200, failUnscheduled.body);
    const retryUnscheduled = await app.inject({
      method: "POST",
      url: `/api/app/reasoning/${secondJob.id}/retry`,
      headers,
    });
    assert.equal(retryUnscheduled.statusCode, 200, retryUnscheduled.body);
    const unscheduledRetryClaim = await app.inject({
      method: "GET",
      url: "/api/app/reasoning/claim",
      headers: { ...headers, "x-polar-device-id": deviceId },
    });
    const unscheduledRetryJob = unscheduledRetryClaim.json().job;
    assert.equal(unscheduledRetryJob.id, secondJob.id);
    const invalidSchedule = structuredClone(output);
    invalidSchedule.proposal.checkpoints[0]!.actions[1]!.dueOn = "2026-10-13";
    const rejectedSchedule = await app.inject({
      method: "POST",
      url: `/api/app/reasoning/${secondJob.id}/result`,
      headers,
      payload: {
        deviceId,
        leaseToken: unscheduledRetryJob.leaseToken,
        output: invalidSchedule,
        provider: "chatgpt",
        model: "gpt-6.1-sol",
      },
    });
    assert.equal(rejectedSchedule.statusCode, 400, rejectedSchedule.body);
    assert.equal(rejectedSchedule.json().error, "INVALID_SCHEDULE");
    const failSchedule = await app.inject({
      method: "POST",
      url: `/api/app/reasoning/${secondJob.id}/failure`,
      headers: { ...headers, "x-polar-device-id": deviceId },
      payload: { leaseToken: unscheduledRetryJob.leaseToken, errorCode: "INVALID_SCHEDULE" },
    });
    assert.equal(failSchedule.statusCode, 200, failSchedule.body);
    const failedDraft = await app.inject({
      method: "GET",
      url: `/api/app/mission-drafts/${draftId}`,
      headers,
    });
    assert.equal(
      failedDraft.json().request.errorMessage,
      "Polar rejected the schedule because its dates conflict with checkpoint deadlines or action prerequisites. Retry to generate a new schedule.",
    );
    const retrySchedule = await app.inject({
      method: "POST",
      url: `/api/app/reasoning/${secondJob.id}/retry`,
      headers,
    });
    assert.equal(retrySchedule.statusCode, 200, retrySchedule.body);
    const cancelRetry = await app.inject({
      method: "POST",
      url: `/api/app/reasoning/${secondJob.id}/cancel`,
      headers,
    });
    assert.equal(cancelRetry.statusCode, 200, cancelRetry.body);
    assert.equal(cancelRetry.json().cancelled, true);
    const retryCancelled = await app.inject({
      method: "POST",
      url: `/api/app/reasoning/${secondJob.id}/retry`,
      headers,
    });
    assert.equal(retryCancelled.statusCode, 200, retryCancelled.body);
    const scheduleRetryClaim = await app.inject({
      method: "GET",
      url: "/api/app/reasoning/claim",
      headers: { ...headers, "x-polar-device-id": deviceId },
    });
    const scheduleRetryJob = scheduleRetryClaim.json().job;
    assert.equal(scheduleRetryJob.id, secondJob.id);
    const draftAfterRejection = await app.inject({
      method: "GET",
      url: `/api/app/mission-drafts/${draftId}`,
      headers,
    });
    assert.equal(draftAfterRejection.json().proposal, null);
    const completed = await app.inject({
      method: "POST",
      url: `/api/app/reasoning/${secondJob.id}/result`,
      headers,
      payload: {
        deviceId,
        leaseToken: scheduleRetryJob.leaseToken,
        output,
        provider: "chatgpt",
        model: "gpt-6.1-sol",
      },
    });
    assert.equal(completed.statusCode, 200, completed.body);
    const proposal = completed.json();
    const sourceUpdate = await app.inject({
      method: "PUT",
      url: `/api/app/workspace-context/sources/${workspaceSourceId}`,
      headers,
      payload: {
        expectedRevision: 1,
        source: {
          id: workspaceSourceId,
          kind: "note",
          title: "Release policy",
          fileName: null,
          contentHash: null,
          extractedText:
            "Every release needs a rollback owner and named approver. Use a small customer cohort first.",
        },
      },
    });
    assert.equal(sourceUpdate.statusCode, 200, sourceUpdate.body);
    const sourceUpdateRetry = await app.inject({
      method: "PUT",
      url: `/api/app/workspace-context/sources/${workspaceSourceId}`,
      headers,
      payload: {
        expectedRevision: 1,
        source: {
          id: workspaceSourceId,
          kind: "note",
          title: "Release policy",
          fileName: null,
          contentHash: null,
          extractedText:
            "Every release needs a rollback owner and named approver. Use a small customer cohort first.",
        },
      },
    });
    assert.equal(sourceUpdateRetry.statusCode, 200, sourceUpdateRetry.body);
    assert.equal(sourceUpdateRetry.json().revision, sourceUpdate.json().revision);
    const stale = await app.inject({
      method: "POST",
      url: `/api/app/mission-drafts/${draftId}/activate`,
      headers,
      payload: { proposalId: proposal.proposalId, revisionHash: proposal.revisionHash },
    });
    assert.equal(stale.statusCode, 409);
    const refreshedMessage = await app.inject({
      method: "POST",
      url: `/api/app/mission-drafts/${draftId}/messages`,
      headers,
      payload: { content: "The named approver is the product lead." },
    });
    assert.equal(refreshedMessage.statusCode, 200, refreshedMessage.body);
    const refreshedClaim = await app.inject({
      method: "GET",
      url: "/api/app/reasoning/claim",
      headers: { ...headers, "x-polar-device-id": deviceId },
    });
    const refreshedJob = refreshedClaim.json().job;
    const refreshedManifestSource = refreshedJob.payload.contextManifest.sources.find(
      (source: { scope: string }) => source.scope === "workspace",
    );
    const refreshedOutput = {
      ...output,
      citations: [
        {
          scope: "workspace",
          sourceId: refreshedManifestSource.id,
          revision: refreshedManifestSource.revision,
          excerptId: refreshedManifestSource.excerptIds[0],
        },
      ],
    };
    const refreshedResult = await app.inject({
      method: "POST",
      url: `/api/app/reasoning/${refreshedJob.id}/result`,
      headers,
      payload: {
        deviceId,
        leaseToken: refreshedJob.leaseToken,
        output: refreshedOutput,
        provider: "chatgpt",
        model: "gpt-6.1-sol",
      },
    });
    assert.equal(refreshedResult.statusCode, 200, refreshedResult.body);
    const currentProposal = refreshedResult.json();
    const activated = await app.inject({
      method: "POST",
      url: `/api/app/mission-drafts/${draftId}/activate`,
      headers,
      payload: {
        proposalId: currentProposal.proposalId,
        revisionHash: currentProposal.revisionHash,
      },
    });
    assert.equal(activated.statusCode, 200, activated.body);
    const repeated = await app.inject({
      method: "POST",
      url: `/api/app/mission-drafts/${draftId}/activate`,
      headers,
      payload: {
        proposalId: currentProposal.proposalId,
        revisionHash: currentProposal.revisionHash,
      },
    });
    assert.deepEqual(repeated.json(), activated.json());
    const missions = await app.inject({ method: "GET", url: "/api/app/missions", headers });
    assert.equal(missions.statusCode, 200);
    const mission = missions.json()[0];
    assert.equal(mission.id, activated.json().missionId);
    assert.equal(mission.nextAction.title, "Verify rollback");
    assert.equal(mission.actions[0].dueOn, "2026-10-10");
    assert.equal(mission.actions[1].dueOn, "2026-10-11");
    assert.equal(mission.checkpoints[0].dueOn, "2026-10-12");
    assert.deepEqual(mission.actions[1].dependencies, ["Verify rollback"]);
    assert.equal(
      mission.sources.find((source: { id: string }) => source.id === workspaceSourceId).revision,
      2,
    );
    assert.equal(
      mission.sources.find((source: { scope: string }) => source.scope === "mission").fileName,
      "launch-brief.md",
    );
    const regeneration = await app.inject({
      method: "POST",
      url: `/api/app/missions/${mission.id}/regenerate`,
      headers,
    });
    assert.equal(regeneration.statusCode, 200, regeneration.body);
    assert.equal(regeneration.json().draftId, draftId);
    const deniedRegeneration = await app.inject({
      method: "POST",
      url: `/api/app/missions/${mission.id}/regenerate`,
      headers: { ...headers, "x-polar-workspace-id": randomUUID() },
    });
    assert.equal(deniedRegeneration.statusCode, 403);
    const regenerateMessage = await app.inject({
      method: "POST",
      url: `/api/app/mission-drafts/${draftId}/messages`,
      headers,
      payload: { content: "Regenerate this plan using the current context." },
    });
    assert.equal(regenerateMessage.statusCode, 200, regenerateMessage.body);
    const regenerateClaim = await app.inject({
      method: "GET",
      url: "/api/app/reasoning/claim",
      headers: { ...headers, "x-polar-device-id": deviceId },
    });
    const regenerationJob = regenerateClaim.json().job;
    assert.equal(regenerationJob.id, regenerateMessage.json().requestId);
    assert.equal(regenerationJob.payload.mission.currentPlan.outcome, output.proposal.outcome);
    assert.equal(regenerationJob.payload.mission.sources[0].title, "launch-brief.md");
    assert.equal(regenerationJob.payload.contextManifest.currentMission.id, mission.id);
    const regenerationOutput = {
      ...refreshedOutput,
      proposal: {
        ...output.proposal,
        recommendation: "Check the rollback path before the pilot.",
        checkpoints: output.proposal.checkpoints.map((checkpoint) => ({
          ...checkpoint,
          dueOn: "2026-10-14",
        })),
      },
    };
    const regenerationResult = await app.inject({
      method: "POST",
      url: `/api/app/reasoning/${regenerationJob.id}/result`,
      headers,
      payload: {
        deviceId,
        leaseToken: regenerationJob.leaseToken,
        output: regenerationOutput,
        provider: "chatgpt",
        model: "gpt-6.1-sol",
      },
    });
    assert.equal(regenerationResult.statusCode, 200, regenerationResult.body);
    const beforeApply = await app.inject({ method: "GET", url: "/api/app/missions", headers });
    assert.equal(beforeApply.json()[0].recommendation, output.proposal.recommendation);
    const replacementProposal = regenerationResult.json();
    const applyReplacement = await app.inject({
      method: "POST",
      url: `/api/app/mission-drafts/${draftId}/activate`,
      headers,
      payload: {
        proposalId: replacementProposal.proposalId,
        revisionHash: replacementProposal.revisionHash,
      },
    });
    assert.equal(applyReplacement.statusCode, 200, applyReplacement.body);
    assert.equal(applyReplacement.json().missionId, mission.id);
    const repeatedApply = await app.inject({
      method: "POST",
      url: `/api/app/mission-drafts/${draftId}/activate`,
      headers,
      payload: {
        proposalId: replacementProposal.proposalId,
        revisionHash: replacementProposal.revisionHash,
      },
    });
    assert.deepEqual(repeatedApply.json(), applyReplacement.json());
    const afterApply = await app.inject({ method: "GET", url: "/api/app/missions", headers });
    assert.equal(afterApply.json().length, 1);
    assert.equal(afterApply.json()[0].recommendation, regenerationOutput.proposal.recommendation);
    assert.equal(afterApply.json()[0].actions.length, 2);
    assert.equal(afterApply.json()[0].actions[0].dueOn, "2026-10-10");
    assert.equal(afterApply.json()[0].checkpoints[0].dueOn, "2026-10-14");
    const oldApply = await app.inject({
      method: "POST",
      url: `/api/app/mission-drafts/${draftId}/activate`,
      headers,
      payload: {
        proposalId: currentProposal.proposalId,
        revisionHash: currentProposal.revisionHash,
      },
    });
    assert.equal(oldApply.statusCode, 409);
    const secondDraft = await app.inject({
      method: "POST",
      url: "/api/app/mission-drafts",
      headers,
      payload: { goal: "Prepare a separate customer workshop" },
    });
    const secondDraftId = secondDraft.json().id as string;
    const secondMessage = await app.inject({
      method: "POST",
      url: `/api/app/mission-drafts/${secondDraftId}/messages`,
      headers,
      payload: { content: "Plan the workshop agenda." },
    });
    assert.equal(secondMessage.statusCode, 200, secondMessage.body);
    const secondMissionClaim = await app.inject({
      method: "GET",
      url: "/api/app/reasoning/claim",
      headers: { ...headers, "x-polar-device-id": deviceId },
    });
    const secondMissionJob = secondMissionClaim.json().job;
    assert.equal(secondMissionJob.payload.workspaceContext.sources[0].id, workspaceSourceId);
    assert.equal(secondMissionJob.payload.workspaceContext.sources[0].revision, 2);
    assert.equal(secondMissionJob.payload.mission.sources.length, 0);
    const removedWorkspaceSource = await app.inject({
      method: "DELETE",
      url: `/api/app/workspace-context/sources/${workspaceSourceId}`,
      headers: { ...headers, "if-match": "2" },
    });
    assert.equal(removedWorkspaceSource.statusCode, 200, removedWorkspaceSource.body);
    const removeRetry = await app.inject({
      method: "DELETE",
      url: `/api/app/workspace-context/sources/${workspaceSourceId}`,
      headers: { ...headers, "if-match": "2" },
    });
    assert.equal(removeRetry.statusCode, 200, removeRetry.body);
    assert.deepEqual(removeRetry.json(), removedWorkspaceSource.json());
    const missionAfterRemoval = await app.inject({
      method: "GET",
      url: "/api/app/missions",
      headers,
    });
    assert.equal(
      missionAfterRemoval
        .json()[0]
        .sources.find((source: { scope: string }) => source.scope === "workspace").currentState,
      "changed",
    );
    assert.equal(
      missionAfterRemoval
        .json()[0]
        .sources.find((source: { id: string }) => source.id === workspaceSourceId).currentState,
      "removed",
    );
    const restored = await app.inject({
      method: "GET",
      url: `/api/app/mission-drafts/${draftId}`,
      headers,
    });
    assert.equal(restored.json().messages.length, 8);
    assert.equal(restored.json().status, "activated");
  } finally {
    try {
      await db.delete(authUser).where(eq(authUser.email, email));
    } finally {
      await app.close();
      await pool.end();
    }
  }
});
