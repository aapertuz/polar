# Workspace knowledge and mission context

Status: Complete — implementation and owner-reported manual acceptance checks complete
Owner: Codex
Created: 2026-10-08
Builds on: [AI mission creation](2026-10-07-ai-mission-creation.md)

## Goal and acceptance criteria

Give Polar reusable workspace knowledge, such as company background, while keeping
Quick AI's conversation and attachments specific to the mission being created.
The reasoning input combines authorized workspace background with the mission's
own goal, documents, and conversation.

### Confirmed requirements and agreed direction

- Workspace context can describe a company: its business, products, customers,
  team, policies, and constraints.
- Users can add workspace documents and notes independently of creating a mission.
- Quick AI context belongs to the mission itself. Uploading a document there must
  not silently publish it to the workspace knowledge library.
- Workspace knowledge is reusable across missions and available automatically
  during mission interpretation and planning.
- The first version has an editable workspace brief and a document/note library,
  plus visible provenance in Quick AI and the mission Context view.
- Preserve the existing storage decision: original documents stay local and
  extracted text synchronizes to Neon Postgres.
- Source changes affect future reasoning and pending review, without silently
  rewriting activated plans.
- Save this implementation plan and provide a prompt for a later Luna session.
  This was completed in the planning session; the later execution instruction
  supersedes the original planning-only scope.

### Acceptance criteria

- An authenticated user can open Workspace context from the workspace launcher,
  including when no mission exists, save a brief, add notes/documents, inspect
  extracted text, replace a source, and remove it from future context.
- Workspace knowledge persists across app restart and is shared only with members
  of its owning workspace. Local original files are not required to read the
  synchronized extracted text on another authorized device.
- Creating a mission uses relevant workspace context without reattaching company
  documents. With an empty workspace library, existing mission creation still
  works.
- Quick AI clearly distinguishes inherited workspace knowledge from removable
  mission attachments. It can explain which excerpts were supplied to a run and
  which sources a proposed plan cites.
- Polar avoids questions already answered by supplied context, labels missing
  facts/assumptions, and asks about consequential conflicts instead of silently
  overriding a company constraint.
- Every new reasoning request/proposal records scoped source identities,
  revisions, and the workspace-context revision used. A changed or removed source
  cannot authorize a late result or outdated activation.
- Activated missions retain their approved content and historical source
  provenance. Later workspace edits do not imply an automatic replan.
- Existing mission attachments keep their ownership and meaning; no migration
  turns them into shared workspace documents.

Outside this increment: broad workspace management/invitations, cross-workspace
retrieval, personal knowledge sharing, semantic/vector search, OCR, cloud binary
uploads, autonomous knowledge promotion, scheduled observation, and replanning
activated missions. A manual copy/promotion UI from mission to workspace is also
deferred; users can explicitly add the same source through Workspace context.

## Context

Inspection on 2026-10-08 established:

- `server/src/db/schema.ts` defines `mission_source` with a required draft ID,
  extracted text, hash, filename, and provenance. There is no workspace knowledge
  table or workspace brief.
- `server/src/missions.ts` assembles reasoning input from a draft goal,
  conversation, and its own sources. Proposal hashes currently describe candidate
  plan content; workspace/source manifest checks need to be added.
- `native/src-tauri/src/mission_context.rs` already provides a native picker and
  bounded PDF, DOCX, Markdown, and text extraction. Reuse its parsing without
  making workspace imports create mission drafts.
- Quick AI stores and synchronizes mission-specific sources. Mission Context and
  the Documents overlay currently expose mission data, not workspace knowledge.
- Workspace launcher composition differs when no mission is selected. The
  populated launcher still contains fixture content; wire the new workspace
  entry through both paths without expanding into an unrelated launcher redesign.
- Better Auth and workspace/device access are implemented. The AI creation plan
  reports implementation complete but acceptance verification still active.
  Do not repeat that implementation or mark its remaining checks complete here.
- The working tree contains substantial application changes from other sessions.
  Preserve them and establish a fresh baseline before editing.

Read [AGENTS.md](../../../AGENTS.md), [Product](../../PRODUCT.md),
[Architecture](../../../ARCHITECTURE.md), [Design](../../DESIGN.md),
[Frontend conventions](../../FRONTEND.md), [Authentication](../../AUTHENTICATION.md),
[Provider connections](../../PROVIDER-CONNECTIONS.md), and
[Verification](../../VERIFICATION.md). Current code determines what exists;
architecture target paths do not require a broad restructuring of implemented code.

