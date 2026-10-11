import { createHash, randomUUID } from "node:crypto";
import { and, asc, desc, eq, gt, inArray, isNull, lt, lte, or } from "drizzle-orm";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import {
  MissionActivationSchema,
  MissionActionUpdateSchema,
  ActionConversationMessageSchema,
  ActionEvidenceSubmissionSchema,
  ActionEvaluationSchema,
  MissionDraftCreateSchema,
  MissionInterpreterOutputSchema,
  MissionMessageSchema,
  MissionPlanSchema,
  MissionSourceSchema,
  ReasoningClaimSchema,
  ReasoningResultSchema,
} from "@polar/contracts";
import { Inngest } from "inngest";
import { fastifyPlugin } from "inngest/fastify";
import type { PolarAuth } from "./auth.js";
import type { ServerConfig } from "./config.js";
import type { PolarDatabase } from "./db/client.js";
import { EXTRACTED_SOURCE_BODY_LIMIT, REASONING_RESULT_BODY_LIMIT } from "./request-limits.js";
import { hasValidSchedule } from "./mission-scheduling.js";
import {
  attentionItem,
  actionEvidence,
  actionFollowUp,
  actionMessage,
  domainEvent,
  mission,
  missionAction,
  missionAssessment,
  missionActionContext,
  missionActionMember,
  missionDraft,
  missionMessage,
  missionProposal,
  missionSource,
  outbox,
  polarUser,
  reasoningRequest,
  registeredDevice,
  workspace,
  workspaceMembership,
  workspaceContext,
  workspaceContextSource,
} from "./db/schema.js";
import { missionContextSourceIds, withActionDeadline } from "./action-updates.js";

const MAX_CONTEXT_CHARS = 200_000;
const MAX_CONVERSATION_CHARS = 60_000;
const UUID_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
// Covers separate three-minute planning and scheduling requests plus submission.
const REASONING_LEASE_MS = 420_000;
const REASONING_FAILURE_MESSAGES: Record<string, string> = {
  INVALID_PLAN: "Polar rejected the plan structure. Retry to generate it again.",
  INVALID_DEPENDENCIES:
    "Polar rejected the plan because its action dependencies are inconsistent. Retry to generate it again.",
  INVALID_SCHEDULE:
    "Polar rejected the schedule because its dates conflict with checkpoint deadlines or action prerequisites. Retry to generate a new schedule.",
  RESULT_TOO_LARGE:
    "The generated plan exceeded Polar's result size limit. Retry to generate it again.",
};

