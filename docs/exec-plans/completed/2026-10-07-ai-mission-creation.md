# AI mission creation and activation

Status: Complete — implementation and owner-reported manual acceptance checks complete
Owner: Codex
Created: 2026-10-07
Depends on: [Authentication plan](2026-10-07-authentication.md)

## Goal and acceptance criteria

Deliver a real, persistent creation flow:

**Goal + context → conversational clarification → proposed mission and plan →
review → activation → Home shows what to do next.**

Confirmed requirements:

- Implement creation and activation first, rather than the full manual
  evidence/replanning loop.
- Accept text PDFs, DOCX, Markdown, plain text, and pasted context.
- Keep original documents local; synchronize extracted text to Neon.
- Make clarification conversational, like ChatGPT: the number of questions
  depends on the context and missing information, with no fixed questionnaire
  or question count.
- Start the conversation in Quick AI and move proposed-plan review into the
  existing larger mission window.
- Use Inngest for background orchestration.
- Save this plan for a later session; do not implement AI behavior in the planning
  session.

Planned acceptance criteria, based on the architecture and proposed defaults:

- Users can describe the goal and attach context before or during the
  conversation. Files contribute actual extracted text, not only filenames.
- Polar uses supplied context and answers to clarify consequential gaps, avoids
  repeating answered questions, and labels assumptions without inventing facts.
- Users can review and refine outcome, success criteria, constraints, optional
  deadline, checkpoints, supporting actions, dependencies, risks, and assumptions
  before activation.
- Activation commits the exact reviewed current proposal and displays an
  explainable next action on Home.
- Drafts, conversations, selected context, and approved missions survive closing
  the panel and restarting the app.
- Unsupported documents, extraction failures, provider failures, and unavailable
  workers are visible and recoverable. Partial or stale output cannot activate.

Outside this increment: post-activation evidence-driven replanning, external
integrations, OCR/vision, scheduled reminders, autonomous execution, task-board
editing, multiple agents, and a native notch companion. This increment validates
initial planning, not the complete adaptive product loop.

## Context

### User-reported provider failure investigation — 2026-10-08

- User reported the same banners after the limit fix. Fresh approved
  `pnpm native:status` showed ready native PID 91426 (sandboxed inspection first
  failed with `ps EPERM`). Initial exact development-app binding succeeded and
  displayed the saved user goal followed by an actual Polar clarification reply;
  neither failure banner was present. No retry, edit, or additional capture was
  performed. This establishes successful live clarification, not full proposal
  generation, and does not reconstruct the earlier failure's cause.
- Fixed the worker catch to use the existing string-aware error normalization,
  extracted that pure utility and covered native string/Error rejections plus
  unknown/empty fallbacks. Added native inference failure stderr diagnostics
  with request ID, stage, and locally defined error code only. No credentials,
  user text, or raw provider response is logged. Diagnostics appear in the
  development launcher terminal; no persistent log file was added. Acceptance
  for this follow-up is retaining actionable IPC messages and safe correlation
  of inference failures. Next action: if failure recurs, inspect its specific
  displayed message and correlated terminal code; full mission acceptance
  checks remain active.
  `pnpm verify` passed after these changes, including 28 native, 45 Rust, and
  21 server tests. The new failure presentation has deterministic coverage;
  a fresh live provider failure was not deliberately triggered.
- Output-limit fix requested subsequently: acceptance criteria are that mission
  JSON above 8 KiB parses successfully, connection tests retain their 8 KiB
  bound, and response transport remains bounded at 2 MiB. Implemented a shared
  stream reader with an explicit per-use output limit (2 MiB for missions),
  preserving completion/error validation and making shared errors say response
  rather than test. Added regression checks for large JSON on SSE and mislabeled
  streams, UTF-8 byte boundaries across deltas, and oversized mission transport.
  All three new tests passed. `pnpm verify` passed (45 Rust, 26 native, 21 server
  tests plus checks/builds). The first sandboxed run passed 43 Rust tests but
  failed two existing loopback tests with `PermissionDenied`; the approved
  rerun passed all checks. No live ChatGPT retry was performed, so the original
  screenshot's exact cause and live recovery remain unverified. Next action is
  a live mission retry; the broader logging/UI error proposals below remain
  follow-ups and were not included in this focused limit fix.