## Steps and progress

- [x] Inspect workspace access, mission sources, extraction, reasoning payloads,
      proposal acceptance, and existing desktop entry points.
- [x] Separate workspace knowledge from mission context and record the agreed
      behavior, implementation proposals, verification, and handoff.
- [x] Save this follow-on plan without changing application behavior.
- [x] Establish the implementation baseline and preserve pre-existing uncommitted work.
- [x] Add shared contracts, migrations,
      workspace knowledge persistence, and authorization.
- [x] Reuse native extraction and add workspace-specific authenticated IPC and
      source-management behavior.
- [x] Implement the workspace brief/library UI in empty and populated workspaces.
- [x] Add bounded context assembly, scoped manifests, source citation contracts,
      and source-aware stale-result/activation checks.
- [x] Wire inherited workspace context into Quick AI and provenance into proposed
      and activated mission Context views.
- [x] Run deterministic and development integration checks; record results and
      supporting feature documentation.
- [x] Complete actual desktop acceptance checks (owner-reported manual
      validation; see final verification entry below).

## Decisions and discoveries

### Implementation baseline — 2026-10-08

- Confirmed the working tree already contains substantial uncommitted mission
  creation, Better Auth, provider, server, and contract changes. These predate
  workspace-context edits and are being preserved.
- Existing implementation is concentrated in `server/src/missions.ts`,
  `server/src/db/schema.ts`, `native/src-tauri/src/mission_api.rs`,
  `native/src-tauri/src/mission_context.rs`, Quick AI, and Home's overlay registry.
  There is no workspace-context API or UI yet.
- Current reasoning snapshots contain only mission messages and mission sources;
  proposals and activation do not carry workspace source revisions. This is the
  implementation gap addressed here.

### Explicit user requirements and accepted direction — 2026-10-08

Workspace/company context is separate from mission context. The user accepted the
two-scope solution and requested its implementation plan, rather than revising or
reimplementing the existing creation flow. Original-local/extracted-cloud storage
and Inngest/local-provider boundaries remain in force.

### Decisions supported by project references

- Workspace-derived context must be audience-filtered before inference, including
  explanations and provenance. Membership in several workspaces does not permit
  transferring their contents between missions.
- Postgres owns shared reality; model output remains a validated proposal. Use
  relational records, events, and the existing transaction/outbox infrastructure.
- Rust owns native file access, credential handling, and provider execution.
  React composes presentation through typed IPC.
- Context changes require source/access revision checks; approval belongs to exact
  reviewed content. Do not hold transactions over inference or user review.
- Preserve Polar's desktop windows, tokens, calm hierarchy, keyboard behavior,
  and reduced-motion policy.

### Agent proposals — concrete implementation defaults

These choices implement the accepted direction but were not individually selected
by the user. Keep them labeled when updating this plan; clarify a material
behavior/compatibility change before deviating.

#### Workspace brief and knowledge library

- Add a Workspace context entry to the existing workspace launcher, accessible
  with or without an active mission. Use an existing Dialog work surface and a
  dedicated feature/master hook, composed by Home through its overlay registry.
- Show the workspace name, an editable plain-text brief, and a flat list of
  documents/notes. Use explicit Save brief, Add document, and Add notes actions.
  Avoid required company-profile forms, automatic AI summaries, and extra tabs.
- The brief can describe customers, products, staffing, policies, and constraints;
  it is optional. An empty library never blocks mission creation.
- Source rows show title, type, update time, and extraction/synchronization state.
  Provide a text preview, Replace document/Edit note, and Remove from context.
  Use the latter wording because removal archives a source; it does not claim
  physical erasure of historical plan records or user files.
- Explain before saving that workspace members can use synchronized text and that
  original files remain on the device. Preserve failed/unsaved local input for
  retry and distinguish it from successfully synchronized knowledge.
- For v1, active members read workspace knowledge; the workspace owner manages
  it. Enforce this on the server, not only by hiding controls. Team contribution
  roles and new sharing permissions are deferred.

#### Storage, contracts, and import reuse

- Add a workspace-context record containing the brief and monotonically increasing
  revision, and workspace-owned sources containing ID, kind, title, extracted
  text, content hash, source revision, creator/updater, timestamps, and archived
  state. Sources remain distinct from `mission_source`.
