import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import test from "node:test";
import { and, eq } from "drizzle-orm";
import { createApp } from "../../src/app.js";
import { createAuth } from "../../src/auth.js";
import { getServerConfig } from "../../src/config.js";
import { createDatabase } from "../../src/db/client.js";
import {
  authDeviceCode,
  authSession,
  authUser,
  registeredDevice,
  workspaceMembership,
} from "../../src/db/schema.js";

test("development Neon supports real sign-in, device approval, bootstrap, and revocation", async () => {
  // This must run before constructing a pool or issuing an auth request.
  const config = getServerConfig(process.env);
  assert.equal(config.environment, "development");
  assert.equal(process.env.NODE_ENV, "test");
  const { db, pool } = createDatabase(config.databaseUrl);
  const auth = createAuth(db, config);
  const app = createApp({ db, auth, config });
  const email = `polar-test-${randomUUID()}@example.test`;
  const headers = { origin: config.betterAuthUrl };
  try {
    const signup = await app.inject({
      method: "POST",
      url: "/api/auth/sign-up/email",
      headers,
      payload: {
        email,
        password: randomBytes(24).toString("hex"),
        name: "Development verification",
      },
    });
    assert.equal(signup.statusCode, 200, "Development signup should succeed");
    const cookies = signup.cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join("; ");
    assert.ok(signup.cookies.some((cookie) => cookie.name.startsWith("polar-development.")));
    assert.ok(!signup.cookies.some((cookie) => cookie.name.includes("polar-production")));
    const browserHeaders = { ...headers, cookie: cookies };
    const code = await app.inject({
      method: "POST",
      url: "/api/auth/device/code",
      payload: { client_id: config.desktopClientId },
    });
    assert.equal(code.statusCode, 200);
    const device = code.json();
    const verify = await app.inject({
      method: "GET",
      url: `/api/auth/device?user_code=${encodeURIComponent(device.user_code)}`,
      headers: browserHeaders,
    });
    assert.equal(verify.statusCode, 200);
    const approved = await app.inject({
      method: "POST",
      url: "/api/auth/device/approve",
      headers: browserHeaders,
      payload: { userCode: device.user_code },
    });
    assert.equal(approved.statusCode, 200);
    const token = await app.inject({
      method: "POST",
      url: "/api/auth/device/token",
      payload: {
        client_id: config.desktopClientId,
        device_code: device.device_code,
        grant_type: "urn:ietf:params:oauth:grant-type:device_code",
      },
    });
    assert.equal(token.statusCode, 200);
    const authorization = `Bearer ${token.json().access_token}`;
    const first = await app.inject({
      method: "GET",
      url: "/api/app/bootstrap",
      headers: { authorization },
    });
    assert.equal(first.statusCode, 200);
    assert.deepEqual(first.json().workspaces, [], "An account must exist before workspace setup");
    assert.equal(first.json().defaultWorkspaceId, null);
    const repeated = await app.inject({
      method: "GET",
      url: "/api/app/bootstrap",
      headers: { authorization },
    });
    assert.equal(repeated.statusCode, 200);
    assert.deepEqual(first.json(), repeated.json());
    const registered = await app.inject({
      method: "POST",
      url: "/api/app/devices",
      headers: { authorization },
      payload: { deviceId: randomUUID(), label: "Development test device" },
    });
    assert.equal(registered.statusCode, 200);
    const signout = await app.inject({
      method: "POST",
      url: "/api/auth/sign-out",
      headers: { ...headers, authorization },
      payload: {},
    });
    assert.equal(signout.statusCode, 200);
    const revoked = await app.inject({
      method: "GET",
      url: "/api/app/bootstrap",
      headers: { authorization },
    });
    assert.equal(revoked.statusCode, 401);
  } finally {
    try {
      await db.delete(authUser).where(eq(authUser.email, email));
    } finally {
      await app.close();
      await pool.end();
    }
  }
});