- Inspected the screenshot's two error paths without issuing a live inference,
  retry, or changing application behavior. The persisted failed-request banner
  is written by the server's reasoning failure endpoint. The desktop calls that
  endpoint after claiming a job and receiving a provider/parser error; this is
  evidence of an attempted inference, not proof that the local worker is absent.
- The native command returns `Result<String, String>`, but the Quick AI worker
  catch accepts only JavaScript `Error` objects. String rejections lose their
  actionable message and become “The local ChatGPT worker is unavailable.”
- Fastify enables request logging, but the failure endpoint neither logs nor
  persists the provider error code. Its request body contains only the lease
  token, and the database receives a generic error message. Native provider
  code has no diagnostic logging here; the development launcher inherits the
  terminal streams rather than retaining a runtime log file. Inspected local
  temporary log filenames were verification/migration artifacts; the Polar log
  directory search found an older crash report, not this request's diagnostics.
- Found a concrete possible failure: mission inference reuses `TestStream`,
  whose accumulated output text is limited to 8,192 UTF-8 bytes despite a 2 MiB
  response-body allowance. A larger structured mission plan is rejected locally
  as `invalid_response`. This is a plausible cause, not an established cause of
  the screenshot; the original provider status/code and response size were not
  retained. Authentication, quota, network, incomplete stream, and invalid JSON
  failures can produce the same displayed banners.
- Next action: preserve safe native error codes, stage and reasoning request ID
  in diagnostics; preserve string IPC messages in the UI; separate connection
  test and mission output limits. Reproduce with deterministic stream fixtures
  before a user-authorized live retry. This investigation adds no application
  changes and does not close the plan's live acceptance gaps.

The inspection on 2026-10-07 found:

- `native/src/features/quick-ai/` implements simulated responses and context
  references. File selection stores filename metadata without reading contents.
- `native/src/pages/home/hooks/useHomeScreen.ts` uses a hardcoded empty mission
  collection. Existing mission and attention components are available, but their
  types and presentation contain fixture-oriented assumptions.
- `native/src-tauri/src/providers/` supports ChatGPT connection management and a
  fixed-prompt streaming test; it does not yet execute mission planning requests.
- The Fastify server has no mission persistence, reasoning jobs, or Inngest
  handlers. The target architecture describes those responsibilities, not
  existing implementations.

Read [Product](../../PRODUCT.md), [Architecture](../../../ARCHITECTURE.md),
[Design](../../DESIGN.md), [Frontend conventions](../../FRONTEND.md),
[Provider connections](../../PROVIDER-CONNECTIONS.md), and
[Verification](../../VERIFICATION.md) when resuming. Confirm the authentication
plan's delivered interfaces against current code before using them.

## Steps and progress

- [x] Inspect Quick AI, mission views, provider inference, server scaffold, tests,
  and project references.
- [x] Clarify release scope, document formats/storage, and conversational behavior.
- [x] Save the separate linked active plans for later sessions.
- [x] Confirm the authentication prerequisite provides the required user,
  workspace, device, transport, and persistence boundaries.
- [x] Add conversation, source, goal/mission, proposal/plan, reasoning-request,
  event, audit, attention, and outbox persistence and contracts.
- [x] Implement local document import/extraction and extracted-text
  synchronization with source provenance.
- [x] Implement bounded context assembly, the Mission Interpreter, the Planner,
  and the authorized desktop reasoning worker.
- [x] Add Inngest workflows, durable event delivery, and recovery processing.
- [x] Implement conversational creation, mission-window review, refinement,
  activation, and draft resumption.
- [x] Wire persisted mission/attention queries into Home and remove fixture
  assumptions from the changed views.
- [x] Verify acceptance criteria and record actual results, gaps, and follow-ups.

## Decisions and discoveries

### Confirmed user decisions — 2026-10-07

- First implementation covers creation and activation; replanning follows later.
- Neon owns structured state. Original documents stay on the device and extracted
  text syncs to the database; no remote object-storage service is requested.
- Support PDF, DOCX, Markdown/plain text, and pasted context initially. Images and
  scanned-document interpretation are deferred.
- Clarifying questions are context-dependent, without a fixed count.
- Use Quick AI for conversation and the existing mission window for review.
- Authentication has its own prerequisite plan, using Better Auth.
- Neither application implementation is requested in this session.

