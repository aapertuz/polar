import { createHash } from "node:crypto";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import {
  WorkspaceContextBriefUpdateSchema,
  WorkspaceContextSourceMutationSchema,
} from "@polar/contracts";
import { fromNodeHeaders } from "better-auth/node";
import type { PolarAuth } from "./auth.js";
import type { PolarDatabase } from "./db/client.js";
import { EXTRACTED_SOURCE_BODY_LIMIT } from "./request-limits.js";
import {
  domainEvent,
  missionDraft,
  missionProposal,
  outbox,
  polarUser,
  reasoningRequest,
  workspaceContext,
  workspaceContextSource,
  workspace,
  workspaceMembership,
} from "./db/schema.js";

const MAX_ACTIVE_SOURCES = 50;
const MAX_LIBRARY_CHARS = 20_000_000;

export function installWorkspaceContextRoutes(
  app: FastifyInstance,
  auth: PolarAuth,
  db: PolarDatabase,
) {
  app.get("/api/app/workspace-context", async (request, reply) => {
    const access = await getWorkspaceAccess(auth, db, request, reply);
    if (!access) return;
    await db
      .insert(workspaceContext)
      .values({ workspaceId: access.workspaceId })
      .onConflictDoNothing();
    const [context] = await db
      .select()
      .from(workspaceContext)
      .where(eq(workspaceContext.workspaceId, access.workspaceId))
      .limit(1);
    const sources = await db
      .select({
        id: workspaceContextSource.id,
        kind: workspaceContextSource.kind,
        title: workspaceContextSource.title,
        fileName: workspaceContextSource.fileName,
        contentHash: workspaceContextSource.contentHash,
        extractedText: workspaceContextSource.extractedText,
        revision: workspaceContextSource.revision,
        createdAt: workspaceContextSource.createdAt,
        updatedAt: workspaceContextSource.updatedAt,
      })
      .from(workspaceContextSource)
      .where(
        and(
          eq(workspaceContextSource.workspaceId, access.workspaceId),
          isNull(workspaceContextSource.archivedAt),
        ),
      )
      .orderBy(workspaceContextSource.updatedAt);
    return {
      workspaceId: access.workspaceId,
      workspaceName: access.workspaceName,
      role: access.role,
      brief: context?.brief ?? "",
      revision: context?.revision ?? 1,
      sources,
    };
  });

  app.put("/api/app/workspace-context/brief", async (request, reply) => {
    const access = await getWorkspaceAccess(auth, db, request, reply);
    if (!access) return;
    if (access.role !== "owner") return forbidden(reply);
    const body = WorkspaceContextBriefUpdateSchema.safeParse(request.body);
    if (!body.success) return invalid(reply, "Workspace brief must be 8,000 characters or fewer.");
    const now = new Date();
    const changed = await db.transaction(async (tx) => {
      await tx
        .insert(workspaceContext)
        .values({ workspaceId: access.workspaceId })
        .onConflictDoNothing();
      const updated = await tx
        .update(workspaceContext)
        .set({
          brief: body.data.brief,
          revision: sql`${workspaceContext.revision} + 1`,
          updatedAt: now,
        })
        .where(
          and(
            eq(workspaceContext.workspaceId, access.workspaceId),
            eq(workspaceContext.revision, body.data.expectedRevision),
          ),
        )
        .returning({ revision: workspaceContext.revision });
      if (!updated.length) {
        const [previous] = await tx
          .select({ brief: workspaceContext.brief, revision: workspaceContext.revision })
          .from(workspaceContext)
          .where(eq(workspaceContext.workspaceId, access.workspaceId))
          .limit(1);
        if (
          previous?.revision === body.data.expectedRevision + 1 &&
          previous.brief === body.data.brief
        )
          return { revision: previous.revision };
        return null;
      }
      await invalidateWorkspacePending(tx, access.workspaceId, now);
      await recordChange(
        tx,
        access,
        "workspace_context.brief_updated",
        { revision: updated[0]!.revision },
        now,
      );
      return updated[0]!;
    });
    if (!changed) return conflict(reply);
    return { brief: body.data.brief, revision: changed.revision };
  });

  app.post(
    "/api/app/workspace-context/sources",
    { bodyLimit: EXTRACTED_SOURCE_BODY_LIMIT },
    async (request, reply) => {
      const access = await getWorkspaceAccess(auth, db, request, reply);
      if (!access) return;
      if (access.role !== "owner") return forbidden(reply);
      const body = WorkspaceContextSourceMutationSchema.safeParse(request.body);
      if (!body.success || body.data.expectedRevision !== undefined)
        return invalid(reply, "Workspace source is invalid.");
      const source = body.data.source;
      if (
        source.kind === "document" &&
        (!source.fileName ||
          !source.contentHash ||
          sha(source.extractedText) !== source.contentHash)
      )
        return invalid(reply, "The document changed after it was read. Attach it again.");
      if (
        source.kind === "note" &&
        (source.extractedText.length > 100_000 ||
          source.fileName !== null ||
          (source.contentHash !== null && source.contentHash !== sha(source.extractedText)))
      )
        return invalid(reply, "Workspace notes must be 100,000 characters or fewer.");
      const [existingId] = await db
        .select()
        .from(workspaceContextSource)
        .where(
          and(
            eq(workspaceContextSource.workspaceId, access.workspaceId),
            eq(workspaceContextSource.id, source.id),
          ),
        )
        .limit(1);
      if (existingId) {
        if (
          existingId.archivedAt ||
          existingId.kind !== source.kind ||
          existingId.title !== source.title ||
          existingId.extractedText !== source.extractedText ||
          existingId.contentHash !== (source.contentHash ?? sha(source.extractedText))
        )
          return conflict(reply);
        const [context] = await db
          .select({ revision: workspaceContext.revision })
          .from(workspaceContext)
          .where(eq(workspaceContext.workspaceId, access.workspaceId))
          .limit(1);
        return { ...publicSource(existingId), workspaceRevision: context?.revision ?? 1 };
      }
      const [existingHash] = source.contentHash
        ? await db
            .select({ id: workspaceContextSource.id })
            .from(workspaceContextSource)
            .where(
              and(
                eq(workspaceContextSource.workspaceId, access.workspaceId),
                eq(workspaceContextSource.contentHash, source.contentHash),
                isNull(workspaceContextSource.archivedAt),
              ),
            )
            .limit(1)
        : [];
      if (existingHash)
        return reply.status(409).send({
          error: "SOURCE_EXISTS",
          message: "This document is already in workspace context.",
        });
      const active = await db
        .select({
          id: workspaceContextSource.id,
          extractedText: workspaceContextSource.extractedText,
        })
        .from(workspaceContextSource)
        .where(
          and(
            eq(workspaceContextSource.workspaceId, access.workspaceId),
            isNull(workspaceContextSource.archivedAt),
          ),
        );
      if (
        active.length >= MAX_ACTIVE_SOURCES ||
        active.reduce(
          (total, row) => total + row.extractedText.length,
          source.extractedText.length,
        ) > MAX_LIBRARY_CHARS
      )
        return reply.status(413).send({
          error: "WORKSPACE_CONTEXT_LIMIT",
          message: "The workspace context library has reached its storage limit.",
        });
      const now = new Date();
      const result = await db.transaction(async (tx) => {
        await tx
          .insert(workspaceContext)
          .values({ workspaceId: access.workspaceId })
          .onConflictDoNothing();
        const [context] = await tx
          .select({ revision: workspaceContext.revision })
          .from(workspaceContext)
          .where(eq(workspaceContext.workspaceId, access.workspaceId))
          .for("update")
          .limit(1);
        const activeLocked = await tx
          .select({ extractedText: workspaceContextSource.extractedText })
          .from(workspaceContextSource)
          .where(
            and(
              eq(workspaceContextSource.workspaceId, access.workspaceId),
              isNull(workspaceContextSource.archivedAt),
            ),
          );
        if (
          activeLocked.length >= MAX_ACTIVE_SOURCES ||
          activeLocked.reduce(
            (total, row) => total + row.extractedText.length,
            source.extractedText.length,
          ) > MAX_LIBRARY_CHARS
        )
          return { limit: true as const };
        const [inserted] = await tx
          .insert(workspaceContextSource)
          .values({
            ...source,
            contentHash: source.contentHash ?? sha(source.extractedText),
            workspaceId: access.workspaceId,
            createdBy: access.userId,
            updatedBy: access.userId,
            createdAt: now,
            updatedAt: now,
          })
          .returning();
        const [updated] = await tx
          .update(workspaceContext)
          .set({ revision: (context?.revision ?? 1) + 1, updatedAt: now })
          .where(eq(workspaceContext.workspaceId, access.workspaceId))
          .returning({ revision: workspaceContext.revision });
        await invalidateWorkspacePending(tx, access.workspaceId, now);
        await recordChange(
          tx,
          access,
          "workspace_context.source_added",
          { sourceId: source.id, sourceRevision: 1, revision: updated!.revision },
          now,
        );
        return { source: inserted, revision: updated!.revision, limit: false as const };
      });
      if (result.limit)
        return reply.status(413).send({
          error: "WORKSPACE_CONTEXT_LIMIT",
          message: "The workspace context library has reached its storage limit.",
        });
      return { ...publicSource(result.source), workspaceRevision: result.revision };
    },
  );

  app.put<{ Params: { sourceId: string } }>(
    "/api/app/workspace-context/sources/:sourceId",
    { bodyLimit: EXTRACTED_SOURCE_BODY_LIMIT },
    async (request, reply) => {
      const access = await getWorkspaceAccess(auth, db, request, reply);
      if (!access) return;
      if (access.role !== "owner") return forbidden(reply);
      const body = WorkspaceContextSourceMutationSchema.safeParse(request.body);
      if (!body.success || !body.data.expectedRevision)
        return invalid(reply, "Refresh the workspace source before replacing it.");
      const source = body.data.source;
      if (source.id !== request.params.sourceId)
        return invalid(reply, "Workspace source identity does not match.");
      if (
        source.kind === "document" &&
        (!source.fileName ||
          !source.contentHash ||
          sha(source.extractedText) !== source.contentHash)
      )
        return invalid(reply, "The document changed after it was read. Attach it again.");
      if (
        source.kind === "note" &&
        (source.extractedText.length > 100_000 ||
          source.fileName !== null ||
          (source.contentHash !== null && source.contentHash !== sha(source.extractedText)))
      )
        return invalid(reply, "Workspace notes must be 100,000 characters or fewer.");
      const now = new Date();
      const result = await db.transaction(async (tx) => {
        await tx
          .select({ revision: workspaceContext.revision })
          .from(workspaceContext)
          .where(eq(workspaceContext.workspaceId, access.workspaceId))
          .for("update")
          .limit(1);
        const updatedSource = await tx
          .update(workspaceContextSource)
          .set({
            ...source,
            contentHash: source.contentHash ?? sha(source.extractedText),
            revision: sql`${workspaceContextSource.revision} + 1`,
            updatedBy: access.userId,
            updatedAt: now,
          })
          .where(
            and(
              eq(workspaceContextSource.id, source.id),
              eq(workspaceContextSource.workspaceId, access.workspaceId),
              eq(workspaceContextSource.revision, body.data.expectedRevision!),
              isNull(workspaceContextSource.archivedAt),
            ),
          )
          .returning();
        if (!updatedSource.length) {
          const [previous] = await tx
            .select()
            .from(workspaceContextSource)
            .where(
              and(
                eq(workspaceContextSource.id, source.id),
                eq(workspaceContextSource.workspaceId, access.workspaceId),
              ),
            )
            .limit(1);
          if (
            previous &&
            !previous.archivedAt &&
            previous.revision === body.data.expectedRevision! + 1 &&
            previous.kind === source.kind &&
            previous.title === source.title &&
            previous.fileName === source.fileName &&
            previous.contentHash === (source.contentHash ?? sha(source.extractedText)) &&
            previous.extractedText === source.extractedText
          ) {
            const [context] = await tx
              .select({ revision: workspaceContext.revision })
              .from(workspaceContext)
              .where(eq(workspaceContext.workspaceId, access.workspaceId))
              .limit(1);
            return { source: previous, revision: context?.revision ?? 1 };
          }
          return null;
        }
        const [updatedContext] = await tx
          .update(workspaceContext)
          .set({ revision: sql`${workspaceContext.revision} + 1`, updatedAt: now })
          .where(eq(workspaceContext.workspaceId, access.workspaceId))
          .returning({ revision: workspaceContext.revision });
        await invalidateWorkspacePending(tx, access.workspaceId, now);
        await recordChange(
          tx,
          access,
          "workspace_context.source_replaced",
          {
            sourceId: source.id,
            sourceRevision: updatedSource[0]!.revision,
            revision: updatedContext!.revision,
          },
          now,
        );
        return { source: updatedSource[0]!, revision: updatedContext!.revision };
      });
      if (!result) return conflict(reply);
      return { ...publicSource(result.source), workspaceRevision: result.revision };
    },
  );

  app.delete<{ Params: { sourceId: string } }>(
    "/api/app/workspace-context/sources/:sourceId",
    async (request, reply) => {
      const access = await getWorkspaceAccess(auth, db, request, reply);
      if (!access) return;
      if (access.role !== "owner") return forbidden(reply);
      const expectedRevision = Number(request.headers["if-match"]);
      if (!Number.isInteger(expectedRevision) || expectedRevision < 1)
        return invalid(reply, "Refresh the workspace source before removing it.");
      const now = new Date();
      const result = await db.transaction(async (tx) => {
        await tx
          .select({ revision: workspaceContext.revision })
          .from(workspaceContext)
          .where(eq(workspaceContext.workspaceId, access.workspaceId))
          .for("update")
          .limit(1);
        const archived = await tx
          .update(workspaceContextSource)
          .set({
            archivedAt: now,
            updatedBy: access.userId,
            updatedAt: now,
            revision: sql`${workspaceContextSource.revision} + 1`,
          })
          .where(
            and(
              eq(workspaceContextSource.id, request.params.sourceId),
              eq(workspaceContextSource.workspaceId, access.workspaceId),
              eq(workspaceContextSource.revision, expectedRevision),
              isNull(workspaceContextSource.archivedAt),
            ),
          )
          .returning({ id: workspaceContextSource.id, revision: workspaceContextSource.revision });
        if (!archived.length) {
          const [previous] = await tx
            .select({ id: workspaceContextSource.id, revision: workspaceContextSource.revision })
            .from(workspaceContextSource)
            .where(
              and(
                eq(workspaceContextSource.id, request.params.sourceId),
                eq(workspaceContextSource.workspaceId, access.workspaceId),
              ),
            )
            .limit(1);
          if (previous?.revision === expectedRevision + 1) {
            const [context] = await tx
              .select({ revision: workspaceContext.revision })
              .from(workspaceContext)
              .where(eq(workspaceContext.workspaceId, access.workspaceId))
              .limit(1);
            return context ?? null;
          }
          return null;
        }
        const [context] = await tx
          .update(workspaceContext)
          .set({ revision: sql`${workspaceContext.revision} + 1`, updatedAt: now })
          .where(eq(workspaceContext.workspaceId, access.workspaceId))
          .returning({ revision: workspaceContext.revision });
        await invalidateWorkspacePending(tx, access.workspaceId, now);
        await recordChange(
          tx,
          access,
          "workspace_context.source_archived",
          {
            sourceId: archived[0]!.id,
            sourceRevision: archived[0]!.revision,
            revision: context!.revision,
          },
          now,
        );
        return context;
      });
      if (!result) return conflict(reply);
      return { removed: true, workspaceRevision: result.revision };
    },
  );
}