export function installMissionRoutes(
  app: FastifyInstance,
  auth: PolarAuth,
  db: PolarDatabase,
  _config: ServerConfig,
  inngest: Inngest,
) {
  app.register(fastifyPlugin, { client: inngest, functions: createMissionFunctions(inngest, db) });

  app.post("/api/app/mission-drafts", async (request, reply) => {
    const access = await requireWorkspace(auth, db, request, reply);
    if (!access) return;
    const body = MissionDraftCreateSchema.safeParse(request.body);
    if (!body.success) return invalid(reply, "Describe a goal up to 4,000 characters.");
    const id = randomUUID();
    const now = new Date();
    await db.transaction(async (tx) => {
      await tx.insert(missionDraft).values({
        id,
        workspaceId: access.workspaceId,
        userId: access.userId,
        goal: body.data.goal,
        createdAt: now,
        updatedAt: now,
      });
      await tx.insert(domainEvent).values({
        id: randomUUID(),
        workspaceId: access.workspaceId,
        userId: access.userId,
        eventType: "mission.draft_created",
        payload: { draftId: id },
        createdAt: now,
      });
    });
    return { id, status: "draft", goal: body.data.goal, messages: [], sources: [], proposal: null };
  });

  app.get("/api/app/mission-drafts", async (request, reply) => {
    const access = await requireWorkspace(auth, db, request, reply);
    if (!access) return;
    const rows = await db
      .select({
        id: missionDraft.id,
        goal: missionDraft.goal,
        status: missionDraft.status,
        updatedAt: missionDraft.updatedAt,
      })
      .from(missionDraft)
      .where(
        and(
          eq(missionDraft.workspaceId, access.workspaceId),
          eq(missionDraft.userId, access.userId),
          eq(missionDraft.status, "draft"),
        ),
      )
      .orderBy(desc(missionDraft.updatedAt))
      .limit(20);
    return rows;
  });

  app.get<{ Params: { draftId: string } }>(
    "/api/app/mission-drafts/:draftId",
    async (request, reply) => {
      const access = await requireWorkspace(auth, db, request, reply);
      if (!access) return;
      const detail = await loadDraft(db, access, request.params.draftId);
      if (!detail)
        return reply
          .status(404)
          .send({ error: "DRAFT_NOT_FOUND", message: "This draft is no longer available." });
      return detail;
    },
  );

  app.post<{ Params: { missionId: string } }>(
    "/api/app/missions/:missionId/regenerate",
    async (request, reply) => {
      const access = await requireWorkspace(auth, db, request, reply);
      if (!access) return;
      const [row] = await db
        .select({ draftId: missionProposal.draftId })
        .from(mission)
        .innerJoin(missionProposal, eq(mission.proposalId, missionProposal.id))
        .where(
          and(
            eq(mission.id, request.params.missionId),
            eq(mission.workspaceId, access.workspaceId),
            eq(mission.ownerUserId, access.userId),
          ),
        )
        .limit(1);
      if (!row)
        return reply.status(404).send({
          error: "MISSION_NOT_FOUND",
          message: "This mission is unavailable or belongs to another owner.",
        });
      return { draftId: row.draftId };
    },
  );

  app.post<{ Params: { draftId: string } }>(
    "/api/app/mission-drafts/:draftId/messages",
    async (request, reply) => {
      const access = await requireWorkspace(auth, db, request, reply);
      if (!access) return;
      const body = MissionMessageSchema.safeParse(request.body);
      if (!body.success) return invalid(reply, "Enter a message up to 8,000 characters.");
      const detail = await loadDraft(db, access, request.params.draftId);
      if (!detail || !["draft", "activated"].includes(detail.status))
        return reply
          .status(404)
          .send({ error: "DRAFT_NOT_FOUND", message: "This draft is no longer available." });
      const id = randomUUID();
      const now = new Date();
      const requestId = randomUUID();
      const history = boundConversation([
        ...detail.messages,
        { role: "user", content: body.data.content },
      ]);
      const snapshot = await assembleContextSnapshot(db, access, detail, history);
      const currentSnapshot = await db.transaction(async (tx) => {
        const [currentContext] = await tx
          .select({ revision: workspaceContext.revision })
          .from(workspaceContext)
          .where(eq(workspaceContext.workspaceId, access.workspaceId))
          .for("update")
          .limit(1);
        if ((currentContext?.revision ?? 1) !== snapshot.manifest.workspaceRevision) return false;
        await tx
          .update(reasoningRequest)
          .set({ status: "cancelled", leaseToken: null, leaseExpiresAt: null, updatedAt: now })
          .where(
            and(
              eq(reasoningRequest.draftId, detail.id),
              inArray(reasoningRequest.status, ["queued", "claimed"]),
            ),
          );
        await tx
          .update(missionProposal)
          .set({ status: "superseded" })
          .where(
            and(eq(missionProposal.draftId, detail.id), eq(missionProposal.status, "current")),
          );
        await tx.insert(missionMessage).values({
          id,
          draftId: detail.id,
          role: "user",
          content: body.data.content,
          createdAt: now,
        });
        await tx.insert(reasoningRequest).values({
          id: requestId,
          draftId: detail.id,
          userId: access.userId,
          workspaceId: access.workspaceId,
          payload: snapshot.payload,
          contextManifest: snapshot.manifest,
          status: "queued",
          createdAt: now,
          updatedAt: now,
        });
        if (!detail.goal.trim())
          await tx
            .update(missionDraft)
            .set({ goal: body.data.content, updatedAt: now })
            .where(eq(missionDraft.id, detail.id));
        await tx.insert(outbox).values({
          id: requestId,
          eventName: "polar/reasoning.requested",
          payload: { requestId, workspaceId: access.workspaceId },
          createdAt: now,
        });
        await tx.update(missionDraft).set({ updatedAt: now }).where(eq(missionDraft.id, detail.id));
        return true;
      });
      if (!currentSnapshot)
        return reply.status(409).send({
          error: "WORKSPACE_CONTEXT_CHANGED",
          message: "Workspace context changed. Send your message again to use the current sources.",
        });
      try {
        const event = await inngest.send({
          id: requestId,
          name: "polar/reasoning.requested",
          data: { requestId },
        });
        await db
          .update(outbox)
          .set({ deliveredAt: now, attempts: 1 })
          .where(eq(outbox.id, requestId));
        return { messageId: id, requestId, status: "queued", eventId: event.ids?.[0] ?? requestId };
      } catch (error) {
        request.log.warn({ err: error, requestId }, "Inngest dispatch will be retried from outbox");
        return { messageId: id, requestId, status: "waiting" };
      }
    },
  );

  app.post<{ Params: { draftId: string } }>(
    "/api/app/mission-drafts/:draftId/sources",
    { bodyLimit: EXTRACTED_SOURCE_BODY_LIMIT },
    async (request, reply) => {
      const access = await requireWorkspace(auth, db, request, reply);
      if (!access) return;
      const body = MissionSourceSchema.safeParse(request.body);
      if (!body.success)
        return invalid(reply, "This source is invalid or extracted text exceeds its limit.");
      if (
        createHash("sha256").update(body.data.extractedText).digest("hex") !== body.data.contentHash
      )
        return invalid(
          reply,
          "This source changed after it was read. Remove it and attach it again.",
        );
      const detail = await loadDraft(db, access, request.params.draftId);
      if (!detail || detail.status !== "draft")
        return reply
          .status(404)
          .send({ error: "DRAFT_NOT_FOUND", message: "This draft is no longer available." });
      const total = detail.sources.reduce((sum, source) => sum + source.extractedText.length, 0);
      if (
        detail.sources.length >= 10 ||
        total + body.data.extractedText.length > MAX_CONTEXT_CHARS
      ) {
        return reply.status(413).send({
          error: "CONTEXT_LIMIT",
          message: "This draft has reached its context limit. Remove a source to continue.",
        });
      }
      await db.transaction(async (tx) => {
        await tx
          .update(reasoningRequest)
          .set({
            status: "cancelled",
            leaseToken: null,
            leaseExpiresAt: null,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(reasoningRequest.draftId, detail.id),
              inArray(reasoningRequest.status, ["queued", "claimed"]),
            ),
          );
        await tx
          .update(missionProposal)
          .set({ status: "superseded" })
          .where(
            and(eq(missionProposal.draftId, detail.id), eq(missionProposal.status, "current")),
          );
        await tx
          .insert(missionSource)
          .values({ ...body.data, draftId: detail.id, createdAt: new Date() })
          .onConflictDoUpdate({
            target: [missionSource.draftId, missionSource.contentHash],
            set: {
              fileName: body.data.fileName,
              extractedText: body.data.extractedText,
              provenance: body.data.provenance,
            },
          });
      });
      return {
        id: body.data.id,
        fileName: body.data.fileName,
        contentHash: body.data.contentHash,
        provenance: body.data.provenance,
      };
    },
  );

  app.delete<{ Params: { draftId: string; sourceId: string } }>(
    "/api/app/mission-drafts/:draftId/sources/:sourceId",
    async (request, reply) => {
      const access = await requireWorkspace(auth, db, request, reply);
      if (!access) return;
      const detail = await loadDraft(db, access, request.params.draftId);
      if (!detail || detail.status !== "draft")
        return reply
          .status(404)
          .send({ error: "DRAFT_NOT_FOUND", message: "This draft is no longer available." });
      await db.transaction(async (tx) => {
        await tx
          .update(reasoningRequest)
          .set({
            status: "cancelled",
            leaseToken: null,
            leaseExpiresAt: null,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(reasoningRequest.draftId, detail.id),
              inArray(reasoningRequest.status, ["queued", "claimed"]),
            ),
          );
        await tx
          .update(missionProposal)
          .set({ status: "superseded" })
          .where(
            and(eq(missionProposal.draftId, detail.id), eq(missionProposal.status, "current")),
          );
        await tx
          .delete(missionSource)
          .where(
            and(
              eq(missionSource.id, request.params.sourceId),
              eq(missionSource.draftId, detail.id),
            ),
          );
      });
      return { removed: true };
    },
  );

  app.get("/api/app/reasoning/claim", async (request, reply) => {
    const access = await requireWorkspace(auth, db, request, reply);
    if (!access) return;
    const parsed = ReasoningClaimSchema.safeParse({
      deviceId: header(request, "x-polar-device-id"),
    });
    if (!parsed.success || !(await deviceBelongsTo(db, access.userId, parsed.data.deviceId)))
      return reply.status(403).send({
        error: "DEVICE_REQUIRED",
        message: "This device is not registered to your Polar account.",
      });
    return db.transaction(async (tx) => {
      const [currentContext] = await tx
        .select({ revision: workspaceContext.revision })
        .from(workspaceContext)
        .where(eq(workspaceContext.workspaceId, access.workspaceId))
        .for("update")
        .limit(1);
      const [job] = await tx
        .select()
        .from(reasoningRequest)
        .where(
          and(
            eq(reasoningRequest.workspaceId, access.workspaceId),
            eq(reasoningRequest.userId, access.userId),
            or(
              eq(reasoningRequest.status, "queued"),
              and(
                eq(reasoningRequest.status, "claimed"),
                lt(reasoningRequest.leaseExpiresAt, new Date()),
              ),
            ),
          ),
        )
        .orderBy(asc(reasoningRequest.createdAt))
        .limit(1)
        .for("update", { skipLocked: true });
      if (!job) return { job: null };
      const manifest = job.contextManifest as ContextManifest | null;
      if (!manifest || (currentContext?.revision ?? 1) !== manifest.workspaceRevision) {
        await tx
          .update(reasoningRequest)
          .set({
            status: "cancelled",
            leaseToken: null,
            leaseExpiresAt: null,
            updatedAt: new Date(),
          })
          .where(eq(reasoningRequest.id, job.id));
        return { job: null };
      }
      const leaseToken = randomUUID();
      await tx
        .update(reasoningRequest)
        .set({
          status: "claimed",
          leaseToken,
          leaseExpiresAt: new Date(Date.now() + REASONING_LEASE_MS),
          updatedAt: new Date(),
        })
        .where(eq(reasoningRequest.id, job.id));
      return { job: { id: job.id, payload: job.payload, leaseToken } };
    });
  });

  app.post<{ Params: { requestId: string } }>(
    "/api/app/reasoning/:requestId/result",
    { bodyLimit: REASONING_RESULT_BODY_LIMIT },
    async (request, reply) => {
      const access = await requireWorkspace(auth, db, request, reply);
      if (!access) return;
      const body = ReasoningResultSchema.safeParse(request.body);
      if (!body.success) {
        const invalidOutput = body.error.issues.every((issue) => issue.path[0] === "output");
        request.log.warn(
          {
            reasoningRequestId: request.params.requestId,
            errorCode: invalidOutput ? "INVALID_PLAN" : "INVALID_REQUEST",
            issues: body.error.issues.slice(0, 20).map((issue) => ({
              path: issue.path,
              code: issue.code,
            })),
          },
          "Reasoning result failed contract validation",
        );
        return invalidOutput
          ? reasoningResultError(reply, "INVALID_PLAN", REASONING_FAILURE_MESSAGES.INVALID_PLAN!)
          : invalid(reply, "The reasoning result is invalid.");
      }
      if (!(await deviceBelongsTo(db, access.userId, body.data.deviceId)))
        return reply.status(403).send({
          error: "DEVICE_REQUIRED",
          message: "This device is not registered to your Polar account.",
        });
      const [job] = await db
        .select()
        .from(reasoningRequest)
        .where(
          and(
            eq(reasoningRequest.id, request.params.requestId),
            eq(reasoningRequest.workspaceId, access.workspaceId),
            eq(reasoningRequest.userId, access.userId),
          ),
        )
        .limit(1);
      if (!job)
        return reply.status(404).send({
          error: "REQUEST_NOT_FOUND",
          message: "This reasoning request is no longer available.",
        });
      if (job.status === "completed")
        return { status: "completed", proposalId: null, revisionHash: null };
      if (job.status !== "claimed")
        return reply.status(409).send({
          error: "REQUEST_CHANGED",
          message:
            "This request changed while ChatGPT was working. Retry from the current conversation.",
        });
      if (
        job.leaseToken !== body.data.leaseToken ||
        !job.leaseExpiresAt ||
        job.leaseExpiresAt < new Date()
      )
        return reply.status(409).send({
          error: "LEASE_EXPIRED",
          message: "This request expired. Retry to run it again.",
        });
      const output = MissionInterpreterOutputSchema.safeParse(body.data.output);
      if (!output.success)
        return reasoningResultError(
          reply,
          "INVALID_PLAN",
          "ChatGPT returned a plan that did not pass Polar's validation. Retry to generate it again.",
        );
      const proposal = output.data.questions.length === 0 ? output.data.proposal : null;
      if (proposal && !hasValidDependencies(proposal))
        return reasoningResultError(
          reply,
          "INVALID_DEPENDENCIES",
          "ChatGPT returned dependencies that do not form a valid plan. Retry to generate it again.",
        );
      if (proposal && (!proposal.scheduledAt || !hasValidSchedule(proposal)))
        return reasoningResultError(
          reply,
          "INVALID_SCHEDULE",
          "ChatGPT returned a schedule that conflicts with its deadlines or prerequisites. Retry to generate it again.",
        );
      const assistantMessage = output.data.questions.length
        ? `${output.data.reply}\n\n${output.data.questions.map((question) => `• ${question}`).join("\n")}`
        : output.data.reply;
      const now = new Date();
      let proposalId: string | null = null;
      let revisionHash: string | null = null;
      const completionEventId = randomUUID();
      let workspaceStale = false;
      let citationsInvalid = false;
      const accepted = await db.transaction(async (tx) => {
        const [currentContext] = await tx
          .select({ revision: workspaceContext.revision })
          .from(workspaceContext)
          .where(eq(workspaceContext.workspaceId, access.workspaceId))
          .for("update")
          .limit(1);
        const manifest = job.contextManifest as ContextManifest | null;
        if ((currentContext?.revision ?? 1) !== manifest?.workspaceRevision) {
          workspaceStale = true;
          await tx
            .update(reasoningRequest)
            .set({ status: "cancelled", leaseToken: null, leaseExpiresAt: null, updatedAt: now })
            .where(eq(reasoningRequest.id, job.id));
          return false;
        }
        if (!validCitations(output.data.citations, manifest)) {
          citationsInvalid = true;
          return false;
        }
        const completed = await tx
          .update(reasoningRequest)
          .set({
            status: "completed",
            payload: {
              ...(job.payload as object),
              result: output.data,
              provider: body.data.provider,
              model: body.data.model,
            },
            updatedAt: now,
          })
          .where(
            and(
              eq(reasoningRequest.id, job.id),
              eq(reasoningRequest.status, "claimed"),
              eq(reasoningRequest.leaseToken, body.data.leaseToken),
              gt(reasoningRequest.leaseExpiresAt, now),
            ),
          )
          .returning({ id: reasoningRequest.id });
        if (!completed.length) return false;
        await tx.insert(missionMessage).values({
          id: randomUUID(),
          draftId: job.draftId,
          role: "assistant",
          content: assistantMessage,
          createdAt: now,
        });
        if (proposal) {
          const [draft] = await tx
            .select({ proposalRevision: missionDraft.proposalRevision })
            .from(missionDraft)
            .where(eq(missionDraft.id, job.draftId))
            .limit(1);
          const revision = (draft?.proposalRevision ?? 0) + 1;
          revisionHash = createHash("sha256")
            .update(
              JSON.stringify({ content: proposal, manifest, citations: output.data.citations }),
            )
            .digest("hex");
          proposalId = randomUUID();
          await tx
            .update(missionProposal)
            .set({ status: "superseded" })
            .where(
              and(eq(missionProposal.draftId, job.draftId), eq(missionProposal.status, "current")),
            );
          await tx.insert(missionProposal).values({
            id: proposalId,
            draftId: job.draftId,
            revision,
            revisionHash,
            content: proposal,
            contextManifest: manifest,
            citationReferences: output.data.citations,
            status: "current",
            createdAt: now,
          });
          await tx
            .update(missionDraft)
            .set({ proposalRevision: revision, updatedAt: now })
            .where(eq(missionDraft.id, job.draftId));
        }
        await tx.insert(outbox).values({
          id: completionEventId,
          eventName: "polar/reasoning.completed",
          payload: { requestId: job.id, workspaceId: access.workspaceId },
          createdAt: now,
        });
        return true;
      });
      if (!accepted)
        return reply.status(409).send({
          error: workspaceStale
            ? "WORKSPACE_CONTEXT_CHANGED"
            : citationsInvalid
              ? "INVALID_CITATION"
              : "REQUEST_CHANGED",
          message: workspaceStale
            ? "Workspace context changed while ChatGPT was working. Refresh the plan before review."
            : citationsInvalid
              ? "ChatGPT cited a source excerpt that was not supplied. Retry to generate it again."
              : "This request changed while ChatGPT was working. Review the latest conversation and retry.",
        });
      try {
        await inngest.send({
          id: completionEventId,
          name: "polar/reasoning.completed",
          data: { requestId: job.id },
        });
        await db
          .update(outbox)
          .set({ deliveredAt: now, attempts: 1 })
          .where(eq(outbox.id, completionEventId));
      } catch (error) {
        request.log.warn(
          { err: error, requestId: job.id },
          "Inngest completion dispatch will be recovered from outbox",
        );
      }
      return { status: "completed", proposalId, revisionHash };
    },
  );

  app.post<{ Params: { requestId: string } }>(
    "/api/app/reasoning/:requestId/failure",
    async (request, reply) => {
      const access = await requireWorkspace(auth, db, request, reply);
      if (!access) return;
      const { requestId } = request.params;
      const [job] = await db
        .select()
        .from(reasoningRequest)
        .where(
          and(
            eq(reasoningRequest.id, requestId),
            eq(reasoningRequest.workspaceId, access.workspaceId),
            eq(reasoningRequest.userId, access.userId),
          ),
        )
        .limit(1);
      if (!job)
        return reply.status(404).send({
          error: "REQUEST_NOT_FOUND",
          message: "This reasoning request is no longer available.",
        });
      const deviceId = header(request, "x-polar-device-id");
      const failure = request.body as { leaseToken?: string; errorCode?: string } | null;
      const leaseToken = failure?.leaseToken;
      if (
        typeof deviceId !== "string" ||
        typeof leaseToken !== "string" ||
        job.leaseToken !== leaseToken ||
        !(await deviceBelongsTo(db, access.userId, deviceId))
      )
        return reply.status(403).send({
          error: "DEVICE_REQUIRED",
          message: "This device is not registered to your Polar account.",
        });
      await db
        .update(reasoningRequest)
        .set({
          status: "failed",
          errorMessage:
            typeof failure?.errorCode === "string" &&
            Object.hasOwn(REASONING_FAILURE_MESSAGES, failure.errorCode)
              ? REASONING_FAILURE_MESSAGES[failure.errorCode]!
              : "ChatGPT could not complete this request. Retry when ready.",
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(reasoningRequest.id, requestId),
            eq(reasoningRequest.status, "claimed"),
            eq(reasoningRequest.leaseToken, leaseToken),
          ),
        );
      return { status: "failed" };
    },
  );

  app.post<{ Params: { requestId: string } }>(
    "/api/app/reasoning/:requestId/cancel",
    async (request, reply) => {
      const access = await requireWorkspace(auth, db, request, reply);
      if (!access) return;
      const changed = await db
        .update(reasoningRequest)
        .set({ status: "cancelled", leaseToken: null, leaseExpiresAt: null, updatedAt: new Date() })
        .where(
          and(
            eq(reasoningRequest.id, request.params.requestId),
            eq(reasoningRequest.workspaceId, access.workspaceId),
            eq(reasoningRequest.userId, access.userId),
            inArray(reasoningRequest.status, ["queued", "claimed"]),
          ),
        )
        .returning({ id: reasoningRequest.id });
      return { cancelled: changed.length > 0 };
    },
  );

  app.post<{ Params: { requestId: string } }>(
    "/api/app/reasoning/:requestId/retry",
    async (request, reply) => {
      const access = await requireWorkspace(auth, db, request, reply);
      if (!access) return;
      const [job] = await db
        .select()
        .from(reasoningRequest)
        .where(
          and(
            eq(reasoningRequest.id, request.params.requestId),
            eq(reasoningRequest.workspaceId, access.workspaceId),
            eq(reasoningRequest.userId, access.userId),
          ),
        )
        .limit(1);
      if (!job || !["failed", "queued", "cancelled"].includes(job.status))
        return reply.status(409).send({
          error: "RETRY_UNAVAILABLE",
          message: "This request cannot be retried from its current state.",
        });
      const now = new Date();
      const eventId = randomUUID();
      await db.transaction(async (tx) => {
        await tx
          .update(reasoningRequest)
          .set({
            status: "queued",
            leaseToken: null,
            leaseExpiresAt: null,
            errorMessage: null,
            updatedAt: now,
          })
          .where(eq(reasoningRequest.id, job.id));
        await tx.insert(outbox).values({
          id: eventId,
          eventName: "polar/reasoning.requested",
          payload: { requestId: job.id, workspaceId: job.workspaceId },
          createdAt: now,
        });
      });
      try {
        await inngest.send({
          id: eventId,
          name: "polar/reasoning.requested",
          data: { requestId: job.id },
        });
        await db
          .update(outbox)
          .set({ deliveredAt: now, attempts: 1 })
          .where(eq(outbox.id, eventId));
      } catch (error) {
        request.log.warn(
          { err: error, requestId: job.id },
          "Inngest retry dispatch will be recovered from outbox",
        );
      }
      return { requestId: job.id, status: "queued" };
    },
  );

  app.post<{ Params: { draftId: string } }>(
    "/api/app/mission-drafts/:draftId/activate",
    async (request, reply) => {
      const access = await requireWorkspace(auth, db, request, reply);
      if (!access) return;
      const body = MissionActivationSchema.safeParse(request.body);
      if (!body.success) return invalid(reply, "Review the current plan before activating it.");
      const detail = await loadDraft(db, access, request.params.draftId);
      if (!detail)
        return reply
          .status(404)
          .send({ error: "DRAFT_NOT_FOUND", message: "This draft is no longer available." });
      const proposal = detail.proposal;
      if (
        !proposal ||
        proposal.id !== body.data.proposalId ||
        proposal.revisionHash !== body.data.revisionHash
      )
        return reply.status(409).send({
          error: "STALE_PROPOSAL",
          message: "The plan changed. Review the latest proposal before activating.",
        });
      const proposalManifest = proposal.contextManifest as ContextManifest | null;
      const [currentWorkspaceContext] = await db
        .select({ revision: workspaceContext.revision })
        .from(workspaceContext)
        .where(eq(workspaceContext.workspaceId, access.workspaceId))
        .limit(1);
      if (
        proposalManifest &&
        proposalManifest.workspaceRevision !== (currentWorkspaceContext?.revision ?? 1)
      )
        return reply.status(409).send({
          error: "WORKSPACE_CONTEXT_CHANGED",
          message: "Workspace context changed — refresh the plan before activating.",
        });
      if (detail.status === "activated") {
        const [existing] = await db
          .select({ id: mission.id })
          .from(mission)
          .where(eq(mission.proposalId, proposal.id))
          .limit(1);
        if (existing) return { missionId: existing.id };
      }
      if (!["draft", "activated"].includes(detail.status) || proposal.status !== "current")
        return reply.status(409).send({
          error: "STALE_PROPOSAL",
          message: "The plan changed. Review the latest proposal before activating.",
        });
      const now = new Date();
      const activation = await db.transaction(async (tx) => {
        const [currentContext] = await tx
          .select({ revision: workspaceContext.revision })
          .from(workspaceContext)
          .where(eq(workspaceContext.workspaceId, access.workspaceId))
          .for("update")
          .limit(1);
        const [lockedDraft] = await tx
          .select()
          .from(missionDraft)
          .where(
            and(
              eq(missionDraft.id, detail.id),
              eq(missionDraft.userId, access.userId),
              eq(missionDraft.workspaceId, access.workspaceId),
            ),
          )
          .limit(1)
          .for("update");
        if (!lockedDraft) return { error: "DRAFT_NOT_FOUND" as const };
        const [existing] = await tx
          .select({ id: mission.id })
          .from(mission)
          .where(eq(mission.proposalId, proposal.id))
          .limit(1);
        if (existing) return { missionId: existing.id };
        if (!["draft", "activated"].includes(lockedDraft.status))
          return { error: "STALE_PROPOSAL" as const };
        const [lockedProposal] = await tx
          .select()
          .from(missionProposal)
          .where(
            and(eq(missionProposal.id, proposal.id), eq(missionProposal.draftId, lockedDraft.id)),
          )
          .limit(1)
          .for("update");
        if (
          !lockedProposal ||
          lockedProposal.status !== "current" ||
          lockedProposal.revisionHash !== body.data.revisionHash
        )
          return { error: "STALE_PROPOSAL" as const };
        const proposalManifest = lockedProposal.contextManifest as ContextManifest | null;
        if (
          !proposalManifest ||
          (currentContext?.revision ?? 1) !== proposalManifest.workspaceRevision
        )
          return { error: "WORKSPACE_CONTEXT_CHANGED" as const };
        const plan = MissionPlanSchema.parse(lockedProposal.content);
        const orderedActions = plan.checkpoints.flatMap((checkpoint) => checkpoint.actions);
        const first = orderedActions.find((action) => action.dependsOn.length === 0);
        if (!first) return { error: "NO_NEXT_ACTION" as const };
        const [currentMission] = await tx
          .select({ row: mission })
          .from(mission)
          .innerJoin(missionProposal, eq(mission.proposalId, missionProposal.id))
          .where(
            and(
              eq(missionProposal.draftId, detail.id),
              eq(mission.workspaceId, access.workspaceId),
              eq(mission.ownerUserId, access.userId),
            ),
          )
          .limit(1)
          .for("update", { of: mission });
        const replacing = currentMission?.row;
        if (lockedDraft.status === "activated" && !replacing)
          return { error: "STALE_PROPOSAL" as const };
        if (
          replacing &&
          (proposalManifest.currentMission?.id !== replacing.id ||
            proposalManifest.currentMission.revision !== replacing.revision)
        )
          return { error: "STALE_PROPOSAL" as const };
        const missionId = replacing?.id ?? randomUUID();
        const sourceReferences = [
          ...proposalManifest.sources
            .filter((source) => source.scope === "workspace")
            .map((source) => ({ ...source, cited: false })),
          ...detail.sources.map(({ id, fileName, contentHash, provenance }) => ({
            id,
            scope: "mission",
            title: fileName,
            fileName,
            contentHash,
            provenance,
            revision: 1,
            excerptIds: [],
            omittedExcerptCount: 0,
            cited: false,
          })),
        ].map((source) => ({
          ...source,
          cited: (lockedProposal.citationReferences as CitationReference[]).some(
            (citation) => citation.scope === source.scope && citation.sourceId === source.id,
          ),
        }));
        const savedMission = {
          id: missionId,
          workspaceId: access.workspaceId,
          ownerUserId: access.userId,
          proposalId: lockedProposal.id,
          content: {
            ...plan,
            sourceReferences,
            citations: lockedProposal.citationReferences,
            contextManifest: proposalManifest,
          },
          revision: (replacing?.revision ?? 0) + 1,
          createdAt: replacing?.createdAt ?? now,
        };
        if (replacing) await tx.update(mission).set(savedMission).where(eq(mission.id, missionId));
        else await tx.insert(mission).values(savedMission);
        const previousActions = replacing
          ? await tx
              .select()
              .from(missionAction)
              .where(and(eq(missionAction.missionId, missionId), isNull(missionAction.archivedAt)))
              .for("update")
          : [];
        const availableByTitle = new Map(
          previousActions.map((action) => [action.title.toLocaleLowerCase(), action]),
        );
        const claimedIds = new Set<string>();
        const actions: (typeof missionAction.$inferInsert)[] = [];
        for (const [checkpointIndex, checkpoint] of plan.checkpoints.entries()) {
          for (const [actionIndex, action] of checkpoint.actions.entries()) {
            const position = checkpointIndex * 100 + actionIndex;
            const exactMatch = availableByTitle.get(action.title.toLocaleLowerCase());
            const existingAction =
              exactMatch && !claimedIds.has(exactMatch.id)
                ? exactMatch
                : previousActions.find(
                    (candidate) => candidate.position === position && !claimedIds.has(candidate.id),
                  );
            if (existingAction) {
              claimedIds.add(existingAction.id);
              const updated = {
                checkpointName: checkpoint.name,
                title: action.title,
                detail: action.detail,
                completionCriteria: action.detail,
                category: action.category ?? "Uncategorized",
                priority: action.priority.toLowerCase(),
                dependencies: action.dependsOn,
                position,
                dueOn: action.dueOn ?? null,
                archivedAt: null,
                ...(existingAction.status === "completed"
                  ? {}
                  : { evidenceStatus: "awaiting_evidence", evidenceReason: null }),
              };
              await tx
                .update(missionAction)
                .set(updated)
                .where(eq(missionAction.id, existingAction.id));
              actions.push({ ...existingAction, ...updated });
            } else {
              const created = {
                id: randomUUID(),
                missionId,
                checkpointName: checkpoint.name,
                title: action.title,
                detail: action.detail,
                completionCriteria: action.detail,
                category: action.category ?? "Uncategorized",
                priority: action.priority.toLowerCase(),
                dependencies: action.dependsOn,
                position,
                status: "upcoming",
                dueOn: action.dueOn ?? null,
              };
              await tx.insert(missionAction).values(created);
              await tx
                .insert(missionActionMember)
                .values({ actionId: created.id, userId: access.userId });
              const actionContexts = sourceReferences.map((source) => ({
                actionId: created.id,
                sourceId: source.id,
              }));
              if (actionContexts.length)
                await tx.insert(missionActionContext).values(actionContexts);
              actions.push(created);
            }
            const reconciled = actions[actions.length - 1];
            await scheduleActionDeadlineFollowUps(tx, reconciled, now);
          }
        }
        const archivedIds = previousActions
          .filter((action) => !claimedIds.has(action.id))
          .map((action) => action.id);
        if (archivedIds.length) {
          await tx
            .update(missionAction)
            .set({ archivedAt: now })
            .where(inArray(missionAction.id, archivedIds));
          await tx
            .update(actionFollowUp)
            .set({ status: "cancelled" })
            .where(
              and(
                inArray(actionFollowUp.actionId, archivedIds),
                eq(actionFollowUp.status, "scheduled"),
              ),
            );
          await tx.delete(attentionItem).where(inArray(attentionItem.actionId, archivedIds));
        }
        await tx.delete(attentionItem).where(eq(attentionItem.missionId, missionId));
        const next = actions.find(
          (action) =>
            action.status === "upcoming" &&
            Array.isArray(action.dependencies) &&
            action.dependencies.every((dependency) =>
              actions.some(
                (candidate) => candidate.title === dependency && candidate.status === "completed",
              ),
            ),
        );
        if (next)
          await tx.insert(attentionItem).values({
            id: randomUUID(),
            workspaceId: access.workspaceId,
            userId: access.userId,
            missionId,
            actionId: next.id!,
            title: next.title,
            reason: plan.recommendation,
            createdAt: now,
          });
        await tx
          .update(missionDraft)
          .set({ status: "activated", updatedAt: now })
          .where(and(eq(missionDraft.id, detail.id), eq(missionDraft.status, "draft")));
        await tx
          .update(missionProposal)
          .set({ status: "activated" })
          .where(
            and(eq(missionProposal.id, lockedProposal.id), eq(missionProposal.status, "current")),
          );
        await tx.insert(domainEvent).values({
          id: randomUUID(),
          workspaceId: access.workspaceId,
          userId: access.userId,
          eventType: replacing ? "mission.plan_regenerated" : "mission.activated",
          payload: {
            missionId,
            proposalId: lockedProposal.id,
            previousProposalId: replacing?.proposalId ?? null,
          },
          createdAt: now,
        });
        await tx.insert(outbox).values({
          id: randomUUID(),
          eventName: replacing ? "polar/mission.plan_regenerated" : "polar/mission.activated",
          payload: { missionId, workspaceId: access.workspaceId },
          createdAt: now,
        });
        return { missionId };
      });
      if ("error" in activation) {
        return reply.status(activation.error === "DRAFT_NOT_FOUND" ? 404 : 409).send({
          error: activation.error,
          message:
            activation.error === "NO_NEXT_ACTION"
              ? "Add a concrete first action before activating."
              : activation.error === "WORKSPACE_CONTEXT_CHANGED"
                ? "Workspace context changed — refresh the plan before activating."
                : "The plan changed. Review the latest proposal before activating.",
        });
      }
      return activation;
    },
  );

  app.patch<{ Params: { missionId: string; actionId: string } }>(
    "/api/app/missions/:missionId/actions/:actionId",
    async (request, reply) => {
      const access = await requireWorkspace(auth, db, request, reply);
      if (!access) return;
      if (
        !UUID_ID_PATTERN.test(request.params.missionId) ||
        !UUID_ID_PATTERN.test(request.params.actionId)
      ) {
        return reply.status(400).send({
          error: "INVALID_ACTION",
          message: "Action details are invalid.",
        });
      }
      const parsed = MissionActionUpdateSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: "INVALID_ACTION_UPDATE",
          message: "Choose valid action members, context, deadline, or priority.",
        });
      }

      const result = await db.transaction(async (tx) => {
        const [savedMission] = await tx
          .select()
          .from(mission)
          .where(
            and(
              eq(mission.id, request.params.missionId),
              eq(mission.workspaceId, access.workspaceId),
            ),
          )
          .limit(1)
          .for("update");
        if (!savedMission) return { error: "MISSION_NOT_FOUND" as const };

        const [savedAction] = await tx
          .select()
          .from(missionAction)
          .where(
            and(
              eq(missionAction.id, request.params.actionId),
              eq(missionAction.missionId, savedMission.id),
            ),
          )
          .limit(1)
          .for("update");
        if (!savedAction) return { error: "ACTION_NOT_FOUND" as const };

        const update = parsed.data;
        if (update.assigneeIds !== undefined && update.assigneeIds.length) {
          const members = await tx
            .select({ userId: workspaceMembership.userId })
            .from(workspaceMembership)
            .where(
              and(
                eq(workspaceMembership.workspaceId, access.workspaceId),
                inArray(workspaceMembership.userId, update.assigneeIds),
              ),
            );
          if (members.length !== update.assigneeIds.length) {
            return { error: "INVALID_ACTION_MEMBER" as const };
          }
        }

        if (update.contextSourceIds !== undefined) {
          const availableSourceIds = new Set(missionContextSourceIds(savedMission.content));
          if (update.contextSourceIds.some((sourceId) => !availableSourceIds.has(sourceId))) {
            return { error: "INVALID_ACTION_CONTEXT" as const };
          }
        }

        const actionChanges: Partial<typeof missionAction.$inferInsert> = {};
        let updatedContent: Record<string, unknown> | null = null;
        if (update.priority !== undefined) actionChanges.priority = update.priority.toLowerCase();
        if (Object.hasOwn(update, "dueOn")) {
          actionChanges.dueOn = update.dueOn ?? null;
          updatedContent = withActionDeadline(
            savedMission.content,
            savedAction.checkpointName,
            savedAction.title,
            update.dueOn ?? null,
          );
          if (!updatedContent) return { error: "ACTION_PLAN_OUT_OF_SYNC" as const };
        }
        if (Object.keys(actionChanges).length) {
          await tx
            .update(missionAction)
            .set(actionChanges)
            .where(eq(missionAction.id, savedAction.id));
        }
        if (Object.hasOwn(update, "dueOn")) {
          await scheduleActionDeadlineFollowUps(
            tx,
            { ...savedAction, ...actionChanges },
            new Date(),
          );
        }

        if (update.assigneeIds !== undefined) {
          await tx
            .delete(missionActionMember)
            .where(eq(missionActionMember.actionId, savedAction.id));
          if (update.assigneeIds.length) {
            await tx
              .insert(missionActionMember)
              .values(update.assigneeIds.map((userId) => ({ actionId: savedAction.id, userId })));
          }
        }
        if (update.contextSourceIds !== undefined) {
          await tx
            .delete(missionActionContext)
            .where(eq(missionActionContext.actionId, savedAction.id));
          if (update.contextSourceIds.length) {
            await tx.insert(missionActionContext).values(
              update.contextSourceIds.map((sourceId) => ({
                actionId: savedAction.id,
                sourceId,
              })),
            );
          }
        }
        const now = new Date();
        await tx
          .update(mission)
          .set({
            revision: savedMission.revision + 1,
            ...(updatedContent ? { content: updatedContent } : {}),
          })
          .where(eq(mission.id, savedMission.id));
        await tx.insert(domainEvent).values({
          id: randomUUID(),
          workspaceId: access.workspaceId,
          userId: access.userId,
          eventType: "mission.action_updated",
          payload: {
            missionId: savedMission.id,
            actionId: savedAction.id,
            changedFields: Object.keys(update),
          },
          createdAt: now,
        });
        await tx.insert(outbox).values({
          id: randomUUID(),
          eventName: "polar/mission.action_updated",
          payload: {
            missionId: savedMission.id,
            actionId: savedAction.id,
            workspaceId: access.workspaceId,
          },
          createdAt: now,
        });
        return {
          missionId: savedMission.id,
          actionId: savedAction.id,
          revision: savedMission.revision + 1,
        };
      });

      if ("error" in result && result.error) {
        const status =
          result.error === "MISSION_NOT_FOUND" || result.error === "ACTION_NOT_FOUND"
            ? 404
            : result.error === "INVALID_ACTION_MEMBER" || result.error === "INVALID_ACTION_CONTEXT"
              ? 400
              : 409;
        const messages = {
          MISSION_NOT_FOUND: "This mission is no longer available.",
          ACTION_NOT_FOUND: "This action is no longer available.",
          INVALID_ACTION_MEMBER: "Assign this action only to current workspace members.",
          INVALID_ACTION_CONTEXT: "Choose context already included with this mission.",
          ACTION_PLAN_OUT_OF_SYNC:
            "The action schedule changed. Refresh the mission and try again.",
        };
        return reply.status(status).send({ error: result.error, message: messages[result.error] });
      }
      return result;
    },
  );

  app.get<{ Params: { missionId: string; actionId: string } }>(
    "/api/app/missions/:missionId/actions/:actionId/activity",
    async (request, reply) => {
      const access = await requireWorkspace(auth, db, request, reply);
      if (!access) return;
      const action = await findWorkspaceAction(
        db,
        access.workspaceId,
        request.params.missionId,
        request.params.actionId,
        true,
      );
      if (!action)
        return reply
          .status(404)
          .send({ error: "ACTION_NOT_FOUND", message: "This action is unavailable." });
      const [messages, evidence, currentMission, missionActions] = await Promise.all([
        db
          .select()
          .from(actionMessage)
          .where(eq(actionMessage.actionId, action.id))
          .orderBy(asc(actionMessage.createdAt)),
        db
          .select()
          .from(actionEvidence)
          .where(eq(actionEvidence.actionId, action.id))
          .orderBy(asc(actionEvidence.createdAt)),
        db
          .select({ content: mission.content })
          .from(mission)
          .where(eq(mission.id, action.missionId))
          .limit(1),
        db
          .select({
            title: missionAction.title,
            status: missionAction.status,
            completionCriteria: missionAction.completionCriteria,
            evidenceStatus: missionAction.evidenceStatus,
            evidenceReason: missionAction.evidenceReason,
          })
          .from(missionAction)
          .where(
            and(eq(missionAction.missionId, action.missionId), isNull(missionAction.archivedAt)),
          )
          .orderBy(asc(missionAction.position)),
      ]);
      const content = (currentMission[0]?.content ?? {}) as {
        outcome?: string;
        successCriteria?: string[];
      };
      return {
        completionCriteria: action.completionCriteria || action.detail,
        missionRevision: action.missionRevision,
        evidenceStatus: action.evidenceStatus,
        evidenceReason: action.evidenceReason,
        messages,
        evidence,
        missionOutcome: content.outcome ?? "",
        successCriteria: content.successCriteria ?? [],
        missionActions,
        canParticipate:
          !action.archivedAt &&
          (await isActionMember(db, access.workspaceId, action.id, access.userId)),
      };
    },
  );

  app.post<{ Params: { missionId: string; actionId: string } }>(
    "/api/app/missions/:missionId/actions/:actionId/messages",
    async (request, reply) => {
      const access = await requireWorkspace(auth, db, request, reply);
      if (!access) return;
      const parsed = ActionConversationMessageSchema.safeParse(request.body);
      if (!parsed.success) return invalid(reply, "Enter a valid action message.");
      const action = await findWorkspaceAction(
        db,
        access.workspaceId,
        request.params.missionId,
        request.params.actionId,
      );
      if (!action)
        return reply
          .status(404)
          .send({ error: "ACTION_NOT_FOUND", message: "This action is unavailable." });
      const now = new Date();
      const saved = await db.transaction(async (tx) => {
        const [membership] = await tx
          .select({ userId: missionActionMember.userId })
          .from(missionActionMember)
          .innerJoin(
            workspaceMembership,
            and(
              eq(workspaceMembership.userId, missionActionMember.userId),
              eq(workspaceMembership.workspaceId, access.workspaceId),
            ),
          )
          .where(
            and(
              eq(missionActionMember.actionId, action.id),
              eq(missionActionMember.userId, access.userId),
            ),
          )
          .for("update")
          .limit(1);
        if (!membership) return { error: "ACTION_MEMBERSHIP_REQUIRED" as const };
        const [message] = await tx
          .insert(actionMessage)
          .values({
            id: randomUUID(),
            actionId: action.id,
            authorUserId: access.userId,
            role: "human",
            content: parsed.data.content,
            conclusion: parsed.data.conclusion,
            idempotencyKey: parsed.data.idempotencyKey,
            createdAt: now,
          })
          .onConflictDoNothing()
          .returning();
        if (message) {
          const [currentMission] = await tx
            .select({ revision: mission.revision })
            .from(mission)
            .where(eq(mission.id, action.missionId))
            .for("update")
            .limit(1);
          if (currentMission)
            await tx
              .update(mission)
              .set({ revision: currentMission.revision + 1 })
              .where(eq(mission.id, action.missionId));
          await tx
            .update(missionAction)
            .set({
              evidenceStatus: "awaiting_evaluation",
              evidenceReason:
                "Polar is reviewing the new conversation against the completion criteria.",
            })
            .where(eq(missionAction.id, action.id));
          await tx
            .update(actionFollowUp)
            .set({ status: "cancelled" })
            .where(
              and(
                eq(actionFollowUp.actionId, action.id),
                eq(actionFollowUp.kind, "unanswered_question"),
                eq(actionFollowUp.status, "scheduled"),
              ),
            );
          await tx.insert(domainEvent).values({
            id: randomUUID(),
            workspaceId: access.workspaceId,
            userId: access.userId,
            eventType: "mission.action_message_added",
            payload: { missionId: action.missionId, actionId: action.id, messageId: message.id },
            createdAt: now,
          });
          await tx.insert(outbox).values({
            id: randomUUID(),
            eventName: "polar/action.updated",
            payload: {
              missionId: action.missionId,
              actionId: action.id,
              workspaceId: access.workspaceId,
            },
            createdAt: now,
          });
        }
        if (message) return { message, duplicate: false };
        const [existingMessage] = await tx
          .select()
          .from(actionMessage)
          .where(
            and(
              eq(actionMessage.actionId, action.id),
              eq(actionMessage.idempotencyKey, parsed.data.idempotencyKey),
            ),
          )
          .limit(1);
        return { message: existingMessage, duplicate: true };
      });
      if ("error" in saved)
        return reply.status(403).send({
          error: saved.error,
          message: "Only current members of this action can participate.",
        });
      return saved;
    },
  );

  app.post<{ Params: { missionId: string; actionId: string } }>(
    "/api/app/missions/:missionId/actions/:actionId/evidence",
    { bodyLimit: EXTRACTED_SOURCE_BODY_LIMIT },
    async (request, reply) => {
      const access = await requireWorkspace(auth, db, request, reply);
      if (!access) return;
      const parsed = ActionEvidenceSubmissionSchema.safeParse(request.body);
      if (!parsed.success)
        return invalid(reply, "Submit text, a reference link, or extracted document text.");
      const action = await findWorkspaceAction(
        db,
        access.workspaceId,
        request.params.missionId,
        request.params.actionId,
      );
      if (!action)
        return reply
          .status(404)
          .send({ error: "ACTION_NOT_FOUND", message: "This action is unavailable." });
      const now = new Date();
      const saved = await db.transaction(async (tx) => {
        const [membership] = await tx
          .select({ userId: missionActionMember.userId })
          .from(missionActionMember)
          .innerJoin(
            workspaceMembership,
            and(
              eq(workspaceMembership.userId, missionActionMember.userId),
              eq(workspaceMembership.workspaceId, access.workspaceId),
            ),
          )
          .where(
            and(
              eq(missionActionMember.actionId, action.id),
              eq(missionActionMember.userId, access.userId),
            ),
          )
          .for("update")
          .limit(1);
        if (!membership) return { error: "ACTION_MEMBERSHIP_REQUIRED" as const };
        const [evidence] = await tx
          .insert(actionEvidence)
          .values({
            id: randomUUID(),
            actionId: action.id,
            submittedBy: access.userId,
            kind: parsed.data.kind,
            content: parsed.data.content,
            referenceUrl: parsed.data.referenceUrl ?? null,
            evaluation: "pending",
            idempotencyKey: parsed.data.idempotencyKey,
            createdAt: now,
          })
          .onConflictDoNothing()
          .returning();
        if (evidence) {
          const [currentMission] = await tx
            .select({ revision: mission.revision })
            .from(mission)
            .where(eq(mission.id, action.missionId))
            .for("update")
            .limit(1);
          if (currentMission)
            await tx
              .update(mission)
              .set({ revision: currentMission.revision + 1 })
              .where(eq(mission.id, action.missionId));
          await tx
            .update(missionAction)
            .set({
              evidenceStatus: "awaiting_evaluation",
              evidenceReason: "Evidence is saved and awaiting evaluation.",
            })
            .where(eq(missionAction.id, action.id));
          await tx.insert(domainEvent).values({
            id: randomUUID(),
            workspaceId: access.workspaceId,
            userId: access.userId,
            eventType: "mission.action_evidence_submitted",
            payload: {
              missionId: action.missionId,
              actionId: action.id,
              evidenceId: evidence.id,
            },
            createdAt: now,
          });
          await tx.insert(outbox).values({
            id: randomUUID(),
            eventName: "polar/action.updated",
            payload: {
              missionId: action.missionId,
              actionId: action.id,
              workspaceId: access.workspaceId,
            },
            createdAt: now,
          });
        }
        if (evidence) return { evidence, duplicate: false };
        const [existingEvidence] = await tx
          .select()
          .from(actionEvidence)
          .where(
            and(
              eq(actionEvidence.actionId, action.id),
              eq(actionEvidence.idempotencyKey, parsed.data.idempotencyKey),
            ),
          )
          .limit(1);
        return { evidence: existingEvidence, duplicate: true };
      });
      if ("error" in saved)
        return reply.status(403).send({
          error: saved.error,
          message: "Only current members of this action can submit evidence.",
        });
      return saved;
    },
  );

  app.post<{ Params: { missionId: string; actionId: string } }>(
    "/api/app/missions/:missionId/actions/:actionId/evaluation",
    async (request, reply) => {
      const access = await requireWorkspace(auth, db, request, reply);
      if (!access) return;
      const parsed = ActionEvaluationSchema.safeParse(request.body);
      if (!parsed.success) return invalid(reply, "Polar returned an invalid action assessment.");
      const deviceId = header(request, "x-polar-device-id");
      if (typeof deviceId !== "string" || !(await deviceBelongsTo(db, access.userId, deviceId)))
        return reply.status(403).send({
          error: "DEVICE_REQUIRED",
          message: "This device is not registered to your Polar account.",
        });
      const result = await db.transaction(async (tx) => {
        const [savedMission] = await tx
          .select()
          .from(mission)
          .where(
            and(
              eq(mission.id, request.params.missionId),
              eq(mission.workspaceId, access.workspaceId),
            ),
          )
          .for("update")
          .limit(1);
        if (!savedMission) return { error: "MISSION_NOT_FOUND" as const };
        if (savedMission.revision !== parsed.data.expectedRevision)
          return { error: "STALE_ACTION" as const };
        const [savedAction] = await tx
          .select()
          .from(missionAction)
          .where(
            and(
              eq(missionAction.id, request.params.actionId),
              eq(missionAction.missionId, savedMission.id),
              isNull(missionAction.archivedAt),
            ),
          )
          .for("update")
          .limit(1);
        if (!savedAction) return { error: "ACTION_NOT_FOUND" as const };
        const evidenceRows = await tx
          .select()
          .from(actionEvidence)
          .where(eq(actionEvidence.actionId, savedAction.id));
        const humanConclusions = await tx
          .select({ id: actionMessage.id })
          .from(actionMessage)
          .where(
            and(
              eq(actionMessage.actionId, savedAction.id),
              eq(actionMessage.role, "human"),
              eq(actionMessage.conclusion, true),
            ),
          )
          .limit(1);
        const supported = evidenceRows.length > 0 || humanConclusions.length > 0;
        const outcome =
          parsed.data.outcome === "accepted" && !supported ? "insufficient" : parsed.data.outcome;
        const status = outcome === "accepted" ? "completed" : "upcoming";
        const evidenceStatus =
          outcome === "accepted"
            ? "accepted"
            : outcome === "conflicting"
              ? "review"
              : "insufficient";
        const now = new Date();
        await tx
          .update(missionAction)
          .set({ status, evidenceStatus, evidenceReason: parsed.data.reason })
          .where(eq(missionAction.id, savedAction.id));
        await tx
          .update(actionEvidence)
          .set({ evaluation: outcome, evaluationReason: parsed.data.reason })
          .where(eq(actionEvidence.actionId, savedAction.id));
        const activeActions = await tx
          .select()
          .from(missionAction)
          .where(
            and(eq(missionAction.missionId, savedMission.id), isNull(missionAction.archivedAt)),
          );
        const evaluatedActions = activeActions.map((candidate) =>
          candidate.id === savedAction.id ? { ...candidate, status } : candidate,
        );
        const nextAction = selectDependencyReadyAction(evaluatedActions);
        const allActionsComplete =
          evaluatedActions.length > 0 &&
          evaluatedActions.every((candidate) => candidate.status === "completed");
        const outcomeStatus =
          allActionsComplete && parsed.data.missionOutcome === "achieved"
            ? "achieved"
            : allActionsComplete && parsed.data.missionOutcome === "not_achieved"
              ? "needs_attention"
              : allActionsComplete
                ? "outcome_unverified"
                : outcome === "accepted"
                  ? "in_progress"
                  : "needs_attention";
        const assessmentReason = allActionsComplete
          ? (parsed.data.missionOutcomeReason ??
            `All action criteria are accepted, but the mission outcome remains unverified against: ${(savedMission.content as { successCriteria?: string[] }).successCriteria?.join("; ") ?? "the stated success criteria."}`)
          : outcome === "accepted"
            ? `Evidence accepted for “${savedAction.title}”. ${nextAction ? `Next ready action: ${nextAction.title}.` : "No dependency-ready action is available; resolve the current blocker."}`
            : (parsed.data.question ?? parsed.data.reason);
        if (parsed.data.question) {
          await tx
            .insert(actionMessage)
            .values({
              id: randomUUID(),
              actionId: savedAction.id,
              authorUserId: null,
              role: "assistant",
              content: parsed.data.question,
              conclusion: false,
              idempotencyKey: `evaluation:${parsed.data.expectedRevision}`,
              createdAt: now,
            })
            .onConflictDoNothing();
        }
        await tx.delete(attentionItem).where(eq(attentionItem.actionId, savedAction.id));
        if (outcome !== "accepted") {
          await tx.insert(attentionItem).values({
            id: randomUUID(),
            workspaceId: access.workspaceId,
            userId: savedMission.ownerUserId,
            missionId: savedMission.id,
            actionId: savedAction.id,
            title: parsed.data.question ? "Action needs an answer" : "Evidence needs attention",
            reason: parsed.data.question ?? parsed.data.reason,
            createdAt: now,
          });
        }
        await tx
          .update(actionFollowUp)
          .set({ status: "cancelled" })
          .where(
            and(
              eq(actionFollowUp.actionId, savedAction.id),
              eq(actionFollowUp.status, "scheduled"),
            ),
          );
        if (outcome !== "accepted" && parsed.data.question) {
          await tx.insert(actionFollowUp).values({
            id: randomUUID(),
            actionId: savedAction.id,
            kind: "unanswered_question",
            dueAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
            status: "scheduled",
            createdAt: now,
          });
        }
        await tx
          .update(mission)
          .set({ revision: savedMission.revision + 1 })
          .where(eq(mission.id, savedMission.id));
        await tx
          .insert(missionAssessment)
          .values({
            missionId: savedMission.id,
            status: outcomeStatus,
            reason: assessmentReason,
            nextActionId: nextAction?.id ?? null,
            revision: savedMission.revision + 1,
            updatedAt: now,
          })
          .onConflictDoUpdate({
            target: missionAssessment.missionId,
            set: {
              status: outcomeStatus,
              reason: assessmentReason,
              nextActionId: nextAction?.id ?? null,
              revision: savedMission.revision + 1,
              updatedAt: now,
            },
          });
        await tx.insert(domainEvent).values({
          id: randomUUID(),
          workspaceId: access.workspaceId,
          userId: access.userId,
          eventType: "mission.action_evaluated",
          payload: { missionId: savedMission.id, actionId: savedAction.id, outcome },
          createdAt: now,
        });
        await tx.insert(outbox).values({
          id: randomUUID(),
          eventName: "polar/action.evaluated",
          payload: {
            missionId: savedMission.id,
            actionId: savedAction.id,
            workspaceId: access.workspaceId,
          },
          createdAt: now,
        });
        return {
          outcome,
          status,
          evidenceStatus,
          reason: parsed.data.reason,
          revision: savedMission.revision + 1,
        };
      });
      if ("error" in result) {
        const status =
          result.error === "MISSION_NOT_FOUND" || result.error === "ACTION_NOT_FOUND" ? 404 : 409;
        return reply.status(status).send({
          error: result.error,
          message:
            result.error === "STALE_ACTION"
              ? "Action context changed while it was being evaluated. Review the latest activity and retry."
              : "This action is no longer available.",
        });
      }
      return result;
    },
  );

  app.get("/api/app/attention", async (request, reply) => {
    const access = await requireWorkspace(auth, db, request, reply);
    if (!access) return;
    const now = new Date();
    await db.transaction(async (tx) => {
      const due = await tx
        .select({ followUp: actionFollowUp, action: missionAction, mission: mission })
        .from(actionFollowUp)
        .innerJoin(missionAction, eq(missionAction.id, actionFollowUp.actionId))
        .innerJoin(mission, eq(mission.id, missionAction.missionId))
        .where(
          and(
            eq(actionFollowUp.status, "scheduled"),
            eq(missionAction.status, "upcoming"),
            lte(actionFollowUp.dueAt, now),
            eq(mission.workspaceId, access.workspaceId),
            isNull(missionAction.archivedAt),
          ),
        )
        .for("update");
      for (const row of due) {
        const recent = await tx
          .select({ id: actionFollowUp.id })
          .from(actionFollowUp)
          .where(
            and(
              eq(actionFollowUp.actionId, row.action.id),
              eq(actionFollowUp.status, "delivered"),
              gt(actionFollowUp.deliveredAt, new Date(now.getTime() - 24 * 60 * 60 * 1000)),
            ),
          )
          .limit(1);
        if (recent.length) {
          await tx
            .update(actionFollowUp)
            .set({ status: "coalesced" })
            .where(eq(actionFollowUp.id, row.followUp.id));
          continue;
        }
        const members = await tx
          .select({ userId: missionActionMember.userId })
          .from(missionActionMember)
          .innerJoin(
            workspaceMembership,
            and(
              eq(workspaceMembership.userId, missionActionMember.userId),
              eq(workspaceMembership.workspaceId, access.workspaceId),
            ),
          )
          .where(eq(missionActionMember.actionId, row.action.id));
        for (const member of members) {
          await tx.insert(attentionItem).values({
            id: randomUUID(),
            workspaceId: access.workspaceId,
            userId: member.userId,
            missionId: row.mission.id,
            actionId: row.action.id,
            title:
              row.followUp.kind === "unanswered_question"
                ? "An action needs a reply"
                : row.followUp.kind === "deadline_approaching"
                  ? "Action deadline tomorrow"
                  : "Action is overdue",
            reason: row.action.title,
            createdAt: now,
          });
        }
        await tx
          .update(actionFollowUp)
          .set({ status: "delivered", deliveredAt: now })
          .where(eq(actionFollowUp.id, row.followUp.id));
      }
    });
    return db
      .select({
        id: attentionItem.id,
        missionId: attentionItem.missionId,
        actionId: attentionItem.actionId,
        title: attentionItem.title,
        reason: attentionItem.reason,
        createdAt: attentionItem.createdAt,
      })
      .from(attentionItem)
      .where(
        and(
          eq(attentionItem.workspaceId, access.workspaceId),
          eq(attentionItem.userId, access.userId),
        ),
      )
      .orderBy(desc(attentionItem.createdAt))
      .limit(20);
  });

  app.get("/api/app/missions", async (request, reply) => {
    const access = await requireWorkspace(auth, db, request, reply);
    if (!access) return;
    const rows = await db
      .select()
      .from(mission)
      .where(eq(mission.workspaceId, access.workspaceId))
      .orderBy(desc(mission.createdAt));
    const workspacePeople = await db
      .select({
        id: polarUser.id,
        name: polarUser.displayName,
        role: workspaceMembership.role,
      })
      .from(workspaceMembership)
      .innerJoin(polarUser, eq(polarUser.id, workspaceMembership.userId))
      .where(eq(workspaceMembership.workspaceId, access.workspaceId));
    const people = workspacePeople.map((person) => ({
      ...person,
      initials: personInitials(person.name),
    }));
    const result = [];
    const missionIds = rows.map((row) => row.id);
    const assessments = missionIds.length
      ? await db
          .select()
          .from(missionAssessment)
          .where(inArray(missionAssessment.missionId, missionIds))
      : [];
    const assessmentByMission = new Map(
      assessments.map((assessment) => [assessment.missionId, assessment]),
    );
    for (const row of rows) {
      const actions = await db
        .select()
        .from(missionAction)
        .where(and(eq(missionAction.missionId, row.id), isNull(missionAction.archivedAt)))
        .orderBy(asc(missionAction.position));
      const content = row.content as {
        name: string;
        outcome: string;
        deadlineAt: string | null;
        assessment: string;
        recommendation: string;
        checkpoints: {
          name: string;
          detail: string;
          dueOn?: string | null;
          actions: { title: string; dueOn?: string | null }[];
        }[];
        constraints: string[];
        successCriteria: string[];
        risks: string[];
        assumptions: string[];
        sourceReferences: {
          id: string;
          scope: string;
          title: string;
          fileName?: string | null;
          contentHash: string;
          provenance: string;
          revision: number;
          cited?: boolean;
        }[];
      };
      const currentSources = await db
        .select({
          id: workspaceContextSource.id,
          revision: workspaceContextSource.revision,
          archivedAt: workspaceContextSource.archivedAt,
        })
        .from(workspaceContextSource)
        .where(
          and(
            eq(workspaceContextSource.workspaceId, row.workspaceId),
            isNull(workspaceContextSource.archivedAt),
          ),
        );
      const currentSourceMap = new Map(currentSources.map((source) => [source.id, source]));
      const [currentWorkspaceContext] = await db
        .select({ revision: workspaceContext.revision })
        .from(workspaceContext)
        .where(eq(workspaceContext.workspaceId, row.workspaceId))
        .limit(1);
      currentSourceMap.set(row.workspaceId, {
        id: row.workspaceId,
        revision: currentWorkspaceContext?.revision ?? 1,
        archivedAt: null,
      });
      const actionIds = actions.map((action) => action.id);
      const assignedMembers = actionIds.length
        ? await db
            .select({ actionId: missionActionMember.actionId, userId: missionActionMember.userId })
            .from(missionActionMember)
            .where(inArray(missionActionMember.actionId, actionIds))
        : [];
      const actionSources = actionIds.length
        ? await db
            .select({
              actionId: missionActionContext.actionId,
              sourceId: missionActionContext.sourceId,
            })
            .from(missionActionContext)
            .where(inArray(missionActionContext.actionId, actionIds))
        : [];
      const assigneeIdsByAction = new Map<string, string[]>();
      for (const assignment of assignedMembers) {
        const ids = assigneeIdsByAction.get(assignment.actionId) ?? [];
        ids.push(assignment.userId);
        assigneeIdsByAction.set(assignment.actionId, ids);
      }
      const contextIdsByAction = new Map<string, string[]>();
      for (const source of actionSources) {
        const ids = contextIdsByAction.get(source.actionId) ?? [];
        ids.push(source.sourceId);
        contextIdsByAction.set(source.actionId, ids);
      }
      const nextAction = selectDependencyReadyAction(actions);
      const assessment = assessmentByMission.get(row.id);
      result.push({
        id: row.id,
        revision: row.revision,
        name: content.name,
        outcome: content.outcome,
        deadlineAt: content.deadlineAt,
        assessment: assessment?.reason ?? content.assessment,
        progressStatus: assessment?.status ?? "in_progress",
        progressRevision: assessment?.revision ?? row.revision,
        recommendation: content.recommendation,
        checkpoints: content.checkpoints,
        constraints: content.constraints,
        successCriteria: content.successCriteria,
        risks: content.risks,
        assumptions: content.assumptions,
        currentUserId: access.userId,
        workspacePeople: people,
        actions: actions.map(
          ({
            id,
            title,
            detail,
            completionCriteria,
            evidenceStatus,
            evidenceReason,
            category,
            priority,
            status,
            dependencies,
            dueOn,
          }) => ({
            id,
            title,
            detail,
            completionCriteria: completionCriteria || detail,
            evidenceStatus: status === "completed" ? "accepted" : evidenceStatus,
            evidenceReason,
            category,
            priority,
            status,
            dependencies,
            dueOn: dueOn ?? null,
            assigneeIds: assigneeIdsByAction.get(id) ?? [],
            contextSourceIds: contextIdsByAction.get(id) ?? [],
          }),
        ),
        nextAction,
        sources: content.sourceReferences.map((source) => {
          if (source.scope !== "workspace") return source;
          const current = currentSourceMap.get(source.id);
          return {
            ...source,
            currentState:
              !current || current.archivedAt
                ? "removed"
                : current.revision === source.revision
                  ? "current"
                  : "changed",
          };
        }),
        activity: [
          {
            title: "You created this mission",
            timing: "Just now",
            icon: "plus",
            detail: "Mission activated from a reviewed proposal.",
          },
        ],
      });
    }
    return result;
  });
}

