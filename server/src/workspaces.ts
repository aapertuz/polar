import { fromNodeHeaders } from "better-auth/node";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import {
  WorkspaceCreateSchema,
  WorkspaceDefaultSchema,
  WorkspaceDeleteSchema,
  WorkspaceListResponseSchema,
  WorkspaceSummarySchema,
  WorkspaceUpdateSchema,
} from "@polar/contracts";
import { and, asc, eq, sql } from "drizzle-orm";
import type { PolarAuth } from "./auth.js";
import type { PolarDatabase } from "./db/client.js";
import {
  mission,
  missionDraft,
  outbox,
  polarUser,
  workspace,
  workspaceMembership,
  workspacePreference,
} from "./db/schema.js";
import { bootstrapAccount } from "./domain/bootstrap.js";

export function installWorkspaceRoutes(app: FastifyInstance, auth: PolarAuth, db: PolarDatabase) {
  app.get("/api/app/workspaces", async (request, reply) => {
    const account = await getAccount(auth, db, request, reply);
    if (!account) return;
    const result = await listWorkspaces(db, account.id);
    return WorkspaceListResponseSchema.parse(result);
  });

  app.post("/api/app/workspaces", async (request, reply) => {
    const account = await getAccount(auth, db, request, reply);
    if (!account) return;
    const body = WorkspaceCreateSchema.safeParse(request.body);
    if (!body.success) return invalid(reply, "Workspace name or privacy is invalid.");
    const created = await db.transaction(async (tx) => {
      const id = crypto.randomUUID();
      const [row] = await tx
        .insert(workspace)
        .values({
          id,
          name: body.data.name,
          privacy: body.data.privacy,
          ownerUserId: account.id,
        })
        .returning({
          id: workspace.id,
          name: workspace.name,
          privacy: workspace.privacy,
          createdAt: workspace.createdAt,
        });
      await tx
        .insert(workspaceMembership)
        .values({ workspaceId: id, userId: account.id, role: "owner" });
      return { ...row!, role: "owner" as const };
    });
    return {
      workspace: WorkspaceSummarySchema.parse({
        ...created,
        createdAt: created.createdAt.toISOString(),
      }),
    };
  });

  app.patch("/api/app/workspaces/:workspaceId", async (request, reply) => {
    const account = await getAccount(auth, db, request, reply);
    if (!account) return;
    const workspaceId = parseWorkspaceId(request, reply);
    if (!workspaceId) return;
    const body = WorkspaceUpdateSchema.safeParse(request.body);
    if (!body.success) return invalid(reply, "Workspace changes are invalid.");
    try {
      const updated = await db.transaction(async (tx) => {
        const [current] = await tx
          .select()
          .from(workspace)
          .where(eq(workspace.id, workspaceId))
          .for("update");
        if (!current) return { kind: "missing" as const };
        const [membership] = await tx
          .select({ role: workspaceMembership.role })
          .from(workspaceMembership)
          .where(
            and(
              eq(workspaceMembership.workspaceId, workspaceId),
              eq(workspaceMembership.userId, account.id),
            ),
          )
          .for("update");
        if (!membership) return { kind: "missing" as const };
        if (membership.role !== "owner") return { kind: "forbidden" as const };
        if (body.data.privacy === "private" && current.privacy !== "private") {
          const [member] = await tx
            .select({ userId: workspaceMembership.userId })
            .from(workspaceMembership)
            .where(
              and(
                eq(workspaceMembership.workspaceId, workspaceId),
                eq(workspaceMembership.role, "member"),
              ),
            )
            .limit(1);
          if (member) return { kind: "members" as const };
        }
        const [row] = await tx
          .update(workspace)
          .set({
            ...(body.data.name === undefined ? {} : { name: body.data.name }),
            ...(body.data.privacy === undefined ? {} : { privacy: body.data.privacy }),
          })
          .where(eq(workspace.id, workspaceId))
          .returning({
            id: workspace.id,
            name: workspace.name,
            privacy: workspace.privacy,
            createdAt: workspace.createdAt,
          });
        return { kind: "updated" as const, row: { ...row!, role: "owner" as const } };
      });
      if (updated.kind === "missing") return notFound(reply);
      if (updated.kind === "forbidden") return forbidden(reply);
      if (updated.kind === "members") return hasMembers(reply);
      return {
        workspace: WorkspaceSummarySchema.parse({
          ...updated.row,
          createdAt: updated.row.createdAt.toISOString(),
        }),
      };
    } catch (error) {
      if (postgresCode(error) === "P0001") return hasMembers(reply);
      request.log.error({ err: error }, "Workspace update failed");
      return unavailable(reply);
    }
  });

  app.delete("/api/app/workspaces/:workspaceId", async (request, reply) => {
    const account = await getAccount(auth, db, request, reply);
    if (!account) return;
    const workspaceId = parseWorkspaceId(request, reply);
    if (!workspaceId) return;
    const body = WorkspaceDeleteSchema.safeParse(request.body);
    if (!body.success) return invalid(reply, "Type the workspace name to confirm deletion.");
    const result = await db.transaction(async (tx) => {
      const [current] = await tx
        .select()
        .from(workspace)
        .where(eq(workspace.id, workspaceId))
        .for("update");
      if (!current) return "missing" as const;
      const [membership] = await tx
        .select({ role: workspaceMembership.role })
        .from(workspaceMembership)
        .where(
          and(
            eq(workspaceMembership.workspaceId, workspaceId),
            eq(workspaceMembership.userId, account.id),
          ),
        )
        .for("update");
      if (!membership) return "missing" as const;
      if (membership.role !== "owner") return "forbidden" as const;
      if (body.data.confirmationName !== current.name) return "name-mismatch" as const;

      await tx.delete(outbox).where(sql`
        ${outbox.payload}->>'workspaceId' = ${workspaceId}
        OR ${outbox.id} IN (
          SELECT request.id
          FROM reasoning_request AS request
          WHERE request.workspace_id = ${workspaceId}
        )
        OR ${outbox.id} IN (
          SELECT event.id
          FROM domain_event AS event
          WHERE event.workspace_id = ${workspaceId}
        )
        OR ${outbox.payload}->>'missionId' IN (
          SELECT mission.id
          FROM mission
          WHERE mission.workspace_id = ${workspaceId}
        )
      `);
      await tx.delete(mission).where(eq(mission.workspaceId, workspaceId));
      await tx.delete(missionDraft).where(eq(missionDraft.workspaceId, workspaceId));
      await tx.delete(workspace).where(eq(workspace.id, workspaceId));
      return "deleted" as const;
    });
    if (result === "missing") return notFound(reply);
    if (result === "forbidden") return forbidden(reply);
    if (result === "name-mismatch")
      return reply
        .status(409)
        .send({ error: "CONFIRMATION_MISMATCH", message: "The workspace name did not match." });
    return { deleted: true };
  });

  app.put("/api/app/workspace-preferences/default", async (request, reply) => {
    const account = await getAccount(auth, db, request, reply);
    if (!account) return;
    const body = WorkspaceDefaultSchema.safeParse(request.body);
    if (!body.success)
      return invalid(reply, "Choose an accessible workspace or clear the default.");
    if (body.data.defaultWorkspaceId) {
      const [membership] = await db
        .select({ workspaceId: workspaceMembership.workspaceId })
        .from(workspaceMembership)
        .where(
          and(
            eq(workspaceMembership.workspaceId, body.data.defaultWorkspaceId),
            eq(workspaceMembership.userId, account.id),
          ),
        )
        .limit(1);
      if (!membership) return notFound(reply);
    }
    const [preference] = await db
      .insert(workspacePreference)
      .values({
        userId: account.id,
        defaultWorkspaceId: body.data.defaultWorkspaceId,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: workspacePreference.userId,
        set: { defaultWorkspaceId: body.data.defaultWorkspaceId, updatedAt: new Date() },
      })
      .returning({ defaultWorkspaceId: workspacePreference.defaultWorkspaceId });
    return { defaultWorkspaceId: preference?.defaultWorkspaceId ?? null };
  });
}

