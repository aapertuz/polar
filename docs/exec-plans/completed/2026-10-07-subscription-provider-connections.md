# Subscription provider connections

Status: Complete
Owner: current agent
Created: 2026-10-07

## Goal and acceptance criteria

Explicit requirement: enable Polar to connect to the user's ChatGPT or Claude
subscription. User approved ChatGPT-first implementation for the open-source app.

Acceptance criteria:
- Settings provides browser OAuth, cancellation, saved registration selection,
  reconnect, disconnect, and model selection; state persists across app restarts.
- Rust validates state, PKCE, signed ID-token identity and nonce, and plan scopes.
  Secrets stay in the OS credential store and never cross IPC.
- Registrations retain their issued client ID and opaque host ID; accounts with
  the same email remain separate. Reauthorization cannot replace another identity.
- Refreshes serialize; disconnect cancels work, attempts revocation, clears local
  tokens, and reports unconfirmed remote revocation without restoring local access.
- A user-triggered fixed-prompt test uses streaming inference with storage disabled
  and requires a completed terminal event; interrupted/failed streams never pass.
- Quota/auth/network failures are actionable and never change billing routes.
- Quick AI preview behavior remains unchanged; Claude login stays unavailable.
- Run provider regression checks, `pnpm verify`, and native desktop smoke review.

Project-supported constraints: provider execution and credentials remain local
to the desktop; credentials do not enter React or the Fastify server. Provider
selection is explicit. Authentication and quota failures never silently switch
to paid API access. These constraints come from [the target architecture](../../../ARCHITECTURE.md).

## Context

- No existing active plan covered this work; working tree was clean on inspection.
- [Product requirements](../../PRODUCT.md), [design system](../../DESIGN.md), and
  [verification](../../VERIFICATION.md) were consulted.
- `native/src/pages/home/components/overlays/SettingsOverlay.tsx` displays only an
  appearance preview. There is no connection flow.
- `native/src/features/quick-ai/utils/quickAiSession.ts` returns a fixed sample
  response; `hooks/useQuickAi.ts` performs no inference.
- `native/src-tauri/src/lib.rs` registers only `greet` and the opener plugin.
- `server/src/app.ts` implements only health behavior.

## Steps and progress

- [x] Inspect implemented provider/UI/native boundaries and active plans.
- [x] Check current official provider documentation.
- [x] Resolve distribution model and eligibility; define a reviewable design.
- [x] Finalize acceptance criteria and implementation steps.
- [x] Implement the eligible local connection route and its UI.
- [x] Verify connection success, rejection, cancellation, reconnect, and inference
  behavior, then complete required repository checks.

## Decisions and discoveries

2026-10-07 implementation breakdown: (1) native credential store and OAuth
protocol, (2) cancellable connection/model/inference IPC operations, (3) Settings
UI using existing tokens and overlay lifecycle, (4) deterministic protocol and
state tests, repository verification, and desktop smoke checks. Dependencies are
managed by Cargo; no server or packaging configuration changes are planned.

2026-10-07: This is a new subsystem crossing UI, Rust IPC, authentication, and
provider execution, not a small change to an existing provider flow.

2026-10-07: User confirmed Polar is open source. Proceed with the documented
OpenAI open-source local-app route as the proposed first provider. This answer
resolves distribution; it does not establish Anthropic approval or approve a
reduced ChatGPT-only implementation scope.