export function createMissionFunctions(inngest: Inngest, db: PolarDatabase) {
  return [
    inngest.createFunction(
      {
        id: "mission-reasoning-request",
        retries: 4,
        triggers: [{ event: "polar/reasoning.requested" }],
      },
      async ({ event, step }) => {
        const requestId = event.data.requestId as string;
        await step.run("mark-awaiting-device", async () => {
          await db
            .update(reasoningRequest)
            .set({ status: "queued", updatedAt: new Date() })
            .where(and(eq(reasoningRequest.id, requestId), eq(reasoningRequest.status, "queued")));
        });
        await step.waitForEvent("await-authorized-desktop-result", {
          event: "polar/reasoning.completed",
          match: "data.requestId",
          timeout: "15m",
        });
        return { requestId };
      },
    ),
    inngest.createFunction(
      { id: "mission-outbox-recovery", triggers: [{ cron: "*/7 * * * *" }], retries: 2 },
      async ({ step }) =>
        step.run("recover-undelivered-outbox", async () => {
          const pending = await db
            .select()
            .from(outbox)
            .where(isNull(outbox.deliveredAt))
            .orderBy(asc(outbox.createdAt))
            .limit(50);
          let delivered = 0;
          for (const row of pending) {
            try {
              await inngest.send({
                id: row.id,
                name: row.eventName,
                data: row.payload as Record<string, unknown>,
              });
              await db
                .update(outbox)
                .set({ deliveredAt: new Date(), attempts: row.attempts + 1 })
                .where(eq(outbox.id, row.id));
              delivered += 1;
            } catch {
              await db
                .update(outbox)
                .set({ attempts: row.attempts + 1 })
                .where(eq(outbox.id, row.id));
            }
          }
          return { delivered };
        }),
    ),
  ];
}

