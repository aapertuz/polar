import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import test from "node:test";
import { and, eq } from "drizzle-orm";
import { createApp } from "../../src/app.js";
import { createAuth } from "../../src/auth.js";
import { getServerConfig } from "../../src/config.js";
import { createDatabase } from "../../src/db/client.js";
import {
  authUser,
  missionDraft,
  outbox,
  reasoningRequest,
  workspace,
  workspaceMembership,
  workspacePreference,
} from "../../src/db/schema.js";

test("development workspaces enforce privacy, defaults, lifecycle, and empty accounts", async () => {
  const config = getServerConfig(process.env);
  assert.equal(config.environment, "development");
  assert.equal(process.env.NODE_ENV, "test");
  const { db, pool } = createDatabase(config.databaseUrl);
  const app = createApp({ db, auth: createAuth(db, config), config });
  const emails: string[] = [];
  const origin = { origin: config.betterAuthUrl };

  async function account(name: string) {
    const email = `polar-workspace-${randomUUID()}@example.test`;
    emails.push(email);
    const signup = await app.inject({
      method: "POST",
      url: "/api/auth/sign-up/email",
      headers: origin,
      payload: { email, password: randomBytes(24).toString("hex"), name },
    });
    assert.equal(signup.statusCode, 200, signup.body);
    const headers = { authorization: `Bearer ${signup.json().token as string}` };
    const response = await app.inject({ method: "GET", url: "/api/app/bootstrap", headers });
    assert.equal(response.statusCode, 200, response.body);
    return { id: response.json().user.id as string, headers, bootstrap: response.json() };
  }

  try {
    const owner = await account("Workspace owner");
    const member = await account("Workspace member");
    const outsider = await account("Workspace outsider");
    assert.deepEqual(owner.bootstrap.workspaces, []);
    assert.deepEqual(member.bootstrap.workspaces, []);
    assert.deepEqual(outsider.bootstrap.workspaces, []);
    const initialCreated = await app.inject({
      method: "POST",
      url: "/api/app/workspaces",
      headers: owner.headers,
      payload: { name: "My workspace", privacy: "private" },
    });
    assert.equal(initialCreated.statusCode, 200, initialCreated.body);
    const initialWorkspace = initialCreated.json().workspace;
    assert.equal(initialWorkspace.name, "My workspace");
    assert.equal(initialWorkspace.privacy, "private");
    assert.equal(owner.bootstrap.defaultWorkspaceId, null);
    const restored = await app.inject({
      method: "GET",
      url: "/api/app/bootstrap",
      headers: owner.headers,
    });
    assert.deepEqual(restored.json().workspaces, [initialWorkspace]);
    const outsiderPrivateContext = await app.inject({
      method: "GET",
      url: "/api/app/workspace-context",
      headers: { ...outsider.headers, "x-polar-workspace-id": initialWorkspace.id },
    });
    assert.equal(outsiderPrivateContext.statusCode, 403);

    const invalid = await app.inject({
      method: "POST",
      url: "/api/app/workspaces",
      headers: owner.headers,
      payload: { name: "   ", privacy: "private" },
    });
    assert.equal(invalid.statusCode, 400);
    const created = await app.inject({
      method: "POST",
      url: "/api/app/workspaces",
      headers: owner.headers,
      payload: { name: "  Launch room  ", privacy: "private" },
    });
    assert.equal(created.statusCode, 200, created.body);
    const shared = created.json().workspace;
    assert.equal(shared.name, "Launch room");
    assert.equal(shared.privacy, "private");
    assert.equal(shared.role, "owner");

    const sharedMode = await app.inject({
      method: "PATCH",
      url: `/api/app/workspaces/${shared.id}`,
      headers: owner.headers,
      payload: { privacy: "shared" },
    });
    assert.equal(sharedMode.statusCode, 200, sharedMode.body);
    assert.equal(sharedMode.json().workspace.privacy, "shared");
    const noAutomaticAccess = await app.inject({
      method: "GET",
      url: "/api/app/workspaces",
      headers: member.headers,
    });
    assert.equal(noAutomaticAccess.statusCode, 200);
    assert.ok(
      !noAutomaticAccess.json().workspaces.some((item: { id: string }) => item.id === shared.id),
    );
    const deniedUntilMember = await app.inject({
      method: "GET",
      url: "/api/app/workspace-context",
      headers: { ...outsider.headers, "x-polar-workspace-id": shared.id },
    });
    assert.equal(deniedUntilMember.statusCode, 403);

    await db.insert(workspaceMembership).values({
      workspaceId: shared.id,
      userId: member.id,
      role: "member",
    });
    const memberWorkspaces = await app.inject({
      method: "GET",
      url: "/api/app/workspaces",
      headers: member.headers,
    });
    assert.ok(
      memberWorkspaces.json().workspaces.some((item: { id: string }) => item.id === shared.id),
    );
    const memberContext = await app.inject({
      method: "GET",
      url: "/api/app/workspace-context",
      headers: { ...member.headers, "x-polar-workspace-id": shared.id },
    });
    assert.equal(memberContext.statusCode, 200, memberContext.body);
    assert.equal(memberContext.json().brief, "");
    const brief = await app.inject({
      method: "PUT",
      url: "/api/app/workspace-context/brief",
      headers: { ...owner.headers, "x-polar-workspace-id": shared.id },
      payload: { brief: "A synthetic shared workspace brief", expectedRevision: 1 },
    });
    assert.equal(brief.statusCode, 200, brief.body);
    const sourceText = "Team source text that members can inspect";
    const source = await app.inject({
      method: "POST",
      url: "/api/app/workspace-context/sources",
      headers: { ...owner.headers, "x-polar-workspace-id": shared.id },
      payload: {
        source: {
          id: randomUUID(),
          kind: "note",
          title: "Team note",
          fileName: null,
          contentHash: null,
          extractedText: sourceText,
        },
      },
    });
    assert.equal(source.statusCode, 200, source.body);
    const memberUpdatedContext = await app.inject({
      method: "GET",
      url: "/api/app/workspace-context",
      headers: { ...member.headers, "x-polar-workspace-id": shared.id },
    });
    assert.equal(memberUpdatedContext.json().brief, "A synthetic shared workspace brief");
    assert.equal(memberUpdatedContext.json().sources[0].extractedText, sourceText);

    const memberCannotRename = await app.inject({
      method: "PATCH",
      url: `/api/app/workspaces/${shared.id}`,
      headers: member.headers,
      payload: { name: "Member edit" },
    });
    assert.equal(memberCannotRename.statusCode, 403);
    const privateWithMember = await app.inject({
      method: "PATCH",
      url: `/api/app/workspaces/${shared.id}`,
      headers: owner.headers,
      payload: { privacy: "private" },
    });
    assert.equal(privateWithMember.statusCode, 409);
    await assert.rejects(
      db.insert(workspaceMembership).values({
        workspaceId: initialWorkspace.id,
        userId: outsider.id,
        role: "member",
      }),
    );

    const selectedDefault = await app.inject({
      method: "PUT",
      url: "/api/app/workspace-preferences/default",
      headers: member.headers,
      payload: { defaultWorkspaceId: shared.id },
    });
    assert.equal(selectedDefault.statusCode, 200, selectedDefault.body);
    assert.equal(selectedDefault.json().defaultWorkspaceId, shared.id);
    const ownerDefault = await app.inject({
      method: "PUT",
      url: "/api/app/workspace-preferences/default",
      headers: owner.headers,
      payload: { defaultWorkspaceId: initialWorkspace.id },
    });
    assert.equal(ownerDefault.statusCode, 200, ownerDefault.body);
    assert.equal(ownerDefault.json().defaultWorkspaceId, initialWorkspace.id);
    const memberAccount = await app.inject({
      method: "GET",
      url: "/api/app/bootstrap",
      headers: member.headers,
    });
    assert.equal(memberAccount.json().defaultWorkspaceId, shared.id);
    const ownerAccount = await app.inject({
      method: "GET",
      url: "/api/app/bootstrap",
      headers: owner.headers,
    });
    assert.equal(ownerAccount.json().defaultWorkspaceId, initialWorkspace.id);
    const ownDefault = await app.inject({
      method: "PUT",
      url: "/api/app/workspace-preferences/default",
      headers: owner.headers,
      payload: { defaultWorkspaceId: shared.id },
    });
    assert.equal(ownDefault.statusCode, 200, ownDefault.body);
    assert.equal(ownDefault.json().defaultWorkspaceId, shared.id);
    const inaccessibleDefault = await app.inject({
      method: "PUT",
      url: "/api/app/workspace-preferences/default",
      headers: outsider.headers,
      payload: { defaultWorkspaceId: shared.id },
    });
    assert.equal(inaccessibleDefault.statusCode, 404);

    const draft = await app.inject({
      method: "POST",
      url: "/api/app/mission-drafts",
      headers: { ...owner.headers, "x-polar-workspace-id": shared.id },
      payload: { goal: "A synthetic workspace draft" },
    });
    assert.equal(draft.statusCode, 200, draft.body);
    const requestId = randomUUID();
    await db.insert(reasoningRequest).values({
      id: requestId,
      draftId: draft.json().id as string,
      userId: owner.id,
      workspaceId: shared.id,
      payload: { workspaceId: shared.id },
      status: "queued",
    });
    await db.insert(outbox).values({
      id: requestId,
      eventName: "polar/reasoning.requested",
      payload: { requestId },
    });
    const [pendingOutbox] = await db
      .insert(outbox)
      .values({
        id: randomUUID(),
        eventName: "test/workspace",
        payload: { workspaceId: shared.id },
      })
      .returning({ id: outbox.id });

    const wrongConfirmation = await app.inject({
      method: "DELETE",
      url: `/api/app/workspaces/${shared.id}`,
      headers: owner.headers,
      payload: { confirmationName: "Wrong name" },
    });
    assert.equal(wrongConfirmation.statusCode, 409);
    const renamed = await app.inject({
      method: "PATCH",
      url: `/api/app/workspaces/${shared.id}`,
      headers: owner.headers,
      payload: { name: "  Launch team  " },
    });
    assert.equal(renamed.statusCode, 200);
    assert.equal(renamed.json().workspace.name, "Launch team");
    const deleted = await app.inject({
      method: "DELETE",
      url: `/api/app/workspaces/${shared.id}`,
      headers: owner.headers,
      payload: { confirmationName: "Launch team" },
    });
    assert.equal(deleted.statusCode, 200, deleted.body);
    assert.equal(deleted.json().deleted, true);
    assert.equal(
      (await db.select().from(missionDraft).where(eq(missionDraft.id, draft.json().id))).length,
      0,
    );
    assert.equal(
      (await db.select().from(outbox).where(eq(outbox.id, pendingOutbox!.id))).length,
      0,
    );
    assert.equal((await db.select().from(outbox).where(eq(outbox.id, requestId))).length, 0);
    assert.equal(
      (await db.select().from(reasoningRequest).where(eq(reasoningRequest.id, requestId))).length,
      0,
    );
    const lateResult = await app.inject({
      method: "POST",
      url: `/api/app/reasoning/${requestId}/result`,
      headers: { ...owner.headers, "x-polar-workspace-id": shared.id },
      payload: {},
    });
    assert.equal(lateResult.statusCode, 403);
    const [memberPreference] = await db
      .select({ defaultWorkspaceId: workspacePreference.defaultWorkspaceId })
      .from(workspacePreference)
      .where(eq(workspacePreference.userId, member.id));
    assert.equal(memberPreference?.defaultWorkspaceId, null);

    const empty = await app.inject({
      method: "DELETE",
      url: `/api/app/workspaces/${initialWorkspace.id}`,
      headers: owner.headers,
      payload: { confirmationName: "My workspace" },
    });
    assert.equal(empty.statusCode, 200, empty.body);
    const ownerPreferenceAfterDelete = await app.inject({
      method: "GET",
      url: "/api/app/bootstrap",
      headers: owner.headers,
    });
    assert.equal(ownerPreferenceAfterDelete.json().defaultWorkspaceId, null);
    const emptyBootstrap = await app.inject({
      method: "GET",
      url: "/api/app/bootstrap",
      headers: owner.headers,
    });
    assert.equal(emptyBootstrap.statusCode, 200, emptyBootstrap.body);
    assert.deepEqual(emptyBootstrap.json().workspaces, []);
    assert.equal(emptyBootstrap.json().defaultWorkspaceId, null);
    const afterEmpty = await app.inject({
      method: "GET",
      url: "/api/app/workspaces",
      headers: owner.headers,
    });
    assert.deepEqual(afterEmpty.json().workspaces, []);

    // A concurrent membership add and privacy change must preserve the same invariant.
    const race = await app.inject({
      method: "POST",
      url: "/api/app/workspaces",
      headers: owner.headers,
      payload: { name: "Race room", privacy: "shared" },
    });
    const raceId = race.json().workspace.id as string;
    const raceResults = await Promise.allSettled([
      app.inject({
        method: "PATCH",
        url: `/api/app/workspaces/${raceId}`,
        headers: owner.headers,
        payload: { privacy: "private" },
      }),
      db.insert(workspaceMembership).values({
        workspaceId: raceId,
        userId: member.id,
        role: "member",
      }),
    ]);
    const [raceRow] = await db.select().from(workspace).where(eq(workspace.id, raceId));
    const [raceMember] = await db
      .select()
      .from(workspaceMembership)
      .where(
        and(eq(workspaceMembership.workspaceId, raceId), eq(workspaceMembership.userId, member.id)),
      );
    assert.ok(
      (raceRow?.privacy === "shared" && raceMember) ||
        (raceRow?.privacy === "private" && !raceMember),
      JSON.stringify({ raceResults, privacy: raceRow?.privacy, member: Boolean(raceMember) }),
    );
  } finally {
    await Promise.all(emails.map((email) => db.delete(authUser).where(eq(authUser.email, email))));
    await app.close();
    await pool.end();
  }
});