- Replace a source in place by increasing its revision. Archive it for future
  retrieval rather than rewriting historical references. Deduplicate active
  uploads by workspace and content hash; the same document may independently
  belong to a workspace and a mission.
- Add versioned Zod contracts and corresponding validated Rust serialization for
  workspace context read/save, source add/detail/replace/archive, and manifests.
  Use existing authenticated transport and checked workspace selection.
- Suggested REST surface: `GET /api/app/workspace-context`,
  `PUT /api/app/workspace-context/brief`, `POST /api/app/workspace-context/sources`,
  and source detail/replace/archive at
  `/api/app/workspace-context/sources/:sourceId`. Ownership is resolved through
  current membership and the verified workspace header, never trusted from a body.
- Mutations carry expected revisions and stable idempotency keys. Reject stale
  edits with a refresh/review conflict. Repeated commands return their previous
  outcome; a reused key with different content fails.
- Share extraction utilities behind separate workspace and mission IPC wrappers.
  Preserve supported formats and current bounds: 10 files per picker invocation,
  20 MiB per file, 1 MiB extracted text, bounded DOCX expansion. Add a configurable
  v1 library limit of 50 active sources and an 8,000-character brief; pasted notes
  retain the existing 100,000-character bound. Validate again on the server.
- Commit knowledge changes, revision bumps, relevant domain events, and outbox
  entries together. Envelopes carry IDs/revisions, not raw company text or paths.
- Keep existing Better Auth, Neon project/environment guards, Drizzle migrations,
  Fastify hosting, and local ChatGPT execution. Use direct development connections
  for migrations and pooled connections for application traffic. Do not provision
  another project, enable Managed Neon Auth, or introduce an AI gateway/storage
  service for this feature.

#### Context assembly and reasoning

- Put shared context assembly in a focused application service with authorized
  read ports. Existing mission handlers and Inngest orchestration call it; do not
  duplicate domain rules in HTTP or workflows or broadly refactor unrelated code.
- Build distinct sections for workspace brief/background, mission brief and
  conversation, mission attachments, and any current candidate plan. Keep source
  IDs, scopes, revisions, hashes, and stable excerpt IDs with the supplied text.
- Retrieve only active sources from the execution workspace. Start with bounded
  deterministic lexical relevance using the goal and recent conversation, with
  stable paragraph chunks and a documented deterministic tie-breaker. No vectors
  or model-generated knowledge summaries are required.
- Proposed configurable document-input allocation: 8,000 characters for the
  brief, 64,000 for workspace excerpts, and 128,000 for mission excerpts. Preserve
  the existing separate 60,000-character conversation bound. Unused document
  budget may be borrowed by the other scope after each scope's initial selection.
  Chunk size is capped at 4,000 characters. Record partial/excluded coverage;
  never label all uploaded documents as fully read when only excerpts were sent.
- A context manifest records schema version, workspace/context revision, audience,
  requesting user, source identities/revisions/hashes, included excerpt IDs, and
  omitted coverage. Persist it with the reasoning request and proposal. Workflow
  payloads stay identifier-only; the authorized desktop fetches actual context.
- Extend the strict provider output contract with source/excerpt references and
  validate every returned reference against that request's manifest. Update Rust's
  provider JSON Schema and server/client contracts together. Distinguish sources
  supplied to the model from sources cited by its output; presence in a prompt is
  not proof the model relied on a document.
- Instruct Polar to use supplied company background before asking redundant
  questions, preserve mission-specific clarification without a fixed count, and
  surface consequential conflicts. General company guidance may be narrowed by
  the mission; an explicit company constraint must not be silently contradicted.
  Company text cannot change system permissions or authorize execution.

#### Source changes, review, and compatibility

- Use the workspace-context revision as a conservative v1 invalidation boundary:
  any brief/source change invalidates unfinished reasoning and review proposals
  built from an older workspace snapshot. This may invalidate an otherwise
  unaffected proposal; selective invalidation can follow later.
- Recheck current membership, workspace-context revision, and mission-source
  hashes before claim, result acceptance, retry, and activation. Lock the same
  workspace-context record in mutation and acceptance/activation transactions so
  a source edit cannot race a supposedly current commit. Recheck authorization
  inside these operations as well as at the route boundary.
- Cancel/fence stale pending leases, supersede pending proposals, and show
  Workspace context changed — refresh the plan. Regeneration is an explicit user
  action in this increment, without silently starting new billed inference.
- Preserve conversations and mission attachments through invalidation. A new
  mission message or Refresh plan builds a current authorized snapshot.