### Authentication prerequisite completion — 2026-10-08

- Authentication now uses Better Auth, Neon-backed sessions, Rust-held bearer
  credentials, Polar-hosted browser sign-in/device approval, and current
  workspace-membership authorization. The authentication plan is complete.
- Current code exposes authenticated account bootstrap and device registration;
  Rust owns authenticated transport and the registered device ID. The completed
  plan records development Neon live integration and native lifecycle
  verification. Its production-origin gap is explicitly deferred and does not
  block development work.
- Reuse the existing identity, workspace, device, and transport boundaries. Do
  not restart or modify the completed authentication plan.

### Baseline inspection — 2026-10-08

- The working tree contains untracked local Neon skills, `skills-lock.json`, and
  this active plan. These are preserved.
- Current code has no mission/source/conversation/reasoning persistence or
  Inngest integration. Home hardcodes an empty mission list and Quick AI stores
  fixture preview state only.
- Rust provider integration supports ChatGPT connection/model selection and a
  fixed connection test, but no mission request. Its adapter already enforces
  selected account/model, completed streaming responses, and no paid fallback.
- Better Auth bootstrap and device routes exist in Fastify; Rust keeps the
  bearer token in secure storage and registers its device. Authorization uses
  current workspace membership.
- The earlier plan statement that authentication remains in progress was stale
  and has been corrected here.

### Persistence and desktop-worker foundation — 2026-10-08

- Added shared validated contracts and Drizzle tables for drafts, messages,
  sources, reasoning leases, versioned proposals, missions/actions, attention,
  domain events, and the transactional outbox.
- Added migration `0002_certain_turbo.sql` and applied it through
  `pnpm --filter @polar/server db:migrate`, which selects development. No
  production connection was selected.
- Added Fastify mission endpoints with Better Auth session checks, current
  workspace membership checks, registered-device checks for reasoning claims,
  provider-result validation, and exact proposal hash checks at activation.
- Added Fastify/Inngest handlers for reasoning-request orchestration and outbox
  recovery. Request/workflow payloads carry IDs; document text remains in
  authorized database context and provider credentials remain in Rust.
- Added a Rust native picker and bounded local extraction for PDF, DOCX,
  Markdown, and UTF-8 text. Added typed authenticated Rust calls for mission
  persistence plus a Rust-only provider worker command. These are implemented
  but need integration tests and UI wiring before acceptance.
- Preliminary checks: server TypeScript check passed; Rust check passed with one
  removable unused-mut warning. Focused extraction tests are still running.

### End-to-end implementation — 2026-10-08

- Added bounded conversation/source input, SHA-256 source-content validation,
  current-workspace/device authorization, fenced reasoning leases, cancellation,
  retry, exact-current-proposal activation, and persisted dependency-ready actions.
- A draft may begin with selected context and no goal. The first submitted goal
  becomes the draft goal; source text and provenance are durable before that first
  message. Responses with unresolved questions cannot save an activatable
  proposal; the questions are persisted in the assistant message.
- Added local ChatGPT schema-constrained streaming through Rust using the saved
  account and selected model, with no credential transfer to Fastify or paid API
  fallback. Production server startup now requires both Inngest Cloud keys;
  development uses the local Inngest Dev Server.
- Wired persisted missions into Home and the existing mission window. Replaced
  Quick AI's simulated answer with a saved conversation, source import and paste,
  waiting/claimed/failure/cancellation/retry states, proposal review, refinement,
  and activation controls. Removed fixture percentages and fabricated deadlines.
- A desktop startup race was found: concurrent account reads could reject a
  mission request with a busy error. Mission-owned internal session reads now
  wait behind an active local account operation.
- The extractor unit test exposed and now covers DOCX XML entity handling.
  Source import also validates extracted content hashes on the server.

### Decisions supported by project documentation

- Keep Tauri/React and Fastify; the pasted requirement's Next.js suggestion does
  not require replacing the established stack.
- Postgres stores reality; model output is a validated interpretation/proposal.
  Use current-state records, append-only events, and a transactional outbox rather
  than implementing full event sourcing.
- Inngest orchestrates work; desktop Rust invokes the selected local provider
  adapter and keeps provider credentials local.
