import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import type { PolarAuth } from "../src/auth.js";
import type { ServerConfig } from "../src/config.js";
import type { PolarDatabase } from "../src/db/client.js";
import { createApp } from "../src/app.js";
import { REASONING_RESULT_BODY_LIMIT } from "../src/request-limits.js";
import {
  BootstrapResponseSchema,
  DeviceRegistrationRequestSchema,
  contractJsonSchemas,
  ReasoningResultSchema,
} from "@polar/contracts";

const config: ServerConfig = {
  environment: "development",
  host: "127.0.0.1",
  port: 3000,
  databaseUrl: "postgresql://polar:secret@localhost/polar",
  betterAuthSecret: "a-test-secret-that-is-at-least-32-chars",
  betterAuthUrl: "http://127.0.0.1:3000",
  desktopClientId: "com.polar.desktop",
};

function createAuth(sessionToken: string | null = null) {
  const requests: Request[] = [];
  const auth = {
    handler: async (request: Request) => {
      requests.push(request);
      const headers = new Headers({ "content-type": "application/json" });
      headers.append("set-cookie", "polar_session=first; HttpOnly; SameSite=Lax");
      headers.append("set-cookie", "polar_secure=second; HttpOnly; SameSite=Lax");
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
    },
    api: {
      getSession: async ({ headers }: { headers: Headers }) =>
        headers.get("authorization") === `Bearer ${sessionToken}` && sessionToken
          ? { user: { id: "auth-user-1", email: "person@example.test", name: "Person" } }
          : null,
    },
  } as unknown as PolarAuth;
  return { auth, requests };
}

test("GET /health returns a healthy JSON response", async () => {
  const app = createApp();
  try {
    const response = await app.inject({ method: "GET", url: "/health" });
    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json(), { status: "ok" });
  } finally {
    await app.close();
  }
});

function reasoningTestApp() {
  const { auth } = createAuth("reasoning-test-token");
  let reads = 0;
  const rows = [
    [{ id: "user-1" }],
    [{ userId: "user-1", workspaceId: "workspace-1" }],
    [{ id: "registered-device-1" }],
    [],
  ];
  const query = {
    from() {
      return this;
    },
    where() {
      return this;
    },
    limit: async () => rows[reads++] ?? [],
  };
  return createApp({ auth, db: { select: () => query } as unknown as PolarDatabase, config });
}

function detailedReasoningResult() {
  return {
    deviceId: "11111111-1111-4111-8111-111111111111",
    leaseToken: "22222222-2222-4222-8222-222222222222",
    provider: "chatgpt",
    model: "gpt-6.1-sol",
    output: {
      reply: "Review this detailed plan.",
      questions: [],
      citations: [],
      proposal: {
        name: "Deliver pilot",
        outcome: "Deliver a successful pilot.",
        successCriteria: [],
        constraints: [],
        deadlineAt: null,
        assessment: "The pilot needs preparation.",
        recommendation: "Prepare the pilot.",
        risks: [],
        assumptions: [],
        checkpoints: Array.from({ length: 6 }, (_, checkpoint) => ({
          name: `Checkpoint ${checkpoint}`,
          detail: "c".repeat(900),
          actions: Array.from({ length: 6 }, (_, action) => ({
            title: `Action ${checkpoint}-${action}`,
            detail: "a".repeat(900),
            priority: "High",
            dueOn: "2026-10-20",
            dependsOn: [],
          })),
        })),
      },
    },
  };
}

test("detailed reasoning results above 32 KiB reach the protected result handler", async () => {
  const payload = detailedReasoningResult();
  assert.equal(ReasoningResultSchema.safeParse(payload).success, true);
  assert.ok(Buffer.byteLength(JSON.stringify(payload)) > 32 * 1024);
  const app = reasoningTestApp();
  try {
    const response = await app.inject({
      method: "POST",
      url: "/api/app/reasoning/missing-job/result",
      headers: { authorization: "Bearer reasoning-test-token" },
      payload,
    });
    assert.equal(response.statusCode, 404, response.body);
    assert.equal(response.json().error, "REQUEST_NOT_FOUND");
    const anonymous = await app.inject({
      method: "POST",
      url: "/api/app/reasoning/missing-job/result",
      payload,
    });
    assert.equal(anonymous.statusCode, 401);
    const ordinary = await app.inject({
      method: "POST",
      url: "/api/app/mission-drafts",
      payload: { goal: "x".repeat(40_000) },
    });
    assert.equal(ordinary.statusCode, 413);
    const oversized = await app.inject({
      method: "POST",
      url: "/api/app/reasoning/missing-job/result",
      payload: { reply: "x".repeat(REASONING_RESULT_BODY_LIMIT) },
    });
    assert.equal(oversized.statusCode, 413);
  } finally {
    await app.close();
  }
});