test("development authorization rejects cross-workspace access, renews sessions, and preserves revocation", async (t) => {
  const config = getServerConfig(process.env);
  assert.equal(config.environment, "development");
  assert.equal(process.env.NODE_ENV, "test");
  const { db, pool } = createDatabase(config.databaseUrl);
  const app = createApp({ db, auth: createAuth(db, config), config });
  const emails: string[] = [];
  const codes: string[] = [];
  const origin = { origin: config.betterAuthUrl };
  async function account() {
    const email = `polar-test-${randomUUID()}@example.test`;
    emails.push(email);
    const response = await app.inject({
      method: "POST",
      url: "/api/auth/sign-up/email",
      headers: origin,
      payload: {
        email,
        password: randomBytes(24).toString("hex"),
        name: "Authorization verification",
      },
    });
    assert.equal(response.statusCode, 200);
    const data = response.json();
    return {
      cookie: response.cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join("; "),
      token: data.token as string,
      id: data.user.id as string,
      headers: { ...origin, authorization: `Bearer ${data.token}` },
    };
  }
  async function device() {
    const response = await app.inject({
      method: "POST",
      url: "/api/auth/device/code",
      payload: { client_id: config.desktopClientId },
    });
    assert.equal(response.statusCode, 200);
    const data = response.json();
    codes.push(data.device_code);
    return data;
  }
  try {
    const first = await account();
    const second = await account();
    const bootstrap = await app.inject({
      method: "GET",
      url: "/api/app/bootstrap",
      headers: first.headers,
    });
    assert.equal(bootstrap.statusCode, 200);
    assert.deepEqual(bootstrap.json().workspaces, []);
    const created = await app.inject({
      method: "POST",
      url: "/api/app/workspaces",
      headers: first.headers,
      payload: { name: "Authorization workspace", privacy: "private" },
    });
    assert.equal(created.statusCode, 200, created.body);
    const identity = { ...bootstrap.json(), workspaces: [created.json().workspace] };
    await t.test(
      "concurrent bootstrap returns one committed account and workspace list",
      async () => {
        const responses = await Promise.all(
          Array.from({ length: 4 }, () =>
            app.inject({
              method: "GET",
              url: "/api/app/bootstrap",
              headers: second.headers,
            }),
          ),
        );
        for (const response of responses) {
          assert.equal(response.statusCode, 200);
          assert.deepEqual(response.json(), responses[0].json());
        }
      },
    );
    await t.test(
      "device registrations are owned by the signed-in account without a workspace selection",
      async () => {
        const deviceId = randomUUID();
        const request = {
          method: "POST" as const,
          url: "/api/app/devices",
          payload: { deviceId, label: "Test desktop" },
        };
        const owned = await app.inject({ ...request, headers: first.headers });
        assert.equal(owned.statusCode, 200);
        const repeated = await app.inject({ ...request, headers: first.headers });
        assert.deepEqual(repeated.json(), owned.json());
        const independent = await app.inject({
          ...request,
          headers: { ...second.headers, "x-polar-workspace-id": identity.workspaces[0].id },
        });
        assert.equal(independent.statusCode, 200);
        const other = await app.inject({ ...request, headers: second.headers });
        assert.equal(other.statusCode, 200);
        assert.notEqual(other.json().id, owned.json().id);
        const [row] = await db
          .select()
          .from(registeredDevice)
          .where(eq(registeredDevice.id, owned.json().id));
        assert.equal(row.userId, identity.user.id);
      },
    );
    await t.test(
      "bearer bootstrap extends an aged session and rejects an expired one",
      async () => {
        const expiry = new Date(Date.now() + 28 * 86400_000);
        await db
          .update(authSession)
          .set({ expiresAt: expiry, updatedAt: new Date(Date.now() - 2 * 86400_000) })
          .where(eq(authSession.token, first.token));
        const response = await app.inject({
          method: "GET",
          url: "/api/app/bootstrap",
          headers: first.headers,
        });
        assert.equal(response.statusCode, 200);
        const [renewed] = await db
          .select()
          .from(authSession)
          .where(eq(authSession.token, first.token));
        assert.ok(renewed.expiresAt.getTime() > expiry.getTime() + 86400_000);
        await db
          .update(authSession)
          .set({ expiresAt: new Date(Date.now() - 1000) })
          .where(eq(authSession.token, second.token));
        const expired = await app.inject({
          method: "GET",
          url: "/api/app/bootstrap",
          headers: second.headers,
        });
        assert.equal(expired.statusCode, 401);
      },
    );
    await t.test(
      "removed membership is never recreated by bootstrap or device registration",
      async () => {
        await db
          .delete(workspaceMembership)
          .where(
            and(
              eq(workspaceMembership.userId, identity.user.id),
              eq(workspaceMembership.workspaceId, identity.workspaces[0].id),
            ),
          );
        for (let attempt = 0; attempt < 2; attempt++) {
          const response = await app.inject({
            method: "GET",
            url: "/api/app/bootstrap",
            headers: first.headers,
          });
          assert.equal(response.statusCode, 200);
          assert.deepEqual(response.json().workspaces, []);
        }
        const registration = await app.inject({
          method: "POST",
          url: "/api/app/devices",
          headers: first.headers,
          payload: { deviceId: randomUUID(), label: "Revoked desktop" },
        });
        assert.equal(registration.statusCode, 200);
      },
    );
    await t.test(
      "device approval requires identity, rejects foreign origins and unknown clients",
      async () => {
        const unknown = await app.inject({
          method: "POST",
          url: "/api/auth/device/code",
          payload: { client_id: "unknown-client" },
        });
        assert.equal(unknown.statusCode, 400);
        const code = await device();
        const unauthenticated = await app.inject({
          method: "POST",
          url: "/api/auth/device/approve",
          headers: origin,
          payload: { userCode: code.user_code },
        });
        assert.equal(unauthenticated.statusCode, 401);
        const foreignOrigin = await app.inject({
          method: "POST",
          url: "/api/auth/device/approve",
          headers: { cookie: first.cookie, origin: "https://untrusted.example" },
          payload: { userCode: code.user_code },
        });
        assert.equal(foreignOrigin.statusCode, 403, foreignOrigin.body);
        const review = await app.inject({
          method: "GET",
          url: `/api/auth/device?user_code=${code.user_code}`,
          headers: first.headers,
        });
        assert.equal(review.statusCode, 200);
        const deny = await app.inject({
          method: "POST",
          url: "/api/auth/device/deny",
          headers: first.headers,
          payload: { userCode: code.user_code },
        });
        assert.equal(deny.statusCode, 200);
        const token = await app.inject({
          method: "POST",
          url: "/api/auth/device/token",
          payload: {
            client_id: config.desktopClientId,
            device_code: code.device_code,
            grant_type: "urn:ietf:params:oauth:grant-type:device_code",
          },
        });
        assert.equal(token.statusCode, 400);
        assert.equal(token.json().error, "access_denied");
      },
    );
  } finally {
    try {
      for (const code of codes)
        await db.delete(authDeviceCode).where(eq(authDeviceCode.deviceCode, code));
      for (const email of emails) await db.delete(authUser).where(eq(authUser.email, email));
    } finally {
      await app.close();
      await pool.end();
    }
  }
});