- Preserve source/manifests with activated mission provenance. Show historical
  source version/hash/title and indicate when the source has since changed or
  been removed from current context. Do not represent current source text as the
  older text used to approve a plan.
- Existing activated missions keep their content. Existing pending requests and
  proposals without the new manifest cannot activate after the new protocol is
  deployed: cancel/supersede them and require regeneration with an explanation.
  Do not backfill invented company context or convert historical mission sources.
- Quick AI keeps mission attachment controls and adds one quiet clickable line,
  such as Using Acme workspace context. Its details show actual per-run coverage.
  The mission Context tab distinguishes Workspace sources from Mission sources.
  Without workspace knowledge, show a quiet empty state rather than imply company
  understanding. Navigating to workspace context must preserve the mission draft.

## Verification

Planning-session evidence:

- Inspected implemented source ownership, import utilities, reasoning input,
  proposal validation/activation, workspace access, and desktop entry points.
- Existing working-tree application changes were preserved. No implementation,
  migration, database operation, or live inference was performed in this session.
- `pnpm check:docs` — passed on 2026-10-08 after saving this plan.

Implementation progress and verification — 2026-10-08:

- Added workspace-context REST routes, contracts, relational tables and migration,
  native file import/IPC, empty and populated launcher entry points, editable
  owner surface/read-only member surface, bounded deterministic retrieval,
  scoped manifests/citations, stale reasoning/proposal fencing, and historical
  provenance. Supporting behavior is documented in
  [Workspace context](../../WORKSPACE-CONTEXT.md).
- Applied `0004_curved_umar.sql` to the development database only. No production
  database was changed and no deployment or commit was made.
- `pnpm verify` — passed, including formatting, lint, docs/frontend checks,
  builds, native and server tests, and Rust checks/tests.
- `pnpm --filter @polar/server test:integration` — passed, 8 tests. The focused
  workspace scenario covered empty context, brief/note setup, inheritance across
  missions, mission-only attachments, updated-source staleness, refresh, archive,
  and historical provenance. `pnpm --filter @polar/server test` passed 21 tests;
  `pnpm --filter @polar/native test` passed 26 tests. Rust tests passed 42/42.
- Development integration exercised authenticated APIs and context assembly,
  not a connected ChatGPT inference. Live model quality, Inngest delivery, and
  the full mutation race matrix remain unverified.
- Desktop procedure: `pnpm native:status` reported `ready`; exact target was
  `/Users/antoniopertuz/Documents/work/personal/polar/.polar-dev/Polar Dev.app`
  with native PID 70219. Bound that exact app and opened Workspace context from
  Quick AI in an empty workspace; the read-only member state rendered. On a
  later capture while closing the dialog, automation returned
  `SCStreamErrorDomain Code -3811`. Following the one permitted recovery,
  `pnpm native:status` still reported `ready` for the same app/PID and rebinding
  the exact path returned the same capture error. Native UI automation stopped
  at that point as required by Verification. The current app account is a member,
  so owner editing was unavailable even before the capture failure.
- Still unverified on desktop: owner brief/document/note edits and native picker,
  restart persistence, inherited context across two actual missions, mission-only
  upload isolation, source-update/stale-proposal behavior in the window, keyboard
  traversal beyond Escape dismissal, large/narrow layouts, and compact-size
  reachability. Initial empty-state rendering was observed as a member; the retry
  later showed owner controls. No alternate capture method was used.
- Retry after a relevant native rebuild — 2026-10-08: `pnpm native:status`
  reported `ready` with native PID 38742 and the exact development app path above.
  Rebinding succeeded. The workspace context surface was reachable before a
  mission existed and displayed owner controls for Personal workspace. Escape
  dismissed it and focus returned to the inherited-context control. Resizing to
  800x600 succeeded and the captured window showed the workspace surface clipped
  vertically; compact-size reachability is therefore not verified. The first
  post-resize capture failure recovered through status/rebind and showed the
  surface. A subsequent brief-entry/save attempt returned
  `SCStreamErrorDomain Code -3811` after that recovery had already been used.
  Whether the brief save reached the server is unconfirmed. Native UI automation
  stopped; no further rebind or capture was attempted. Document picker, restart,
  multi-mission inheritance, mission-only uploads, source update/stale proposal,
  large/narrow sizes, and restoring/confirming the brief remain unverified.
