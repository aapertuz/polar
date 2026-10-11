# Evidence, action conversations, and adaptive mission plans

Status: Active (implementation in progress)
Owner: Codex
Created: 2026-10-10

## Goal and acceptance criteria

Extend Polar's action detail window and reasoning workflow so evidence and team
conversations continuously update the mission. An action remains incomplete until
Polar finds sufficient evidence against its completion criteria. Clear human
conclusions can count as evidence. Polar asks questions when information is
incomplete, reassesses progress, updates routine planning details automatically,
and proposes consequential changes for review.

External integrations and external tool execution are outside scope.

- [x] Each action has completion criteria and a durable conversation; written
      results use the conversation, while links and supported documents use
      dedicated evidence submission paths (no separate evidence text field).
- [x] Human conversation participation and evidence submission require both
      current workspace authorization and membership in that particular action.
      Enforce both conditions in the UI and server; ownership alone does not
      bypass action membership for these operations.
- [x] Evidence is evaluated before completion; unsupported or conflicting claims
      lead to questions, and the action update API cannot bypass evidence.
- [x] Explicit conclusions from action members can support completion without a
      separate evidence-promotion step; tentative discussion and Polar's own
      statements cannot prove completion.
- [ ] Evidence and conversation changes trigger outcome-based reassessment and
      explained, minimal plan changes with appropriate automatic/reviewed application.
- [ ] Routine changes apply automatically; structural changes, completion-criteria
      changes, mission-deadline changes, and material intent changes require review.
- [x] Replanning preserves stable identities, history, assignments, and completed
      work; archived work retains its evidence and conversation.
- [x] Next actions honor satisfied dependencies and current priorities, dates,
      and blockers; mission success is assessed against outcomes rather than task counts.
- [ ] Timed follow-ups and background reasoning work with Quick AI closed while
      the desktop is running and authenticated, and recover safely from interruption.
- [ ] Mission surfaces display persisted assessments, activity, attention, and
      reasons for changes; evidence and conversations persist across restarts.
- [ ] Migration compatibility, authorization, concurrency, failure recovery,
      model behavior, and native UX are verified and accurately reported.

## Context

Read [Product](../../PRODUCT.md), [Architecture](../../../ARCHITECTURE.md),
[Design](../../DESIGN.md), [Frontend conventions](../../FRONTEND.md), and
[Verification](../../VERIFICATION.md) before implementation. The owner-maintained
Product, Architecture, and Design references must not be edited without explicit
authorization. Record proposed durable updates in this plan or the final report.

The existing [capture-recovery plan](2026-10-08-desktop-capture-recovery.md) covers
separate verification tooling work. Preserve it and follow its recovery limits
when performing native checks; it is not the implementation plan for this feature.

Baseline confirmed by source inspection on 2026-10-10:

- `native/src/features/missions/components/ActionDetail.tsx` provides editable
  dates, priorities, assignments, context attachments, and a direct completion toggle.
- `server/src/missions.ts` handles creation, activation, manual action updates,
  reasoning requests, and regeneration. Active-mission regeneration deletes and
  recreates action records; this must preserve history before conversations exist.
- `server/src/db/schema.ts` has mission/action records and `missionActionMember`,
  which is the current action-membership relation. Reuse it for participation checks.
- `packages/contracts/src/index.js` and `index.d.ts` define shared runtime/type
  contracts, including the existing direct action completion update.
- `native/src-tauri/src/providers/openai.rs` implements interpretation/planning
  followed by a separate scheduling request. Keep the local provider boundary.
- `native/src/features/quick-ai/hooks/useQuickAi.ts` polls and invokes the worker
  only while Quick AI is visible. Background execution needs a broader lifecycle.
- Persisted checkpoints currently render as Upcoming, and notification content
  includes a sample. Replace these projections with actual assessments/attention.
- Working tree was clean at handoff preparation. Reinspect it in the new session
  and preserve any subsequent unrelated work. Completed plans are historical context.

This plan is self-contained. At implementation kickoff, create a linked behavior
spec at `docs/changes/2026-10-10-evidence-adaptive-missions.md` using the project
template and these settled decisions; avoid duplicating unresolved planning.

## Steps and progress

- [x] Inspect the baseline and relevant active plan; identify current boundaries.
- [x] Clarify completion, change authority, proactive follow-ups, evidence formats,
      and the corrected action-membership requirement.