async function loadDraft(
  db: PolarDatabase,
  access: { userId: string; workspaceId: string },
  id: string,
) {
  const [draft] = await db
    .select()
    .from(missionDraft)
    .where(
      and(
        eq(missionDraft.id, id),
        eq(missionDraft.userId, access.userId),
        eq(missionDraft.workspaceId, access.workspaceId),
      ),
    )
    .limit(1);
  if (!draft) return null;
  const [messages, sources, proposals, jobs] = await Promise.all([
    db
      .select()
      .from(missionMessage)
      .where(eq(missionMessage.draftId, draft.id))
      .orderBy(asc(missionMessage.createdAt)),
    db
      .select()
      .from(missionSource)
      .where(eq(missionSource.draftId, draft.id))
      .orderBy(asc(missionSource.createdAt)),
    db
      .select()
      .from(missionProposal)
      .where(eq(missionProposal.draftId, draft.id))
      .orderBy(desc(missionProposal.revision))
      .limit(1),
    db
      .select({
        id: reasoningRequest.id,
        status: reasoningRequest.status,
        errorMessage: reasoningRequest.errorMessage,
        leaseExpiresAt: reasoningRequest.leaseExpiresAt,
        contextManifest: reasoningRequest.contextManifest,
        createdAt: reasoningRequest.createdAt,
      })
      .from(reasoningRequest)
      .where(eq(reasoningRequest.draftId, draft.id))
      .orderBy(desc(reasoningRequest.createdAt))
      .limit(1),
  ]);
  const [context] = await db
    .select({ revision: workspaceContext.revision })
    .from(workspaceContext)
    .where(eq(workspaceContext.workspaceId, draft.workspaceId))
    .limit(1);
  const latestJob = jobs[0];
  const jobManifest = latestJob?.contextManifest as ContextManifest | null | undefined;
  const contextChanged = Boolean(
    jobManifest && jobManifest.workspaceRevision !== (context?.revision ?? 1),
  );
  return {
    id: draft.id,
    goal: draft.goal,
    status: draft.status,
    messages,
    sources: sources.map(({ extractedText, ...source }) => ({ ...source, extractedText })),
    proposal: proposals[0] ? { ...proposals[0], content: proposals[0].content } : null,
    request: latestJob
      ? contextChanged
        ? {
            ...latestJob,
            status: "stale",
            errorMessage: "Workspace context changed — refresh the plan before review.",
          }
        : latestJob
      : null,
  };
}