- SQLite is a scoped cache and durable outgoing command queue, not shared truth.
- Use Polar domain language: checkpoints and actions rather than introducing
  milestones and tasks as new top-level UI concepts.
- Consequential AI changes remain under human control. A proposal is bound to
  exact content and source/base revisions; refinement creates a replacement.
- Domain rules and authorization belong in application/domain services. HTTP and
  workflow handlers call those services; cross-module commits use operations.
- Sources and model output are untrusted data. Explanations preserve concise
  reasons and source references, not hidden chain of thought.

### Agent proposals — implementation defaults, not separately approved requirements

#### Creation and review

- Start with an empty composer and “What are you trying to accomplish?” as its
  placeholder. Keep one attachment control rather than duplicate context/source
  menus with no useful initial data.
- Show per-source reading, ready, and failed states. Offer extracted-text
  inspection, removal, and retry, and explain local originals/cloud text.
- Offer Review plan when interpretation is ready. In the existing dark mission
  window, mark the mission Draft and use Overview, Plan, and Context.
- Overview presents the proposed brief and first recommendation. Plan presents
  meaningful checkpoints and expandable supporting actions, dependencies, risks,
  and assumptions. Context exposes selected sources and provenance.
- Offer Activate mission and Refine with Polar. Refinement returns to the
  conversation; do not add a task editor in this increment.
- Preserve unfinished conversations and provide a quiet Resume entry. Close
  preserves work; explicit Stop cancels an active reasoning request.
- Activation selects the mission on Home. Keep upcoming actions in the timeline;
  Overview explains the recommendation without duplicating the action list.
- Hide absent deadlines and ungrounded percentages. Proposed actions start
  pending; activation does not assert execution or completion. Remove simulated
  Apply to plan controls where no real proposal exists.
- Reuse desktop primitives, tokens, focus behavior, and reduced-motion policy.
  Use product loading labels such as Reading documents and Building your plan.

#### Documents and context

- Use a narrow Rust command that opens the native picker, validates selected
  files, and creates user-scoped local snapshots. Do not grant generic filesystem
  access to React or send local paths/document binaries to the server.
- Use `pdf-extract` for text PDFs, bounded ZIP/XML parsing for DOCX, and UTF-8
  decoding for text. Preserve page references where available and paragraph
  references otherwise. Keep blocking parsing off the async/UI execution path.
- Proposed configurable limits: 10 files per draft, 20 MiB per file, and 1 MiB
  extracted text per source. Bound DOCX decompression as well as compressed size.
- Report unsupported, encrypted, scanned-only, corrupt, and oversized sources;
  never silently treat failed extraction as usable context.
- Synchronize extracted text, filename, content hash, provenance, extraction
  state, and source revision. Source removal excludes it from future reasoning
  and invalidates dependent pending proposals; events retain identifiers rather
  than immutable copies of raw source text.
- Assemble bounded context from the conversation, structured brief, and selected
  authorized sources. Start with deterministic chunk relevance, without vectors
  or a graph database. Record included excerpts and omissions in a versioned
  manifest, and expose partial coverage when relevant.
- Maintain the user-owned goal/private goal link separately from workspace
  execution. Use only explicitly selected context for the target workspace;
  cross-workspace retrieval and sharing UI are deferred.

#### Reasoning, workflows, and activation

- Separate Mission Interpreter and Planner operations, using the existing
  selected eligible ChatGPT account/model. Interpretation returns a conversational
  reply, unresolved questions, and structured brief; planning returns the
  proposed execution model and explainable next-action recommendation.
- Use schema-constrained output and server validation. Require completed
  streaming responses with supported request settings. Do not silently switch
  providers or billing routes, or turn schema failure into accepted free text.
- Register Inngest handlers at `/api/inngest` in Fastify. Separate workflows
  prepare reasoning requests and process returned results. Workflow event and
  step payloads contain IDs rather than documents, prompts, or credentials.
- Persist requests before notifying devices. A registered authorized desktop
  claims a renewable expiring lease, fetches bounded context through REST,
  invokes the provider, and submits the result. SSE supplies wake-up hints;
  authenticated queries discover durable pending work.
- Use lease fencing, request deduplication, and source/mission revision checks.
  Stale or cancelled output cannot register an activatable proposal. Lost worker
  results may require another inference attempt; prevent duplicate business
  effects rather than promising exactly-once provider calls.