- Explicit user retry — 2026-10-08: after reading the updated Verification
  procedure, recorded the user's authorization and fresh `ready` status with the
  same PID 38742, then made one exact-path bind and combined AX/screenshot
  observation. Capture succeeded. It displayed the workspace brief field with
  the temporary verification text and owner controls. Without saving again, I
  closed the surface and reopened it through Quick AI. The resulting current
  workspace view was read-only (`Your workspace`; owners manage shared context),
  with no shared sources, so the role/workspace needed for owner verification is
  not established and the brief's persisted value cannot be confirmed there.
  No prior edits or Save action were replayed. Native file picker, confirmed
  persistence/restart, and owner mission flows remain unverified.
- Mutations use stable source IDs for add retries and the target plus expected
  revision as the retry identity for brief, replace, and archive. A repeated
  command returns the committed result only when its complete content matches;
  different content on the same expected revision conflicts. Integration tests
  cover these retry and conflict outcomes. No separate idempotency ledger is
  needed for these revision-guarded commands.
- After the retry changes, `pnpm verify` passed with local socket access. The
  first sandboxed run failed only because two Rust tests could not bind local
  sockets (`PermissionDenied`); the approved rerun passed. The first sandboxed
  integration run could not resolve the development Neon hostname; the approved
  development-only rerun passed all 8 tests.
- Acceptance follow-up — 2026-10-08: a fresh guarded review of the exact
  development app (PID 38742) loaded the owner view for Personal workspace with
  the saved 71-character temporary verification brief and no active sources.
  This confirms the brief was returned in the current owner view; no app restart
  was performed. Added a disposable note through the UI, inspected its extracted
  text, archived it, and confirmed the active source count returned to zero.
  Scrolling reached the note controls and Done at the large window size.
- The native Add document action opened the macOS file picker, but the guarded
  observation failed during `getAXState` while the picker sheet was active.
  The returned helper error did not include the underlying capture cause, and it
  was not retained before the recovery attempt. Fresh `pnpm native:status`
  remained `ready` for the same app path
  and PID 38742. The single `review.recoverCapture(nativeStatus)` attempt then
  stopped because the helper could not find a standard window with its Raise
  action while the picker sheet was active (`Expected one discoverable standard
  window with the documented Raise action.`). `review.evidence` records
  `captureState: blocked`, `recoveryUsed: true`, `failedOperation:
  recoverCapture`, and `bindingRefreshes: 0`. The picker action had already
  opened the sheet; no file was selected or uploaded, and the Add document action
  was not replayed. Native UI actions and observations are stopped for this
  review session as required by Verification.
- `pnpm verify` — passed on the current working tree, including formatting,
  lint, docs, frontend checks, both builds, 26 native tests, 42 Rust tests, and
  21 server tests. Its initial sandboxed run stopped at two Rust loopback tests
  with `PermissionDenied`; the approved rerun passed.
- `pnpm --filter @polar/server test:integration` — passed, 8 tests, against
  development Neon. The sandboxed attempt failed DNS resolution for the
  configured development host; the approved development-only rerun passed.
- Restart persistence, native document extraction/import, two real missions
  inheriting workspace context, mission attachment isolation in the window,
  pending-proposal invalidation in the window, and live provider/worker behavior
  remain unverified. Integration and deterministic tests cover server contracts
  and context assembly, not live ChatGPT quality or delivery. The current review
  did not establish 800×600-point reachability; the earlier size claim remains
  superseded by the capture investigation correction below.
- User-reported upload failure — 2026-10-08: the Workspace context surface showed
  `Request body is too large` after a document was selected. The server had a
  global 32 KiB Fastify body limit while the native extractor and contracts allow
  up to 1 MiB of extracted text. Added a bounded 6 MiB per-route limit to
  workspace source add/replace and mission source add; the default 32 KiB cap
  remains for other routes. The larger allowance accounts for worst-case JSON
  escaping of the validated text. Added development integration coverage for
  workspace document add, replacement, removal, and mission attachment requests
  above 32 KiB. `pnpm --filter @polar/server test:integration` passed all 8
  tests after this change. The native picker upload has not yet been retried in
  the desktop app. `pnpm verify` also passed on the final working tree; the
  sandboxed run hit the known Rust loopback `PermissionDenied` errors, and the
  approved rerun passed.
