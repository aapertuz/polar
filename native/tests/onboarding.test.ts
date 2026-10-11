import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";
import type { ViteDevServer } from "vite";

let server: ViteDevServer;
let Screen: React.ComponentType<{ account: any }>;
before(async () => {
  server = await createServer({
    root: fileURLToPath(new URL("../", import.meta.url)),
    server: { middlewareMode: true, hmr: false },
    appType: "custom",
  });
  Screen = (await server.ssrLoadModule("/src/pages/onboarding/OnboardingScreen.tsx"))
    .OnboardingScreen;
});
after(async () => {
  await server?.close();
});

function render(overrides: Record<string, unknown> = {}, status: Record<string, unknown> = {}) {
  const account = {
    status: { authenticated: false, email: null, workspaces: [], ...status },
    operation: null,
    desktop: true,
    busy: false,
    error: "",
    message: "",
    connect() {},
    cancel() {},
    signOut() {},
    openVerification() {},
    async selectWorkspace() {},
    async reload() {},
    ...overrides,
  };
  return renderToStaticMarkup(createElement(Screen, { account }));
}

test("signed-out setup leads with account creation and never offers workspace creation", () => {
  const html = render();
  assert.match(html, /Create account or sign in/);
  assert.doesNotMatch(html, /<form|Workspace name|Open account settings|Timeline/);
});
test("session restoration waits instead of flashing sign-in actions", () => {
  const html = render({ operation: "loading", busy: true });
  assert.match(html, /Checking your account/);
  assert.doesNotMatch(html, /<button|<form/);
});
test("browser handoff shows code, cancellation and return instructions", () => {
  const html = render(
    { operation: "connecting", busy: true },
    { userCode: "TEST-CODE", verificationUrl: "https://example.test/device" },
  );
  assert.match(html, /TEST-CODE/);
  assert.match(html, /Cancel sign-in/);
  assert.match(html, /Open browser again/);
  assert.match(html, /continue here automatically/);
  assert.doesNotMatch(html, /<form/);
});
test("authenticated setup offers creation and existing workspace selection", () => {
  const html = render(
    {},
    {
      authenticated: true,
      email: "test@example.test",
      workspaces: [{ id: "existing", name: "Existing team" }],
    },
  );
  assert.match(html, /Signed in as/);
  assert.match(html, /Existing team/);
  assert.match(html, /Workspace name/);
  assert.match(html, /Create workspace/);
  assert.doesNotMatch(html, /Create account or sign in|>Cancel</);
});
test("connection errors remain visible with a retry action and browser previews explain desktop requirement", () => {
  assert.match(render({ error: "Connection unavailable" }), /role="alert">Connection unavailable/);
  const html = render({ desktop: false });
  assert.match(html, /disabled=""/);
  assert.match(html, /Open the Polar desktop app/);
});