- [x] Save the execution plan and prepare a Luna handoff prompt.
- [x] Create the linked behavior spec; inspect callers, tests, and migration setup.
- [x] Implement the initial additive migration, shared submission contracts,
      action activity APIs, authorization policy, evidence evaluation path, and
      stable action reconciliation.
- [x] Complete evidence/chat UI, persisted action activity, mission assessment,
      and persisted attention surfaces for the implemented flows.
- [ ] Complete reasoning stages, deterministic approval policy, adaptive plan
      changes, and durable background recovery.
- [ ] Complete proposal review, evidence correction/reopening, and remaining
      mission activity/history surfaces.
- [ ] Verify acceptance criteria, update feature documentation and this plan,
      and archive only when all acceptance criteria are verified.

2026-10-10 UI clarification: removed the standalone evidence text area. Written
results now go through the action conversation; links submit as reference
evidence and imported documents continue to submit directly as document
evidence. Added a native regression check for these UI paths. The user reports
that verification has now been completed; specific commands and scenarios were
not provided. The missing implementation criteria recorded below remain open.

### Action evidence and conversations

- Add explicit completion criteria and a shared action conversation. Written
  results use chat; reference links and the existing PDF, DOCX, Markdown, and
  text documents use dedicated evidence submission paths. Do not add a separate
  evidence text field.
- Store extracted document text and metadata using the existing approach;
  originals remain local. Links are references and are not fetched automatically.
- Replace Mark complete with Submit evidence. Remove the ability to bypass
  evidence through the action update API. Display awaiting evaluation,
  insufficient, and accepted states with concise explanations.
- Let Polar ask questions, challenge unsupported conclusions, identify
  contradictions, and follow up. Only authorized action members may add human
  messages or submit evidence. Check membership at submission time, including
  removal from an action while its window is open.
- Show accepted evidence and the criteria it satisfies. Allow corrections and
  reopening. Contradictory new information flags an existing completion for
  review rather than silently erasing it.
- Make action conversations reachable from Plan and Timeline. Preserve the
  existing movable/resizable window, keyboard behavior, focus return, and tokens.

### Durable state and interfaces

- Persist action messages, evidence, evaluations, mission assessments, plan
  changes, approval decisions, and scheduled follow-ups. Preserve authorship,
  timestamps, source references, and relevant revisions.
- Preserve stable action/checkpoint IDs. Store dependencies by ID rather than
  title. Archive removed work with its conversation, evidence, assignments, and
  history. Replace destructive regeneration with changes to existing records.
- Add shared contracts and matching HTTP/Tauri interfaces for action activity,
  message submission, evidence submission/correction, reopening, mission
  assessments, plan-change review, and attention items.
- Add a reasoning operation type and mission/action scope. Creation requests
  remain compatible; post-activation reasoning no longer requires a draft.
- Require idempotency for submissions and revision checks for mutations. Validate
  external input in Rust and on the server. Authorize reads, submissions, worker
  claims, and commits. Provider execution remains local; credentials stay local.
- Conversation participation and evidence submission require current workspace
  access AND membership in the target action. Mission owners review consequential
  plan changes; this review role is distinct from action participation rights.
- Generate additive Drizzle migrations through the established tooling. Use the
  existing development environment and direct migration connection; validate on
  an isolated database branch before any production migration. Preserve legacy
  completed actions as historical completions without inventing evidence. Retain
  older action descriptions as their initial completion basis; proposed criteria
  clarifications require review.

### Reasoning and automatic adaptation

Implement distinct operations for action conversation, evidence evaluation,
mission progress evaluation, replanning, scheduling, and next-action selection.
They may use the same selected model and provider.

**New information -> context snapshot -> evidence/progress evaluation -> necessary
plan changes -> deterministic policy checks -> updated attention.**

- Trigger reassessment from human messages, evidence, corrections, action edits,
  relevant workspace-context changes, and scheduled follow-ups. AI-generated
  replies must not create an endless self-triggering reasoning loop.
- Evaluate mission success criteria and checkpoint conditions with supporting
  references. Completing every action does not automatically establish the outcome.
- Generate minimal, explained changes. Preserve completed work and avoid rewriting
  unaffected parts of the plan.
- Automatically update priorities, descriptions, flexible action dates, risks,
  assumptions, assessments, and recommendations.