export type CitationReference = {
  scope: "workspace" | "mission";
  sourceId: string;
  revision: number;
  excerptId: string;
};
type ContextSourceManifest = {
  scope: "workspace" | "mission";
  id: string;
  title: string;
  revision: number;
  contentHash: string;
  excerptIds: string[];
  omittedExcerptCount: number;
  provenance: string;
};
export type ContextManifest = {
  schemaVersion: 1;
  workspaceId: string;
  workspaceRevision: number;
  audience: string;
  requestedBy: string;
  briefHash: string;
  currentMission?: { id: string; revision: number };
  sources: ContextSourceManifest[];
};

async function assembleContextSnapshot(
  db: PolarDatabase,
  access: { userId: string; workspaceId: string },
  detail: Awaited<ReturnType<typeof loadDraft>> & {},
  messages: { role: string; content: string }[],
) {
  const [context] = await db
    .select()
    .from(workspaceContext)
    .where(eq(workspaceContext.workspaceId, access.workspaceId))
    .limit(1);
  const contextRevision = context?.revision ?? 1;
  const workspaceSources = await db
    .select()
    .from(workspaceContextSource)
    .where(
      and(
        eq(workspaceContextSource.workspaceId, access.workspaceId),
        isNull(workspaceContextSource.archivedAt),
      ),
    )
    .orderBy(asc(workspaceContextSource.id));
  const query = `${detail.goal} ${messages
    .slice(-4)
    .map((message) => message.content)
    .join(" ")}`;
  const workspaceBudget = 64_000;
  const missionBudget = 128_000;
  const briefText = context?.brief ?? "";
  const briefHash = createHash("sha256").update(briefText).digest("hex");
  const briefSource = briefText
    ? makeChunks(
        "workspace",
        access.workspaceId,
        contextRevision,
        briefText,
        "Workspace brief",
        briefHash,
        "brief",
      )
    : null;
  const workspaceParts = workspaceSources.map((source) =>
    makeChunks(
      "workspace",
      source.id,
      source.revision,
      source.extractedText,
      source.title,
      source.contentHash ?? "",
      source.kind,
    ),
  );
  const missionParts = detail.sources.map((source) =>
    makeChunks(
      "mission",
      source.id,
      1,
      source.extractedText,
      source.fileName,
      source.contentHash,
      source.provenance,
    ),
  );
  const workspaceInitial = selectChunks(workspaceParts, query, workspaceBudget);
  const missionInitial = selectChunks(missionParts, query, missionBudget);
  const workspaceUsed = workspaceInitial.reduce((total, chunk) => total + chunk.text.length, 0);
  const missionUsed = missionInitial.reduce((total, chunk) => total + chunk.text.length, 0);
  const workspaceBorrowed = selectChunks(
    workspaceParts,
    query,
    Math.max(0, missionBudget - missionUsed),
    new Set(workspaceInitial.map((chunk) => chunk.excerptId)),
  );
  const missionBorrowed = selectChunks(
    missionParts,
    query,
    Math.max(0, workspaceBudget - workspaceUsed),
    new Set(missionInitial.map((chunk) => chunk.excerptId)),
  );
  const workspaceSelection = [...workspaceInitial, ...workspaceBorrowed].sort(
    (a, b) => a.sourceId.localeCompare(b.sourceId) || a.index - b.index,
  );
  const missionSelection = [...missionInitial, ...missionBorrowed].sort(
    (a, b) => a.sourceId.localeCompare(b.sourceId) || a.index - b.index,
  );
  const sourceManifests: ContextSourceManifest[] = [
    ...(briefSource
      ? [
          {
            scope: "workspace" as const,
            id: access.workspaceId,
            title: "Workspace brief",
            revision: contextRevision,
            contentHash: briefHash,
            excerptIds: briefSource.chunks.map((chunk) => chunk.excerptId),
            omittedExcerptCount: 0,
            provenance: "brief",
          },
        ]
      : []),
    ...workspaceParts.map((source) => ({
      scope: "workspace" as const,
      id: source.id,
      title: source.title,
      revision: source.revision,
      contentHash: source.contentHash,
      excerptIds: workspaceSelection
        .filter((chunk) => chunk.sourceId === source.id)
        .map((chunk) => chunk.excerptId),
      omittedExcerptCount:
        source.chunks.length -
        workspaceSelection.filter((chunk) => chunk.sourceId === source.id).length,
      provenance: source.provenance,
    })),
    ...missionParts.map((source) => ({
      scope: "mission" as const,
      id: source.id,
      title: source.title,
      revision: source.revision,
      contentHash: source.contentHash,
      excerptIds: missionSelection
        .filter((chunk) => chunk.sourceId === source.id)
        .map((chunk) => chunk.excerptId),
      omittedExcerptCount:
        source.chunks.length -
        missionSelection.filter((chunk) => chunk.sourceId === source.id).length,
      provenance: source.provenance,
    })),
  ];
  const [currentMission] = await db
    .select({ row: mission })
    .from(mission)
    .innerJoin(missionProposal, eq(mission.proposalId, missionProposal.id))
    .where(
      and(
        eq(missionProposal.draftId, detail.id),
        eq(mission.workspaceId, access.workspaceId),
        eq(mission.ownerUserId, access.userId),
      ),
    )
    .limit(1);
  const manifest: ContextManifest = {
    schemaVersion: 1,
    workspaceId: access.workspaceId,
    workspaceRevision: contextRevision,
    audience: `workspace:${access.workspaceId}`,
    requestedBy: access.userId,
    briefHash,
    ...(currentMission
      ? { currentMission: { id: currentMission.row.id, revision: currentMission.row.revision } }
      : {}),
    sources: sourceManifests,
  };
  return {
    manifest,
    payload: {
      schemaVersion: 1,
      planningClock: { now: new Date().toISOString(), timeZone: "UTC" },
      workspaceContext: {
        brief: briefText,
        briefExcerpts:
          briefSource?.chunks.map(({ excerptId, text }) => ({ excerptId, text })) ?? [],
        sources: groupedExcerpts(workspaceSelection),
      },
      mission: {
        goal: detail.goal,
        ...(currentMission ? { currentPlan: currentMission.row.content } : {}),
        conversation: messages,
        sources: groupedExcerpts(missionSelection),
      },
      contextManifest: manifest,
      limits: {
        workspaceCharacters: workspaceBudget,
        missionCharacters: missionBudget,
        chunkCharacters: 4000,
        conversationCharacters: MAX_CONVERSATION_CHARS,
      },
    },
  };
}