async function getWorkspaceAccess(
  auth: PolarAuth,
  db: PolarDatabase,
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const session = await auth.api.getSession({ headers: fromNodeHeaders(request.headers) });
  if (!session) {
    reply
      .status(401)
      .send({ error: "UNAUTHENTICATED", message: "Sign in to Polar and try again." });
    return null;
  }
  const workspaceId = request.headers["x-polar-workspace-id"];
  const [user] = await db
    .select({ id: polarUser.id })
    .from(polarUser)
    .where(eq(polarUser.authUserId, session.user.id))
    .limit(1);
  if (!user || typeof workspaceId !== "string") return forbidden(reply);
  const [membership] = await db
    .select({
      userId: workspaceMembership.userId,
      workspaceId: workspaceMembership.workspaceId,
      role: workspaceMembership.role,
      workspaceName: workspace.name,
      privacy: workspace.privacy,
      ownerUserId: workspace.ownerUserId,
    })
    .from(workspaceMembership)
    .innerJoin(workspace, eq(workspace.id, workspaceMembership.workspaceId))
    .where(
      and(
        eq(workspaceMembership.userId, user.id),
        eq(workspaceMembership.workspaceId, workspaceId),
      ),
    )
    .limit(1);
  if (
    !membership ||
    (membership.privacy === "private" &&
      (membership.role !== "owner" || membership.ownerUserId !== user.id))
  )
    return forbidden(reply);
  return membership;
}