test("reasoning output violations are distinguished from invalid submission metadata", async () => {
  for (const invalidOutput of [true, false]) {
    const app = reasoningTestApp();
    try {
      const payload = detailedReasoningResult();
      payload.output.proposal.checkpoints = payload.output.proposal.checkpoints.slice(0, 1);
      if (invalidOutput) payload.output.proposal.checkpoints[0]!.detail = "sensitive".repeat(200);
      else payload.leaseToken = "sensitive-invalid-token";
      const response = await app.inject({
        method: "POST",
        url: "/api/app/reasoning/missing-job/result",
        headers: { authorization: "Bearer reasoning-test-token" },
        payload,
      });
      assert.equal(response.statusCode, 400, response.body);
      assert.equal(response.json().error, invalidOutput ? "INVALID_PLAN" : "INVALID_REQUEST");
      assert.ok(!response.body.includes("sensitive"));
    } finally {
      await app.close();
    }
  }
});

test("hosted browser flow serves a same-origin approval page with device-possession guidance", async () => {
  const { auth } = createAuth();
  const app = createApp({ auth, db: {} as PolarDatabase, config });
  try {
    const page = await app.inject({ method: "GET", url: "/device?user_code=ABCD1234" });
    assert.equal(page.statusCode, 200);
    assert.match(page.headers["content-security-policy"] as string, /connect-src 'self'/);
    assert.match(page.body, /Only approve a code shown by Polar/);
    assert.match(page.body, /\/device\/device\.js/);

    const script = await app.inject({ method: "GET", url: "/device/device.js" });
    assert.match(script.body, /\/api\/auth\/device\/approve/);
    assert.match(script.body, /\/api\/auth\/device\/deny/);
    assert.match(script.body, /\/api\/auth\/sign-up\/email/);
  } finally {
    await app.close();
  }
});

test("Better Auth handler preserves query strings and browser session cookies", async () => {
  const { auth, requests } = createAuth();
  const app = createApp({ auth, db: {} as PolarDatabase, config });
  try {
    const response = await app.inject({
      method: "GET",
      url: "/api/auth/device?user_code=ABCD1234",
      headers: { origin: config.betterAuthUrl },
    });
    assert.equal(response.statusCode, 200);
    assert.equal(requests[0]?.url, `${config.betterAuthUrl}/api/auth/device?user_code=ABCD1234`);
    const cookies = response.headers["set-cookie"];
    assert.ok(Array.isArray(cookies));
    assert.equal(cookies.length, 2);
    assert.ok(cookies.every((cookie) => cookie.includes("HttpOnly")));
  } finally {
    await app.close();
  }
});

test("a desktop environment mismatch is rejected before authentication or database work", async () => {
  const { auth, requests } = createAuth();
  const app = createApp({ auth, db: {} as PolarDatabase, config });
  try {
    for (const url of ["/api/auth/device/code", "/api/app/devices"]) {
      const response = await app.inject({
        method: "POST",
        url,
        headers: { "x-polar-environment": "production" },
        payload: {},
      });
      assert.equal(response.statusCode, 409);
      assert.equal(response.json().error, "ENVIRONMENT_MISMATCH");
    }
    assert.equal(requests.length, 0);
    const production = createApp({
      auth,
      db: {} as PolarDatabase,
      config: { ...config, environment: "production" },
    });
    try {
      const response = await production.inject({
        method: "POST",
        url: "/api/auth/device/code",
        headers: { "x-polar-environment": "development" },
        payload: {},
      });
      assert.equal(response.statusCode, 409);
      assert.equal(requests.length, 0);
    } finally {
      await production.close();
    }
  } finally {
    await app.close();
  }
});

test("protected bootstrap rejects missing or revoked bearer sessions", async () => {
  const { auth } = createAuth();
  const app = createApp({ auth, db: {} as PolarDatabase, config });
  try {
    const response = await app.inject({ method: "GET", url: "/api/app/bootstrap" });
    assert.equal(response.statusCode, 401);
    assert.equal(response.json().error, "UNAUTHENTICATED");
  } finally {
    await app.close();
  }
});