export function makeChunks(
  scope: "workspace" | "mission",
  id: string,
  revision: number,
  text: string,
  title: string,
  contentHash: string,
  provenance: string,
) {
  const chunks: { excerptId: string; text: string; index: number }[] = [];
  const paragraphs = text
    .split(/\n\s*\n/)
    .flatMap((paragraph) => paragraph.match(/[\s\S]{1,4000}/g) ?? []);
  paragraphs.forEach((paragraph, index) => {
    const normalized = paragraph.trim();
    if (!normalized) return;
    chunks.push({
      excerptId: createHash("sha256")
        .update(`${scope}:${id}:${revision}:${index}:${normalized}`)
        .digest("hex")
        .slice(0, 24),
      text: normalized,
      index,
    });
  });
  return { scope, id, sourceId: id, revision, title, contentHash, provenance, chunks };
}

export function selectChunks(
  sources: ReturnType<typeof makeChunks>[],
  query: string,
  budget: number,
  excluded = new Set<string>(),
) {
  const terms = new Set((query.toLocaleLowerCase().match(/[\p{L}\p{N}]{3,}/gu) ?? []).slice(-500));
  const candidates = sources.flatMap((source) =>
    source.chunks
      .map((chunk) => ({
        ...chunk,
        sourceId: source.id,
        scope: source.scope,
        title: source.title,
        revision: source.revision,
        contentHash: source.contentHash,
        provenance: source.provenance,
        score: lexicalScore(chunk.text, terms),
      }))
      .filter((chunk) => !excluded.has(chunk.excerptId)),
  );
  candidates.sort(
    (a, b) =>
      b.score - a.score ||
      a.scope.localeCompare(b.scope) ||
      a.sourceId.localeCompare(b.sourceId) ||
      a.index - b.index,
  );
  const chosen: typeof candidates = [];
  let remaining = budget;
  for (const candidate of candidates) {
    if (candidate.text.length > remaining) continue;
    chosen.push(candidate);
    remaining -= candidate.text.length;
  }
  return chosen.sort(
    (a, b) =>
      a.scope.localeCompare(b.scope) || a.sourceId.localeCompare(b.sourceId) || a.index - b.index,
  );
}