- Require review for adding/removing work, dependency/checkpoint structure changes,
  completion-criteria changes, mission-deadline changes, and material changes to
  outcomes, success criteria, or constraints.
- Treat declared commitments as constraints. Explain infeasible schedules and
  request a decision. Apply independent routine changes while proposals await
  review; changes depending on an unapproved proposal wait with it.
- Validate dependencies, dates, evidence references, permissions, and revisions
  before committing. Superseded results cannot complete actions or overwrite
  newer information. Reassess current context when a stale result remains relevant.
- Rank next actions by satisfied dependencies, deadlines, priorities, and blockers.
  When nothing is ready, surface the blocking question/decision instead of a blocked
  action. Refresh assessments and attention after accepted changes.
- Record each change's reason. Provide approval/rejection and revision-checked
  undo for automatic planning changes.

### Proactive execution and presentation

- Move worker execution out of Quick AI's visibility-dependent lifecycle. Process
  authorized requests while the desktop is running and authenticated, with action
  windows closed. Preserve user/device ownership and provider quota boundaries.
- Reuse Inngest and the transactional outbox for scheduling, retries, and recovery.
  Persist stage results and renew leases so interrupted reasoning resumes safely.
- Use authorized polling to refresh conversations, assessments, plans, and attention.
  Guard late responses after account/workspace changes and authorization revocation.
- Default timed follow-ups: an unanswered question after 24 hours, one day before
  an incomplete action's deadline, and when it becomes overdue. Coalesce triggers
  and allow at most one timed follow-up per action per day.
- Persist mission timezone, using the desktop timezone for new missions and UTC
  for legacy missions. Cancel obsolete follow-ups after answers, completion,
  archival, or schedule changes.
- Surface useful follow-ups and pending decisions through existing attention
  surfaces. Replace sample notification content with persisted items.
- Retain submissions and show evaluation waiting when the provider is unavailable.
  Pending or failed inference never establishes completion. No cloud model fallback
  or notification guarantee while the desktop is closed is introduced.
- Update Overview, Plan, Context, and Timeline from persisted assessments/events,
  with explanations of what changed.

## Decisions and discoveries

### Explicit requirements and user-selected behavior

- 2026-10-11: Deployment experimentation follow-up: reduce the shared outbox
  recovery schedule from every minute to seven-minute cron increments. Acceptance:
  only `mission-outbox-recovery` changes to `*/7 * * * *`; immediate event dispatch,
  recovery batching, and retries retain their current behavior. Cron runs at
  minutes 0, 7, 14, 21, 28, 35, 42, 49, and 56 each hour, with a four-minute
  hour-boundary gap. This is 6,480 scheduled runs per 30 days, or approximately
  12,960 Inngest executions counting each run and its one step, before retries
  and mission activity. Verify with `pnpm verify`; deployment and Inngest resync
  remain separate from this source change.
- 2026-10-10: Implement adaptive planning and execution context; defer external
  integrations and external tools.
- 2026-10-10: Actions remain incomplete until sufficient evidence is established.
  The user selected AI evaluation rather than immediate completion on submission
  or mandatory human confirmation of every evidence-based completion.
- 2026-10-10: Clear human conclusions in chat count as evidence; no separate
  promotion step is required. Polar asks questions and follows up when necessary.
- 2026-10-10: The user selected automatic routine changes with human review for
  structural changes and mission-deadline changes.
- 2026-10-10: The user selected responses to new input AND timed follow-ups.
- 2026-10-10: Evidence formats are text, reference links, and supported documents;
  images/video and automatic link fetching are outside this increment.
- 2026-10-10: UI correction from the supplied Action Detail screenshot: written
  results belong in the action conversation; the evidence controls are reference
  links and document attachments, with no separate evidence text area.
- 2026-10-10: The user corrected the permission rule: only authorized workspace
  members who are also members of the particular action can participate in its
  conversation and submit evidence. Workspace membership alone is insufficient.

### Project-supported boundaries and implementation defaults

- Postgres remains authoritative; local Rust executes the selected provider;
  deterministic server policy controls committed changes. Separate reasoning
  operations do not require separate models or autonomous agents.
- Preserve the established React/Tauri/Fastify/Drizzle/Inngest stack and existing
  UI components. Keep domain rules independent of transport/provider code.