test("device registration requires current workspace membership", async () => {
  const { auth } = createAuth("opaque-test-token");
  let selectCount = 0;
  const query = {
    from() {
      return this;
    },
    where() {
      return this;
    },
    limit: async () => {
      selectCount += 1;
      return selectCount === 1 ? [{ id: "polar-user-1" }] : [];
    },
  };
  const db = { select: () => query } as unknown as PolarDatabase;
  const app = createApp({ auth, db, config });
  try {
    const response = await app.inject({
      method: "POST",
      url: "/api/app/devices",
      headers: { authorization: "Bearer opaque-test-token" },
      payload: { deviceId: "a45481a4-f251-4cc9-b877-71ddfa88e9e3", label: "This Polar desktop" },
    });
    assert.equal(response.statusCode, 403);
    assert.equal(response.json().error, "WORKSPACE_ACCESS_REQUIRED");
    assert.equal(selectCount, 2);
  } finally {
    await app.close();
  }
});

test("shared Zod contracts validate payloads and publish JSON Schema", () => {
  assert.equal(
    DeviceRegistrationRequestSchema.safeParse({
      deviceId: "a45481a4-f251-4cc9-b877-71ddfa88e9e3",
      label: " Polar desktop ",
    }).success,
    true,
  );
  assert.equal(
    DeviceRegistrationRequestSchema.safeParse({ deviceId: "not-a-uuid", label: "" }).success,
    false,
  );
  assert.equal(
    BootstrapResponseSchema.safeParse({
      user: { id: "user-1", email: "bad-email", name: "Person" },
      workspace: { id: "workspace-1", name: "Personal workspace", role: "owner" },
    }).success,
    false,
  );
  const registrationJsonSchema = contractJsonSchemas.deviceRegistrationRequest as {
    properties: { deviceId: { format: string } };
  };
  assert.equal(registrationJsonSchema.properties.deviceId.format, "uuid");
});

test("cookie-authenticated plugin mutations reject missing or foreign browser origins", async () => {
  const { auth, requests } = createAuth();
  const app = createApp({ auth, db: {} as PolarDatabase, config });
  try {
    for (const origin of [undefined, "https://untrusted.example"]) {
      const response = await app.inject({
        method: "POST",
        url: "/api/auth/device/approve",
        headers: {
          cookie: "polar-development.session_token=browser-session",
          ...(origin ? { origin } : {}),
        },
        payload: { userCode: "ABCD1234" },
      });
      assert.equal(response.statusCode, 403);
    }
    assert.equal(requests.length, 0);
  } finally {
    await app.close();
  }
});

test("hosted device UI requires a session and the matching client before showing approval", async () => {
  const { auth } = createAuth();
  const app = createApp({ auth, db: {} as PolarDatabase, config });
  try {
    const script = await app.inject({ method: "GET", url: "/device/device.js" });
    async function inspect(responses: unknown[], offline = false) {
      const elements = new Map<
        string,
        {
          value: string;
          textContent: string;
          style: { display: string };
          classList: { toggle(): void };
          addEventListener(): void;
        }
      >();
      const document = {
        querySelector(selector: string) {
          if (!elements.has(selector))
            elements.set(selector, {
              value: "PUBLIC42",
              textContent: "",
              style: { display: "none" },
              classList: { toggle() {} },
              addEventListener() {},
            });
          return elements.get(selector)!;
        },
      };
      const paths: string[] = [];
      const context = vm.createContext({
        document,
        location: { search: "" },
        URLSearchParams,
        fetch: async (path: string) => {
          paths.push(path);
          if (offline) throw new Error("offline");
          return { ok: true, status: 200, json: async () => responses.shift() };
        },
      });
      vm.runInContext(script.body, context);
      await vm.runInContext("inspectDevice()", context);
      return { elements, paths };
    }
    const anonymous = await inspect([null]);
    assert.equal(anonymous.elements.get("#device")?.style.display, "none");
    assert.deepEqual(anonymous.paths, ["/api/auth/get-session"]);
    const foreign = await inspect([{ session: {} }, { client_id: "unknown" }]);
    assert.equal(foreign.elements.get("#device")?.style.display, "none");
    const allowed = await inspect([{ session: {} }, { client_id: config.desktopClientId }]);
    assert.equal(allowed.elements.get("#device")?.style.display, "block");
    const offline = await inspect([], true);
    assert.equal(offline.elements.get("#device")?.style.display, "none");
    assert.match(offline.elements.get("#status")?.textContent ?? "", /connection and retry/);
  } finally {
    await app.close();
  }
});