function lexicalScore(text: string, terms: Set<string>) {
  if (!terms.size) return 0;
  const words = new Set(text.toLocaleLowerCase().match(/[\p{L}\p{N}]{3,}/gu) ?? []);
  let score = 0;
  for (const term of terms) if (words.has(term)) score += 1;
  return score;
}

function groupedExcerpts(chunks: ReturnType<typeof selectChunks>) {
  const grouped = new Map<
    string,
    {
      id: string;
      title: string;
      scope: string;
      revision: number;
      contentHash: string;
      provenance: string;
      excerpts: { excerptId: string; text: string }[];
    }
  >();
  for (const chunk of chunks) {
    const group = grouped.get(chunk.sourceId) ?? {
      id: chunk.sourceId,
      title: chunk.title,
      scope: chunk.scope,
      revision: chunk.revision,
      contentHash: chunk.contentHash,
      provenance: chunk.provenance,
      excerpts: [],
    };
    group.excerpts.push({ excerptId: chunk.excerptId, text: chunk.text });
    grouped.set(chunk.sourceId, group);
  }
  return [...grouped.values()];
}

export function validCitations(citations: CitationReference[], manifest: ContextManifest | null) {
  if (!manifest) return false;
  return citations.every((citation) =>
    manifest.sources.some(
      (source) =>
        source.scope === citation.scope &&
        source.id === citation.sourceId &&
        source.revision === citation.revision &&
        source.excerptIds.includes(citation.excerptId),
    ),
  );
}