- The proposed plan's retained defaults are the 24-hour follow-up interval,
  daily per-action cap, timezone behavior, legacy completion preservation,
  mission-owner proposal review, archived history, and revision-checked undo.
  These are implementation defaults, not additional verbatim user requirements.
- The corrected rule concerns participation/submission. Existing workspace read
  authorization continues to govern visibility; do not infer a new action-private
  read policy or change unrelated action-edit/assignment permissions.
- Ordinary discussion updates mission context; it does not silently rewrite
  canonical workspace/company facts.
- Record proposed changes to owner-maintained references, including automatic
  routine updates compared with the architecture's V0 approval wording.

## Verification

### Recovery schedule follow-up (2026-10-11)

- Completed the requested source change: `mission-outbox-recovery` now uses
  `*/7 * * * *`; immediate dispatch, batch size, and retry configuration are
  unchanged. A Node assertion against `server/dist/missions.js` instantiated
  the compiled Inngest functions and confirmed the cron trigger and two retries.
- `pnpm verify`: passed on the approved rerun outside the sandbox, including
  38 native frontend tests, 66 Rust tests, and 32 server tests. The first run
  passed checks/builds but two Rust tests could not bind local sockets
  (`PermissionDenied`, `Operation not permitted`).
- No deployment or live Inngest schedule observation was performed. Next action
  for this follow-up: deploy the backend and resync its Inngest app to register
  the new cron. The broader adaptive-missions plan remains active with its
  existing unfinished implementation and verification criteria.
- GitHub preparation requested by the user: reviewed tracked files and Git
  history with Gitleaks 8.30.1. The only initial finding was the documented,
  disposable OAuth RSA test fixture inside `#[cfg(test)]`; an exact-file,
  private-key-rule exception now allows it while preserving the other checks.
  Reviewed history and tracked snapshot scans passed. A separate local check
  compared four sensitive values from ignored environment files against 797
  historical blobs and the tracked working tree; none matched. No unexpected
  tracked build output, local databases, environment files, or credential
  folders were found. Added signing-material/database ignore patterns and
  documented the optional scans in `docs/HOOKS.md`. No remote is configured;
  next publication action is to add the intended GitHub remote and push `main`.

### Handoff preparation

- Source/document inspection completed. No implementation or migrations performed.
- `pnpm check:docs`: passed on 2026-10-10 (Harness documentation checks passed).
- Application checks and native/model scenarios have not been run for this feature.

### Implementation verification (2026-10-10)

- `pnpm format`: passed.
- `pnpm verify`: passed on the escalated rerun. This includes formatting, lint,
  docs, frontend conventions and their fixtures, native/server TypeScript,
  native development guard tests, environment tests, frontend/server builds,
  38 native frontend tests, Rust format/check and 66 Rust tests, and 32 server
  unit tests. The initial sandboxed run could not create local sockets needed by
  three Rust tests and found one stale evaluator-schema assertion. The assertion
  was updated and the complete rerun passed.
- `pnpm --filter @polar/server test:integration`: passed all 9 development tests
  against the development Neon environment, including owner-without-action-member
  denial, workspace access revocation, timed attention delivery, evidence
  evaluation, outcome assessment, and action history across regeneration. The
  sandboxed attempt first failed DNS resolution; its approved network-enabled
  rerun passed.
- `pnpm native:status`: sandboxed process inspection first failed with `ps EPERM`;
  the approved rerun reported the existing ready Polar Dev session. The documented
  review helper captured the Overview, Plan, and Action Detail surfaces. It showed
  persisted progress, the action-conversation entry point, criteria/evidence
  sections, and disabled submission controls for a user without current action
  participation. No mission data was edited during the review.
- 2026-10-10 evidence-input correction: full `pnpm verify` passed on the
  escalated rerun after an initial sandboxed Rust socket-permission failure.
  It includes 38 native tests (including `action-evidence-inputs.test.ts`), 66
  Rust tests, and 32 server tests. `pnpm native:status` reported the guarded
  session ready; the documented review helper bound the exact Polar Dev app,
  but the combined capture showed a blank gray window. A blank frame does not
  verify the changed interface, so native visual verification remains open.
  No actions or mission data were changed during this review.
- No selected-provider model-quality scenario was run. Integration tests submit
  deterministic evaluator results; they do not prove model judgment quality.
- Desktop packaging was not run because packaging paths were unchanged.

### Required implementation coverage

- Sufficient, insufficient, conflicting, and corrected evidence; conversation-based
  completion; direct completion rejection; reopened/historical actions.