async function recordChange(
  tx: Parameters<Parameters<PolarDatabase["transaction"]>[0]>[0],
  access: { userId: string; workspaceId: string },
  eventType: string,
  payload: Record<string, unknown>,
  now: Date,
) {
  const id = crypto.randomUUID();
  await tx.insert(domainEvent).values({
    id,
    workspaceId: access.workspaceId,
    userId: access.userId,
    eventType,
    payload,
    createdAt: now,
  });
  await tx.insert(outbox).values({
    id,
    eventName: "polar/workspace-context.changed",
    payload: { workspaceId: access.workspaceId, eventId: id },
    createdAt: now,
  });
}

async function invalidateWorkspacePending(
  tx: Parameters<Parameters<PolarDatabase["transaction"]>[0]>[0],
  workspaceId: string,
  now: Date,
) {
  await tx
    .update(reasoningRequest)
    .set({ status: "cancelled", leaseToken: null, leaseExpiresAt: null, updatedAt: now })
    .where(
      and(
        eq(reasoningRequest.workspaceId, workspaceId),
        inArray(reasoningRequest.status, ["queued", "claimed"]),
      ),
    );
  const drafts = await tx
    .select({ id: missionDraft.id })
    .from(missionDraft)
    .where(and(eq(missionDraft.workspaceId, workspaceId), eq(missionDraft.status, "draft")));
  if (drafts.length)
    await tx
      .update(missionProposal)
      .set({ status: "superseded" })
      .where(
        and(
          inArray(
            missionProposal.draftId,
            drafts.map((draft) => draft.id),
          ),
          eq(missionProposal.status, "current"),
        ),
      );
}

function publicSource(source: typeof workspaceContextSource.$inferSelect) {
  return {
    id: source.id,
    kind: source.kind,
    title: source.title,
    fileName: source.fileName,
    contentHash: source.contentHash,
    extractedText: source.extractedText,
    revision: source.revision,
    createdAt: source.createdAt,
    updatedAt: source.updatedAt,
  };
}
function sha(text: string) {
  return createHash("sha256").update(text).digest("hex");
}
function invalid(reply: FastifyReply, message: string) {
  return reply.status(400).send({ error: "INVALID_REQUEST", message });
}
function forbidden(reply: FastifyReply) {
  return reply.status(403).send({
    error: "WORKSPACE_ACCESS_REQUIRED",
    message: "You are not authorized to manage this workspace context.",
  });
}
function conflict(reply: FastifyReply) {
  return reply.status(409).send({
    error: "WORKSPACE_CONTEXT_CHANGED",
    message: "Workspace context changed. Refresh it and review your edit.",
  });
}