OpenAI documents ChatGPT plan usage for open-source/local apps. Paid or remotely
hosted apps are directed to an interest form. Eligibility must be resolved before
selecting this route. The documented flow uses per-user registration, a stable
host ID, and app-owned OAuth token lifecycle:
[ChatGPT plan usage overview](https://developers.openai.com/siwc/token-sharing-open-source).
Inference requires streaming requests with storage disabled:
[preview limitations](https://developers.openai.com/siwc/token-sharing-open-source/preview-limitations).

Anthropic's [Agent SDK overview](https://code.claude.com/docs/en/agent-sdk/overview)
requires prior approval for third-party products to offer Claude.ai login or plan
rate limits. Its [subscription support article](https://support.claude.com/en/articles/15036540-use-the-claude-agent-sdk-with-your-claude-plan)
says an announced SDK billing change was paused and subscription usage continues.
Billing availability alone does not resolve third-party product eligibility.
[Programmatic CLI mode](https://code.claude.com/docs/en/headless) is an Agent SDK
surface; `--bare` explicitly does not use subscription OAuth. Do not assume CLI
invocation bypasses the product eligibility requirement.

Agent proposal, not accepted scope: begin with an eligible ChatGPT OAuth
connection in Settings, local credential storage, explicit selection/disconnect,
and a real connection test. Keep Claude subscription support gated on confirmed
eligibility. Decide separately whether Quick AI inference belongs in this first
increment; mission persistence and the cloud job coordinator are not prerequisites
for a local connection and must not be pulled in implicitly.

Refined proposal after distribution clarification:

- Settings offers Continue with ChatGPT, saved account/workspace selection,
  connection status, model selection, cancellation, reconnect, and disconnect.
- Rust owns a loopback OAuth listener, per-attempt state/nonce/PKCE, ID-token
  signature/issuer/audience/expiry validation, issued client registrations,
  a persisted opaque host ID, and protected OS credential storage. Tokens never
  cross IPC into React. Refreshes serialize per session; disconnect stops
  requests, attempts session revocation, clears tokens, and preserves the
  non-secret registration mapping for reauthorization.
- A user-triggered connection test streams a small inference and requires its
  completed terminal event; model listing alone does not prove inference access.
- ChatGPT calls go directly from Rust to the documented public Responses API.
  This avoids requiring Codex installation and an extra subprocess lifecycle.
  The alternative is Codex app-server, useful for an agent/tool runtime but
  unnecessary for this initial connection feature.
- Claude subscription connection remains unavailable unless Anthropic approval
  is established. Open-source distribution does not remove that requirement.
- First increment is connection management plus an explicit inference test.
  Quick AI mission behavior remains a separately scoped follow-up.

Official implementation references:
[registration/sign-in](https://developers.openai.com/siwc/token-sharing-open-source/sign-in),
[accounts/sessions](https://developers.openai.com/siwc/token-sharing-open-source/profiles-and-sessions),
and [models/inference](https://developers.openai.com/siwc/token-sharing-open-source/models-and-inference).
Initial registration uses `dynamic_agent_client`; subsequent code exchanges,
refreshes, and reauthorization use the issued client ID.

## Callback failure follow-up

User reported connection refused at the local callback after accepting consent.
The old attempt waited only 180 seconds; Settings unmount/cancellation or an app
restart also closes its listener. The screenshot confirms the listener was absent,
not which shutdown trigger occurred. Extend the wait to 30 minutes, explain that
Settings/app must remain open, and cover delayed MFA, timeout, and cancellation
with deterministic virtual-clock regressions. Old callback URLs cannot be replayed
into a new attempt; never copy or log their authorization codes.

Follow-up verification: `pnpm verify` passed with 21 Rust provider tests,
including a valid callback after 16 virtual minutes and timeout/cancellation
regressions. `pnpm tauri build --debug --bundles app` passed; reopened the rebuilt
debug bundle and navigated launcher → Settings. A new authenticated callback
requires the user to start a fresh attempt and complete consent; no old code was
replayed. The native Settings reload was still reading the OS credential store
on initial inspection. It subsequently completed without error and enabled
Continue with ChatGPT. Started a fresh attempt in the rebuilt app, confirmed its
30-minute/keep-open instruction in native Settings, and observed the official
OpenAI browser consent page. Left that attempt running for the user to accept;
no consent was submitted by the agent. The earlier intermittent Keychain wait
remains an open robustness check.

## Inference failure follow-up

User completed OAuth consent and selected a catalog model; the test returned a
generic invalid-response error. Restarting the diagnostic native build restored
the connected account and selected model, establishing native credential/model
persistence. Safe static diagnostics reproduced rejection at the Content-Type
check, before consuming events. No credentials or provider payload were logged.
The reader now requests SSE explicitly and validates bounded event data even
when a gateway labels it with a different media type. Ordinary non-streaming
JSON responses fail; structured quota errors are still propagated. Added
regressions for mislabeled SSE, JSON quota errors, and non-streaming success.
`pnpm verify` passed (23 provider tests) and the debug app bundle built successfully.
Live retest passed in the rebuilt macOS app using the user's saved registration
and selected GPT-5.6-Sol model: Settings displayed "Connection verified. Your
selected model completed the test." Successful authenticated model listing and
credential/model restoration across two app restarts were also observed. No
reauthorization was needed; the account remains connected. The Content-Type
rejection was the actual cause of this reported inference failure.
`git diff --check` passed. No application checks were skipped for this fix.

## Verification

2026-10-07 final automated rerun:
- `pnpm verify` passed on the current working tree: formatting, lint, docs,
  frontend conventions, 9 checker regression tests, TypeScript, frontend/server
  builds, 21 native tests, Rust format/check plus 23 provider tests, and 4 server
  tests.
- `git diff --check` passed.
- Existing desktop smoke records cover Settings, canceled sign-in, account/model
  restoration, and successful inference. Provider regression tests cover callback
  rejection/cancellation, serialized token rotation, distinct registrations, and
  disconnect cleanup.
- Per the user's scope correction, extended release lifecycle exercises from the
  broader provider smoke review are not remaining checks for this plan.

2026-10-07:
- `pnpm verify` passed after the final application changes: formatting, lint,
  docs, frontend conventions, 9 checker regression tests, TypeScript, builds,
  21 native frontend tests, 19 Rust provider tests, and 4 server tests.
- `pnpm tauri build --debug --bundles app` passed; the macOS debug bundle was
  rebuilt for desktop inspection. No packaging configuration changed.
- `git diff --check` passed.
- `pnpm dev:native` could not start its second Vite server because the existing
  server already occupied port 1420. `pnpm tauri dev --config
  '{"build":{"beforeDevCommand":""}}'` ran using that server. The additional
  agent-started development process was stopped afterward.
- Actual desktop inspection: Settings opens from the launcher, secure-store
  status reads Not connected, Continue with ChatGPT opens the official browser
  sign-in, and Cancel returns to idle without saving a registration. The native
  dialog was inspected at 800×600 and approximately 1512×948; Escape dismissal
  followed by Return reopened the launcher, verifying focus return. On a fresh
  debug launch, credential reload was initially slow but completed successfully.
  A later reload remained blocked in the credential operation. Added a cancellable
  blocking-worker read with a 30-second timeout and a regression test proving the
  credential lock remains held until the OS read finishes. Asked the user whether
  a system credential prompt is visible; no answer received before handoff.
  In the final rebuilt native app, cancelling the pending storage read returned
  the UI to idle with a cancellation message. Reload reported busy while the OS
  read remained outstanding, as required to prevent concurrent credential writes.
  The underlying OS wait remains unresolved; the 30-second timeout path has not
  been observed manually. The cancelled browser test tab was closed.
- The inference follow-up above supersedes the earlier unverified consent,
  catalog, inference, and connected-account restart scenarios. Real token renewal,
  reconnect, multiple registrations, and remote revocation still need live checks.
  Mock store tests do not establish native backend behavior on untested platforms;
  Windows and Linux backends have not been exercised.

## Implementation decisions

Rust owns OAuth, signed identity checks, plan scopes, direct catalog/inference
requests, and OS-protected credentials. IPC exposes sanitized account/model data
and static errors. An OS file lock plus a native mutex serializes credential
access across processes. Cancellation finishes an in-flight token rotation and
its protected-store write before stopping subsequent requests. Disconnect cancels
local work, clears credentials first, and reports unconfirmed remote revocation.
An expired authorization code gets one fresh authorization with its issued client
ID retained. Fixed test inference requires a successful terminal streaming event.

Settings is reachable through the existing launcher because the homescreen no
longer mounts the older system rail. Dialog titles use unique accessibility IDs
so the first-use ChatGPT-plan notice can open over Settings. Provider behavior and
verification limits are documented in [local provider connections](../../PROVIDER-CONNECTIONS.md).
No owner-maintained product, architecture, or design reference was modified.

The target architecture's Claude CLI choice still needs owner reconciliation
with current Anthropic eligibility requirements. This implementation leaves
Claude unavailable under the approved first-provider scope.

## Handoff or outcome

The approved ChatGPT connection feature is implemented. Superpowers remains
removed and was not used after removal. Quick AI remains the sample preview.

The reported callback and inference failures have been corrected. The app was
left open with a verified connection and the user's existing account/model.

The approved ChatGPT connection scope and its planned verification are complete.
Extended live account lifecycle exercises remain outside this plan's completion
gate. Investigate the earlier intermittent OS credential wait if it recurs;
owner references remain unchanged.