- Action-member submission succeeds; authorized workspace nonmembers, owners who
  are not action members, removed members, revoked workspace members, and cross-scope
  requests cannot participate or submit evidence. Test server authorization as
  well as unavailable UI controls.
- History preservation during renaming, replanning, regeneration, and archival.
- Routine automatic changes; reviewed consequential changes; rejection, undo,
  stale results/proposals, duplicate submissions, and concurrent edits.
- Outcome-based progress and dependency-ready next actions without blocked fallbacks.
- Follow-up timing, deduplication, cancellation, timezone handling, provider failure,
  lease recovery, and processing with Quick AI closed.
- Additive migration compatibility, legacy records, and transaction/event/outbox
  consistency. Use isolated synthetic test data and clean it up.
- Run `pnpm verify`, development integration tests, and the documented native
  desktop procedure. Verify evidence submission, conversation, replanning,
  approval, restart persistence, keyboard access, compact sizes, and reduced motion.
  Packaging verification is required if packaging paths change.
- Report deterministic protocol results separately from actual model-quality
  scenarios. Report failed/unavailable checks and remaining native coverage;
  browser results cannot establish Tauri behavior.

## Handoff or outcome

Kickoff inspection confirmed the handoff baseline and found only this plan
untracked in the working tree. The linked behavior spec is ready. The current
activation path constructs action records from title-based plans, the update API
currently accepts direct completion, and ActionDetail has no persisted activity
or evidence path. The server already guards workspace membership centrally; new
participation routes must additionally check `mission_action_member` at request
time and must not infer participation from mission ownership.

Implementation progress (2026-10-10): added the Ready behavior spec, Drizzle
tables for action messages/evidence, assessments, plan changes, and follow-ups;
added action criteria/evaluation/archive columns with a migration backfill that
preserves legacy completed actions as historical accepted records; removed
completion status from the shared update contract and Rust validation; added
activity/message/evidence server routes and Tauri activity/submission commands;
added action detail UI for conversation, conclusions, evidence, local document
extraction, and action-member gating; and exposed action conversations from Plan.
The server now routes submissions through local ChatGPT evidence evaluation;
only the revision-checked evaluation endpoint can mark new work complete.
Mission assessments are persisted, next-action selection respects completed
dependencies, and plan replacement reuses matching action IDs while archiving
unmatched rows. A home-level worker retries mission and action reasoning with
Quick AI closed while the desktop is running and authenticated. Server unit
tests (32), native/server TypeScript checks, and `pnpm check:rust` pass. The
additive migration applied successfully to the development database. The live
integration suite passes after the regeneration, assessment, and reminder
changes. Approval/rejection and undo, adaptive routine updates, and richer
history/activity surfaces remain unimplemented. Outcome evaluation now receives
mission success criteria and action evidence, and integration coverage confirms
that the mission assessment becomes achieved only after all action criteria are
accepted and the outcome evaluator reports success. Deadline and
unanswered-question follow-ups are now scheduled in Postgres; authenticated
desktop attention refresh coalesces delivery to one reminder per action per
24 hours and displays persisted attention rows instead of sample notification
content. Follow-up dates currently use UTC because mission timezone persistence is
not implemented. The existing mission proposal regeneration flow gates plan
replacement on owner review, but this work does not yet generate or apply
evidence-driven adaptive plan changes, persist explicit approval/rejection/undo
decisions for those changes, or checkpoint interrupted reasoning stages. Evidence
correction/reopening and device-timezone scheduling are also absent.

Owner-maintained documentation proposals (do not edit those references here):
update `docs/PRODUCT.md` to describe evidence-backed action completion and action
conversation participation; update `ARCHITECTURE.md` to define reasoning stages,
server policy, approval/undo, and durable recovery; update `docs/DESIGN.md` to
cover assessment reasons, action activity, and attention items across Overview,
Plan, Context, and Timeline.

Next action: implement evidence-driven plan-change generation with deterministic
automatic/reviewed policy, owner approval/rejection and revision-checked undo;
then implement evidence correction/reopening, mission-timezone reminders, and
recoverable reasoning stage checkpoints. Add regression coverage for each behavior
and rerun the integration suite, `pnpm verify`, and documented native review. Keep
this plan active while any acceptance criteria remain unverified. Archive it and
update the spec link only after completion.