async function requireWorkspace(
  auth: PolarAuth,
  db: PolarDatabase,
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const headerEntries: [string, string][] = Object.entries(request.headers).flatMap(
    ([key, value]) =>
      value === undefined
        ? []
        : (Array.isArray(value) ? value : [value]).map((item) => [key, item] as [string, string]),
  );
  const session = await auth.api.getSession({ headers: new Headers(headerEntries) });
  if (!session) {
    reply
      .status(401)
      .send({ error: "UNAUTHENTICATED", message: "Sign in to Polar and try again." });
    return null;
  }
  const workspaceId = header(request, "x-polar-workspace-id");
  const [user] = await db
    .select({ id: polarUser.id })
    .from(polarUser)
    .where(eq(polarUser.authUserId, session.user.id))
    .limit(1);
  if (!user) {
    reply.status(403).send({
      error: "WORKSPACE_ACCESS_REQUIRED",
      message: "You are not a member of this workspace.",
    });
    return null;
  }
  const membership = await db
    .select({
      userId: workspaceMembership.userId,
      workspaceId: workspaceMembership.workspaceId,
      role: workspaceMembership.role,
      privacy: workspace.privacy,
      ownerUserId: workspace.ownerUserId,
    })
    .from(workspaceMembership)
    .innerJoin(workspace, eq(workspace.id, workspaceMembership.workspaceId))
    .where(
      and(
        eq(workspaceMembership.userId, user.id),
        ...(typeof workspaceId === "string"
          ? [eq(workspaceMembership.workspaceId, workspaceId)]
          : []),
      ),
    )
    .limit(1);
  if (
    !membership[0] ||
    typeof workspaceId !== "string" ||
    (membership[0].privacy === "private" &&
      (membership[0].role !== "owner" || membership[0].ownerUserId !== user.id))
  ) {
    reply.status(403).send({
      error: "WORKSPACE_ACCESS_REQUIRED",
      message: "You are not a member of this workspace.",
    });
    return null;
  }
  return membership[0];
}

async function findWorkspaceAction(
  db: PolarDatabase,
  workspaceId: string,
  missionId: string,
  actionId: string,
  includeArchived = false,
) {
  if (!UUID_ID_PATTERN.test(missionId) || !UUID_ID_PATTERN.test(actionId)) return null;
  const [row] = await db
    .select({
      id: missionAction.id,
      missionId: missionAction.missionId,
      missionRevision: mission.revision,
      detail: missionAction.detail,
      completionCriteria: missionAction.completionCriteria,
      evidenceStatus: missionAction.evidenceStatus,
      evidenceReason: missionAction.evidenceReason,
      archivedAt: missionAction.archivedAt,
    })
    .from(missionAction)
    .innerJoin(mission, eq(mission.id, missionAction.missionId))
    .where(
      and(
        eq(missionAction.id, actionId),
        eq(mission.id, missionId),
        eq(mission.workspaceId, workspaceId),
        ...(includeArchived ? [] : [isNull(missionAction.archivedAt)]),
      ),
    )
    .limit(1);
  return row ?? null;
}

async function isActionMember(
  db: PolarDatabase,
  workspaceId: string,
  actionId: string,
  userId: string,
) {
  const [row] = await db
    .select({ userId: missionActionMember.userId })
    .from(missionActionMember)
    .innerJoin(
      workspaceMembership,
      and(
        eq(workspaceMembership.userId, missionActionMember.userId),
        eq(workspaceMembership.workspaceId, workspaceId),
      ),
    )
    .where(and(eq(missionActionMember.actionId, actionId), eq(missionActionMember.userId, userId)))
    .limit(1);
  return Boolean(row);
}

async function scheduleActionDeadlineFollowUps(
  tx: Parameters<Parameters<PolarDatabase["transaction"]>[0]>[0],
  action: { id: string; dueOn?: string | null; status?: string },
  now: Date,
) {
  await tx
    .update(actionFollowUp)
    .set({ status: "cancelled" })
    .where(
      and(
        eq(actionFollowUp.actionId, action.id),
        or(eq(actionFollowUp.kind, "deadline_approaching"), eq(actionFollowUp.kind, "overdue")),
        eq(actionFollowUp.status, "scheduled"),
      ),
    );
  if (!action.dueOn || action.status === "completed") return;
  const deadline = new Date(`${action.dueOn}T09:00:00.000Z`);
  if (Number.isNaN(deadline.getTime())) return;
  const reminders = [
    { kind: "deadline_approaching", dueAt: new Date(deadline.getTime() - 24 * 60 * 60 * 1000) },
    { kind: "overdue", dueAt: new Date(deadline.getTime() + 24 * 60 * 60 * 1000) },
  ].filter((reminder) => reminder.dueAt > now);
  if (reminders.length)
    await tx.insert(actionFollowUp).values(
      reminders.map((reminder) => ({
        id: randomUUID(),
        actionId: action.id,
        ...reminder,
        status: "scheduled",
        createdAt: now,
      })),
    );
}

export function selectDependencyReadyAction<
  T extends {
    id: string;
    title: string;
    status: string;
    dependencies: unknown;
    dueOn: string | null;
    priority: string;
    position: number;
  },
>(actions: T[]) {
  const completedTitles = new Set(
    actions.filter((action) => action.status === "completed").map((action) => action.title),
  );
  const priorityRank = (priority: string) =>
    priority === "high" ? 0 : priority === "medium" ? 1 : 2;
  return (
    actions
      .filter(
        (action) =>
          action.status === "upcoming" &&
          Array.isArray(action.dependencies) &&
          action.dependencies.every(
            (dependency) => typeof dependency === "string" && completedTitles.has(dependency),
          ),
      )
      .sort(
        (a, b) =>
          (a.dueOn ?? "9999-12-31").localeCompare(b.dueOn ?? "9999-12-31") ||
          priorityRank(a.priority) - priorityRank(b.priority) ||
          a.position - b.position,
      )[0] ?? null
  );
}

async function deviceBelongsTo(db: PolarDatabase, userId: string, deviceId: string) {
  return (
    (
      await db
        .select({ id: registeredDevice.id })
        .from(registeredDevice)
        .where(and(eq(registeredDevice.userId, userId), eq(registeredDevice.deviceId, deviceId)))
        .limit(1)
    ).length > 0
  );
}

function header(request: FastifyRequest, key: string) {
  const value = request.headers[key];
  return Array.isArray(value) ? value[0] : value;
}

function personInitials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toLocaleUpperCase() ?? "")
    .join("");
}

function invalid(reply: FastifyReply, message: string) {
  return reply.status(400).send({ error: "INVALID_REQUEST", message });
}

function reasoningResultError(reply: FastifyReply, error: string, message: string) {
  return reply.status(400).send({ error, message });
}

export function hasValidDependencies(plan: import("@polar/contracts").MissionPlan) {
  const actions = plan.checkpoints.flatMap((checkpoint) => checkpoint.actions);
  const titles = actions.map((action) => action.title);
  if (new Set(titles).size !== titles.length) return false;
  const known = new Set(titles);
  const dependencies = new Map(actions.map((action) => [action.title, action.dependsOn]));
  if (
    actions.some((action) =>
      action.dependsOn.some((dependency) => !known.has(dependency) || dependency === action.title),
    )
  )
    return false;
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (title: string): boolean => {
    if (visiting.has(title)) return false;
    if (visited.has(title)) return true;
    visiting.add(title);
    for (const dependency of dependencies.get(title) ?? []) if (!visit(dependency)) return false;
    visiting.delete(title);
    visited.add(title);
    return true;
  };
  return titles.every(visit);
}

function boundConversation(messages: { role: string; content: string }[]) {
  let remaining = MAX_CONVERSATION_CHARS;
  const result: { role: string; content: string }[] = [];
  for (const message of messages.slice(-40).reverse()) {
    if (remaining <= 0) break;
    const content = message.content.slice(-remaining);
    result.push({ role: message.role, content });
    remaining -= content.length;
  }
  return result.reverse();
}