- User-reported brief-save feedback gap — 2026-10-08: clicking Save brief had no
  visible confirmation. Added a polite live status, “Brief saved.”, after the
  save command succeeds; editing the text clears the status. This is distinct
  from failure feedback and does not claim success when the save command fails.
  `pnpm verify` passed after the change (26 native, 42 Rust, and 21 server
  tests, plus docs, formatting, lint, type checks, and builds). The first run's
  two Rust loopback tests hit sandbox `PermissionDenied`; the approved rerun
  passed. Visual confirmation in the desktop app remains part of the active
  acceptance checks.

Required implementation checks:

- Database/API: owner writes/member reads, non-member denial, cross-workspace IDs,
  concurrent edits, idempotency, replacement/archive/deduplication, quota errors,
  and atomic state/revision/event/outbox rollback.
- Native import: existing supported extraction and failure cases plus workspace
  imports that never create a mission draft or expose local paths/credentials.
- Context: empty workspace, brief-only workspace, relevant/unrelated documents,
  mission/workspace budget fairness, oversized/partial coverage, deterministic
  selection, scope/source citation validation, and no cross-workspace leakage.
- Evaluation: supplied company facts prevent redundant questions; conflicting
  mission/company constraints produce clarification; injected source instructions
  cannot alter policy. Model fixtures are deterministic tests, not evidence of
  live reasoning quality; separately record a consented live example.
- Concurrency: source edits before claim, during inference, before result commit,
  and during activation; late leases/results; revoked membership; outdated client
  manifests; same payload retried; and activation without a manifest.
- Compatibility: existing mission-only creation, unchanged activated missions,
  source provenance after archive/replacement, and pre-migration draft recovery.
- Actual desktop: add a company brief/document in an empty workspace; restart;
  create two missions using inherited context without reuploading; attach a
  mission-only document; inspect supplied/cited sources; refine and activate;
  replace company context while another plan is pending; regenerate and review.
- Exercise loading/failure/retry, keyboard focus and return, draft preservation
  when switching surfaces, reduced motion, and large/800×600/narrow layouts.
- Run `pnpm verify` and meaningful new regression tests. Generate/review migrations
  and run `pnpm --filter @polar/server test:integration` against development only.
  Use [the desktop verification procedure](../../VERIFICATION.md#desktop-verification-procedure),
  including `pnpm native:status`, and stop/recover exactly as it documents. Run
  `pnpm tauri build` when packaging is affected. Verify Inngest delivery with its
  development server; a successful direct claim test alone does not prove delivery.
- Report actual commands, results, and remaining live checks. Never treat skipped
  checks or a source-extraction test as end-to-end verification.

## Handoff or outcome

### Owner-reported manual acceptance — 2026-10-09

The owner reports completing the manual in-app acceptance checks for workspace
context and asked that this plan be treated as validated. The manual desktop
acceptance criteria are therefore recorded as owner-validated. This session did
not independently replay those scenarios; prior automated and development
integration results and their stated limits remain the recorded evidence. The
implementation and acceptance work for this plan is complete.

The subsequent
[capture recovery investigation](../active/2026-10-08-desktop-capture-recovery.md)
found failed window/display lookup rather than establishing a permission denial,
added native reopen restoration and a raise-before-capture helper, and verified
minimized/hidden restoration plus dialog close/capture. Current development
native PID is 38742; the original Vite/launcher session remains running. This
Earlier reviews established
the owner workspace and confirmed the saved brief is returned in its current
view; note add, text inspection, and archive also passed. The user then reported
the large-document request rejection, which is fixed and covered by development
integration tests. Next, retry native document import in the development app
after its server reload, then continue the remaining mission flows at the
These earlier capture and environment limitations are retained as history; the
owner's subsequent manual acceptance report closes this feature plan.

This plan is complete. The capture investigation remains a separate active plan.

### Capture investigation correction — 2026-10-08

The resumed capture investigation confirmed that the 14:45 resize left the main
window at **401×301 points**, with an 802×602-pixel image on a 2× display. The
previous claimed 800×600 result is superseded; it did not establish that size's
layout behavior. The failed session used raw app calls instead of the helper,
and batched edit/Save without an intervening observation. The brief is currently
visible in the editor; its committed state remains unconfirmed.

The corrected guarded helper ran successfully at the same native PID 38742:
Raise before subsequent AX/combined observations, native Zoom, verified actual
800×600-point resize, brief setValue to its existing value, input click, and
restoration to the large size. No Save or data change was performed. These checks
verify automation ordering, not persistence or complete compact reachability.
The capture investigation remains active pending the external failure boundary;
resume feature acceptance using the guarded helper and fresh status.