async function getAccount(
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
  const [polar] = await db
    .select({ id: polarUser.id })
    .from(polarUser)
    .where(eq(polarUser.authUserId, session.user.id))
    .limit(1);
  if (polar) return polar;
  const account = await bootstrapAccount(db, {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
  });
  return { id: account.user.id };
}

async function listWorkspaces(db: PolarDatabase, userId: string) {
  const workspaces = await db
    .select({
      id: workspace.id,
      name: workspace.name,
      privacy: workspace.privacy,
      role: workspaceMembership.role,
      createdAt: workspace.createdAt,
    })
    .from(workspaceMembership)
    .innerJoin(workspace, eq(workspace.id, workspaceMembership.workspaceId))
    .where(eq(workspaceMembership.userId, userId))
    .orderBy(asc(workspace.createdAt), asc(workspace.id));
  const [preference] = await db
    .select({ defaultWorkspaceId: workspacePreference.defaultWorkspaceId })
    .from(workspacePreference)
    .where(eq(workspacePreference.userId, userId))
    .limit(1);
  return {
    workspaces: workspaces.map((item) => ({ ...item, createdAt: item.createdAt.toISOString() })),
    defaultWorkspaceId: workspaces.some((item) => item.id === preference?.defaultWorkspaceId)
      ? preference!.defaultWorkspaceId
      : null,
  };
}

function parseWorkspaceId(request: FastifyRequest, reply: FastifyReply) {
  const { workspaceId } = request.params as { workspaceId?: string };
  if (
    workspaceId &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(workspaceId)
  )
    return workspaceId;
  invalid(reply, "Workspace ID is invalid.");
  return null;
}

function postgresCode(error: unknown): string | undefined {
  if (!error || typeof error !== "object") return;
  const value = error as { code?: unknown; cause?: { code?: unknown } };
  return typeof value.code === "string"
    ? value.code
    : typeof value.cause?.code === "string"
      ? value.cause.code
      : undefined;
}

function invalid(reply: FastifyReply, message: string) {
  return reply.status(400).send({ error: "INVALID_WORKSPACE", message });
}

function forbidden(reply: FastifyReply) {
  return reply.status(403).send({
    error: "WORKSPACE_OWNER_REQUIRED",
    message: "Only the workspace owner can change these settings.",
  });
}

function notFound(reply: FastifyReply) {
  return reply.status(404).send({
    error: "WORKSPACE_NOT_FOUND",
    message: "That workspace is not available to this account.",
  });
}

function hasMembers(reply: FastifyReply) {
  return reply.status(409).send({
    error: "WORKSPACE_HAS_MEMBERS",
    message: "Remove other members before making this workspace private.",
  });
}

function unavailable(reply: FastifyReply) {
  return reply.status(503).send({
    error: "WORKSPACE_UPDATE_FAILED",
    message: "Polar could not update this workspace. Retry shortly.",
  });
}