- Use a transactional outbox with stable delivery IDs. Add recovery processing
  for undelivered events and abandoned leases. Never hold a transaction or HTTP
  request open across inference or user review.
- Validate source references, constraint compliance, action references, and
  dependency cycles. Persist the exact validated proposal and its base revisions.
- Activation rechecks access and revisions, then atomically records approval,
  mission/plan state, checkpoints/actions/dependencies, events, audit, outbox,
  and the first attention item. Repeated activation is idempotent; outdated
  proposals require regeneration and review.
- Extend the shared versioned Zod/JSON Schema contracts from authentication for
  conversation commands, source synchronization/removal, generation and retry,
  cancellation, proposal activation, mission/draft queries, and reasoning
  claim/renew/result operations. Validate Rust and Fastify boundaries.
- Add scoped SQLite caching and queued commands with original idempotency keys.
  Reconnect reauthorizes queued work. Show waiting for device, disconnected
  provider, quota, invalid output, and synchronization states explicitly.

Revalidate volatile integration behavior before implementation. References:
[OpenAI structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs),
[ChatGPT request requirements](https://developers.openai.com/siwc/token-sharing-open-source/preview-limitations),
and [Inngest Fastify integration](https://www.inngest.com/docs/learn/serving-inngest-functions).

## Verification

Planning-session results:

- Repository, relevant code/tests, project references, and official integration
  documentation inspected; baseline working tree was clean.
- `pnpm check:docs` — passed after saving both linked plans on 2026-10-07.
- Application checks and live creation scenarios: not run; implementation has not
  started. No AI mission behavior is claimed as verified.

Provider-change session results:

- Updated the authentication dependency and configuration prerequisites to Better
  Auth. Mission behavior and implementation steps remain as planned.
- `pnpm check:docs` — passed after the provider revision on 2026-10-07.

Implementation verification — 2026-10-08:

- `pnpm verify` — passed after the final code/config changes. This covered
  formatting, lint, docs, frontend conventions, TypeScript, builds, 26 native
  tests, 42 Rust tests, and 18 server tests. It does not prove desktop
  interaction or live provider inference.
- `pnpm --filter @polar/server db:generate` — passed; Drizzle reported no schema
  changes beyond the checked-in migrations. Migrations `0002_certain_turbo.sql`
  and `0003_furry_ogun.sql` were applied to development Neon only.
- `pnpm --filter @polar/server test:integration` — passed once against
  development Neon, including real Better Auth setup, source/context persistence,
  clarification, proposal gating, stale-hash rejection, idempotent activation,
  persisted next action, and cleanup. With the local Inngest Dev Server running,
  it registered the Fastify handler and received reasoning-requested,
  reasoning-completed, and mission-activated events.
- Later combined and isolated integration reruns hit development Neon
  `ETIMEDOUT` during source persistence and cleanup. The latest isolated run
  completed sign-up, bootstrap, device registration, and empty draft creation,
  then timed out in the source transaction. These attempts failed and are not
  counted as passes; one temporary test account may need cleanup after Neon is
  available.
- Retry requested on 2026-10-08: `pnpm native:status` first showed `stopped`;
  `pnpm dev:native` then built and launched the guarded development bundle and
  status reached `ready` (native PID 258). `pnpm --filter @polar/server
  test:integration` passed all 8 integration tests against development Neon,
  including the persisted mission flow. In this retry the local Inngest endpoint
  refused dispatch; the outbox retained events and the test's authorized claim
  path completed. This verifies database/API integration and recovery behavior,
  not delivery to a running Inngest Dev Server or live workflow execution.
- In the actual desktop, Quick AI rendered and the native picker selected a
  local Markdown fixture. The dev Fastify server was not running with the native
  launcher, so it was started separately with `pnpm dev:server`. Quick AI then
  reported “Sign in to Polar before creating a mission”; Settings showed no
  Polar account session and showed ChatGPT connected with GPT-5.6-Sol selected.
  No test inference was sent. The local device-approval page opened in Chrome,
  but Chrome returned to the user's active Google Meet window while the signup
  form was being operated. No account was created and no further browser actions
  were taken. The dev app session and server were stopped after this retry.
- Thus a ready native session and provider configuration are confirmed, but the
  app has no Better Auth session for the selected workspace. Attachment sync,
  live inference, clarification/refinement, proposal review and activation,
  restart persistence, keyboard navigation, and large/800×600/narrow native
  layouts remain unverified. Do not infer a feature failure from the sign-in
  gate or claim the end-to-end flow complete.
- `POLAR_ENV=development POLAR_API_BASE_URL=http://127.0.0.1:3000
  POLAR_DESKTOP_CLIENT_ID=com.antoniopertuz.polar.desktop.development pnpm tauri
  build` — passed and produced the macOS app and DMG. This was local packaging;
  no production environment or deployment was used.
- `pnpm dev:native` reached the development app and Quick AI rendered. The native
  Markdown picker opened and accepted a local test file. Its first persistence
  attempt raced an account operation. After the Rust adjustment, the dev process
  exited and `pnpm native:status` returned `stopped`. Rebinding the exact
  `.polar-dev/Polar Dev.app` path failed with Launch Services `spawn failed`.
  Following the desktop procedure, UI retries stopped at that failure.
  Attachment persistence, live inference, clarification/refinement, activation,
  restart, keyboard review, and large/800×600/narrow window checks remain
  unverified through the actual desktop.

Required during implementation:

- Test valid extraction and visible failures: corrupt DOCX, ZIP expansion limits,
  encrypted/scanned PDFs, invalid text encoding, size limits, duplicate sources,
  and removal or revision during generation.
- Test goals requiring zero questions, one question, and multiple rounds;
  contradictory sources, corrected goals, unanswered material gaps, and explicit
  constraints. Evaluate useful checkpoints and dependency-ready next actions.
- Test invalid output, missing citations, dependency cycles, stale proposals,
  transaction rollback, repeated commands/activation, competing leases,
  cancellation, lease expiry, and late results.
- Test cross-user/workspace access denial for context, requests, claims,
  results, proposals, queries, and SSE.
- Test restart/offline recovery, response loss after commit, outbox failure and
  retry, provider disconnect/authentication/quota failure, and SSE reconnect.
- Exercise attach → clarify → review → refine → activate → persisted Home and
  Context after restart through the actual desktop app.
- Keep the creation smoke in one Quick AI session: attach context, enter the
  goal, and continue directly to clarification. Close/reopen Quick AI only as a
  separate draft-resumption check; it is not a step required to continue after
  attaching context.
- Run `pnpm verify` and relevant tests. Run `pnpm dev:native` at large, 800×600,
  and narrow layouts, including keyboard navigation, focus return, and reduced
  motion. Run `pnpm tauri build` when packaging is affected. Record skipped live
  checks and their prerequisites rather than marking them passed.

## Handoff or outcome

### Owner-reported manual acceptance — 2026-10-09

The owner reports completing the manual in-app acceptance checks for AI mission
creation and asked that this plan be treated as validated. The manual desktop
acceptance criteria are therefore recorded as owner-validated. This session did
not independently replay those scenarios; the automated and live-provider
results and limits above remain the evidence for those checks. The implementation
and acceptance work for this plan is complete.

Desktop tooling follow-up on 2026-10-08:
[capture recovery](../active/2026-10-08-desktop-capture-recovery.md) added
macOS reopen restoration and executable window raising with finite capture
recovery. The development app remains ready at native PID 38742 with the
original Vite/launcher session. Follow the updated Verification procedure for
the remaining feature checks; tooling checks do not establish mission creation,
provider inference, or workflow delivery.

This plan is complete. The capture investigation remains a separate active plan;
its tooling findings do not reopen mission acceptance.

No separate change spec is needed while this plan and the confirmed decisions
define the increment. If implementation reveals consequential behavior or
compatibility ambiguity, clarify it and add a linked spec when needed. Record
proposed durable changes to the owner-maintained product, architecture, and design
references here; do not edit those references without an explicit request.

The capture investigation was reopened after the same -3811 recurred. Its first
helper incorrectly treated AX as capture-free and allowed raw actions outside
failure accounting. The corrected guarded helper and actual 800×600-point resize
were exercised at unchanged native PID 38742; full verification passed. Initial
binding/cross-Space capture still depends on the external service and is not
claimed fixed. This mission plan's native acceptance checks remain unresolved.

## Error investigation — 2026-10-09

User requested a report on the mission conversation screenshot showing both
provider failure banners. Code inspection confirms that the native worker maps
HTTP send and response-stream read failures to `network`, reports the attempt
to the server failure endpoint, and returns the local provider message. The
server persists a generic failure message, explaining the two banners for one
attempt. The shared provider HTTP client has a 10-second connect timeout and a
45-second total request timeout, including streaming; a longer inference can
therefore produce the same message as a transport failure. The underlying
reqwest error is discarded, and the worker logs only request ID, stage, and
normalized code. No attempt-specific trace was obtained, so timeout is a
candidate cause, not a confirmed diagnosis. No application code was changed or
live inference retried. Next action: correlate the failing attempt with elapsed
time and add safe transport/timeout diagnostics before choosing a fix; continue
the outstanding native acceptance checks separately.

### Timeout extension — 2026-10-09

User authorized extending the timeout. Acceptance criteria for this adjustment:
mission inference permits up to 180 seconds including response streaming; account
and connection operations retain their existing limits; the server worker lease
lasts 240 seconds so inference can finish and submit its result; required checks
are run and live verification limits are reported. Implemented the per-request
override and matching lease extension. Verification: `pnpm verify` passed formatting, lint, docs, frontend checks,
TypeScript, launcher/environment tests, builds, 28 native tests, and Rust
compilation. Its Rust test step hit sandbox restrictions binding local test
servers (43 passed, 2 failed), so the aggregate command did not pass.
`pnpm test:rust` rerun outside the sandbox passed all 45 tests; the separately
run `pnpm --filter @polar/server test` passed all 21 tests. Native status
confirmed the watcher rebuilt to ready PID 2970. No live mission inference or
success/failure desktop command review was performed; the timeout hypothesis
remains unconfirmed. Next action: retry the saved mission in the rebuilt desktop
with the updated server and observe whether it finishes within three minutes.
The active plan retains its outstanding live acceptance checks.

### Draft review button contrast — 2026-10-09

The user's screenshot showed the draft review buttons with light native button
backgrounds and inherited light text, leaving both labels unreadable. Added
explicit dark-window styles for the refine button and a light primary style for
activation, using the documented design tokens. `pnpm verify` reached the Rust
tests after formatting, lint, docs, frontend checks, builds, and 28 native tests
passed; two Rust tests could not bind local test servers in the sandbox. The
required elevated `pnpm test:rust` rerun passed all 45 tests, and
`pnpm --filter @polar/server test` passed all 21 tests. The development app was
ready at PID 2970 and its accessibility tree exposed both draft button labels,
but the desktop review helper's app binding was rejected by Computer Use, so a
visual desktop confirmation remains unverified. Next action: review the rebuilt
draft window visually when Computer Use can access Polar Dev, then continue the
separate live mission acceptance checks described above.

### Context-specific mission output — 2026-10-09

User requested a one-line outcome below the countdown, a short red-box message,
and readable Plan content instead of dense paragraphs. Acceptance criteria for
this adjustment: generation instructions explicitly match each destination;
outcome targets one sentence within 12 words/90 characters; recommendation and
assessment have separate compact budgets; Plan uses short headings and focused
entries in the existing structured arrays; critical scope and approval gates
remain in the appropriate fields. Keep the outcome readable at narrow sizes by
allowing natural wrapping rather than hiding content.

Implemented a separate output-guidelines prompt resource appended to the existing
interpreter/planner instructions for creation and refinement. No extra inference
call is needed. Removed the hero's 40-character width constraint so a short
outcome can use the available window width. Existing saved proposals are not
rewritten; refinement/regeneration uses the new instructions. Prompt budgets are
generation guidance, not new persistence limits. Verification pending. Next
action: run required checks and inspect desktop availability; live generated
wording still requires a new inference to assess.

Verification for output formatting: `pnpm verify` passed formatting, lint, docs,
frontend conventions, TypeScript, builds, 28 native tests, and Rust compilation;
its Rust test step failed on two sandbox-denied local server binds (43 passed).
`pnpm test:rust` outside the sandbox passed all 45 Rust tests, and
`pnpm --filter @polar/server test` passed all 21 server tests. These checks do not
prove model compliance with the new writing guidance.

Desktop status reached ready PID 28337 at
`.polar-dev/Polar Dev.app`. Initial app binding and the guarded helper observed
the existing saved conversation. Review plan click entered recovery-required;
the single recovery then blocked with: "The user changed
'/Users/antoniopertuz/Documents/work/personal/polar/.polar-dev/Polar Dev.app'.
Re-query the latest state with `get_app_state` before sending more actions."
Helper evidence: failedOperation recoverCapture, captureState blocked,
recoveryUsed true, bindingRefreshes 0. No action was replayed. Visual review,
window-size checks, and generated-text evaluation remain unverified. Next action:
refine/regenerate a proposal using the rebuilt provider to evaluate compact
output, then inspect Overview and Plan when desktop control is available.
The overall mission plan remains active for its outstanding acceptance checks.

### Plan readability follow-up — 2026-10-09

User authorized the renderer change after observing that the existing draft still
used dense action rows. Acceptance criteria: action headings appear above their
details; detail points form readable lists; dependency titles appear beneath the
details without a narrow side column; existing drafts benefit without requiring
regeneration; content is preserved and narrow layouts avoid overflow. Resume this
plan. Use a presentation-only detail parser for sentence boundaries and explicit
bullet lines, retaining the current string contract and stored content. Update
the generation guidance to request focused bullet lines for Plan details.
Verification pending; next action: implement the focused renderer/styles/parser
change and run required checks.

Implemented PlanDetail and a sentence/bullet presentation utility without changing
stored content or the shared contract. Scoped checkpoint flex rules to direct
children: the previous descendant selectors forced action headings, details, and
dependencies into columns. Actions now have h4 headings, semantic bullet lists,
and a separate dependency list beneath. New generation guidance requests 1–3
focused bullet lines for checkpoint/action details. Added the Intl declaration
library reference after TypeScript exposed the missing Segmenter declaration.

Verification: the initial `pnpm verify` stopped at that declaration error; after
the correction, it passed formatting, lint, docs, frontend checks, TypeScript,
builds, 28 native tests, and Rust compilation, then failed on the two existing
sandbox-denied Rust test server binds (43 passed). `pnpm test:rust` outside the
sandbox passed all 45 tests. `pnpm --filter @polar/server test` passed all 21.
Direct Node assertions passed for existing sentence prose, explicit bullet lines,
decimal values, and empty detail.

At rebuilt native PID 36205, the guarded desktop review opened the saved proposal,
selected Plan, and captured the actual large desktop. The existing draft showed
action headings above sentence bullets, with dependencies underneath; scrolling
confirmed the privacy and success-metrics actions retained their gates and dates.
No inference or activation was performed. Narrow/800×600 window checks and live
model compliance remain unverified. Next action: check those sizes when needed
and evaluate the next refined/generated proposal; the broader mission plan
remains active for its outstanding acceptance checks.

### Restore Plan depth and hierarchy — 2026-10-09

User clarified that Plan content was already good and needed formatting only;
the generated bullet points lost too much detail. Acceptance criteria: retain
short Overview budgets; remove editorial word/count budgets from Plan details;
preserve operational requirements during refinement; visibly label Checkpoint N
and Action N.M, with actions grouped under their checkpoint. Implemented the
prompt correction and explicit UI labels/indentation, including removal of an
existing generated checkpoint prefix to avoid duplicate numbering. Stored
summarized proposals cannot recover omitted detail through presentation alone.
Verification pending. Next action: run required checks and inspect the rebuilt
hierarchy; regenerate using source context to recover lost detail.

Verification for depth/hierarchy correction: `pnpm verify` passed formatting,
lint, docs, frontend checks, TypeScript, builds, native tests, and Rust compilation;
Rust tests again failed on two sandbox-denied server binds (43 passed).
`pnpm test:rust` outside the sandbox passed all 45 tests;
`pnpm --filter @polar/server test` passed all 21 tests. Desktop status was ready
at rebuilt PID 53429. The guarded helper bound the standard window but returned
only OS chrome on initial and subsequent observation; the changed hierarchy was
not visible, so desktop appearance and narrow sizes remain unverified. No live
inference was sent. Next action: refine the saved proposal to restore detailed
Plan requirements from earlier context while preserving compact Overview, then
review Checkpoint N / Action N.M hierarchy. Overall acceptance remains active.
