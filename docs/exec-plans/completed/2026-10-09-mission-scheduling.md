# Prioritize and schedule mission plans

Status: Complete
Owner: Codex
Created: 2026-10-09

## Goal and acceptance criteria
User requires a separate AI scheduling pass after planning, with no additional
scheduling instructions in the original planning request. This applies to both
first-time mission creation and plan regeneration.

- Run the scheduler on ready proposals before saving or previewing them.
- Give each checkpoint a deadline and order checkpoints by deadline.
- Schedule and order actions for efficient execution before their checkpoint
  deadlines, respecting prerequisites and preserving plan substance.
- Align the recommended next action with the first dependency-ready scheduled action.
- Show checkpoint/action dates in Plan. Timeline uses Today, Tomorrow, Next for
  days 2–6, and Upcoming from day 7 onward. Preserve overdue/unknown-date handling.
- Preserve legacy plans without checkpoint dates. Cancellation/failure in either
  pass must not publish a partial plan; worker leases must cover both requests.
- Validate coverage, dates, deadline bounds, ordering, and dependencies.
- Run regression/full checks and attempt desktop acceptance.

## Context
Generation and regeneration share the local worker in
`native/src-tauri/src/providers/commands.rs` and `openai.rs`. The server persists
plan JSON and action order in `server/src/missions.ts`; the frontend renders
checkpoint order directly and projects action dates into Timeline.
The regeneration and capture-recovery plans remain separate and unchanged at
the user's explicit direction.

## Steps and progress
- [x] Inspect planning, contracts, persistence, presentation, tests, and docs.
- [x] Add the separate scheduling request and validate its indexed patch.
- [x] Extend checkpoint date contracts, server validation, and deadline presentation.
- [x] Update timeline date boundaries and regression coverage.
- [x] Diagnose and fix contradictory Quick AI worker/error status; surface schedule validation category.
- [x] Run full repository verification and mission integration coverage for rejection/retry.
- [x] Complete desktop smoke review and live scheduling acceptance.

## Decisions and discoveries
Use the selected account/model for a separate local request containing only the
generated plan and device-local clock. Return an indexed scheduling patch to
preserve original details and citations. Inferred dates remain proposed timing
recorded as assumptions. Routine boundary choice: day 7 is Upcoming because the
user specified Next as less than 7 days. Existing missions need regeneration and
review; no automatic migration or modification of saved missions.

Chrono is already in Cargo.lock transitively; Cargo added it as a direct dependency
for device-local calendar dates and native date validation. The initial scheduler
module and dedicated prompt are wired into the shared creation/regeneration worker.
The original interpreter instructions and schema are unchanged. Each request keeps
its three-minute timeout; the worker lease is seven minutes to cover both calls.
The scheduler uses a fresh local clock after interpretation. `scheduledAt` retains
that clock's offset in plan JSON so server mission-deadline bounds use the same
calendar. New result submissions require a valid schedule; legacy stored plans
remain readable and activatable. Dates persist in existing JSON, without a migration.

The indexed patch must cover every action/checkpoint exactly once, respect fixed
action dates, order checkpoints/actions by dates, and place prerequisites
before dependents (same-day work is allowed). The scheduler may choose order and
priority among ready actions. It returns a single recommendation for the first
ready action; original requirements/details/citations are preserved. Conflicting
timing fails the request instead of publishing the unprioritized candidate.
The scheduler distinguishes fixed dates from the first planner's proposed timing;
it may improve proposed dates. Native merging updates only the corresponding exact
date in action detail, preserving other text/dates. This classification is model
judgment and remains part of the reviewed proposal, not a deterministic fact check.

Debugging the reported simultaneous “building your plan” and validation error
found that a rejected result returned HTTP 400 without transitioning the claimed
reasoning request to failed. The local worker displayed a generic error but did
not notify the server's existing failure endpoint, so the working state remained
until lease expiry. The UI also rendered the working state independently from
its local failure. Result validation now returns stable categories, the worker
maps them to actionable messages and closes rejected claims, and the UI hides
the working indicator as soon as it has a local error. The screenshot alone
cannot identify which exact validation condition rejected that particular plan;
the new message will distinguish plan structure, dependencies, and scheduling.
The follow-up screenshot exposed a related retry gap: the local error card only
offered retry for queued requests. It now offers retry for a lingering claim,
cancels that claim first, and the server permits requeuing a cancelled request.

Owner-maintained Architecture remains untouched. Proposed durable clarification:
the local planning pipeline now uses separate interpretation and scheduling calls,
with an indexed patch and server validation before a proposal can be persisted.

## Verification
`pnpm check` passed before the integration fixture changes. First `pnpm test:rust`
compiled and passed all 9 new scheduling/pipeline tests; 54 total passed, while 2
existing authentication tests failed on sandbox socket binding. Escalated rerun
passed all 56 then-current Rust tests. Full `pnpm verify` passed with approved local
socket access after final scheduling changes: checks/builds, 9 frontend checker,
23 launcher/review, 2 environment, 32 native, 57 Rust, and 26 server tests.
Development `pnpm --filter @polar/server test:integration` passed all 8 tests with
approved network access, including rejection of unprioritized/inconsistent new
proposals, creation checkpoint/action persistence, and regenerated checkpoint
deadline persistence with review-before-apply and retained mission identity.
Temporary test accounts were cleaned up. The sandbox-only integration attempt
failed on database DNS before signup; it was rerun with access.
`TZ=America/New_York node --experimental-strip-types --test
native/tests/action-timing.test.ts native/tests/plan-dates.test.ts` passed all 4
calendar/DST/midnight/boundary checks. Official structured-output docs were
checked for required fields and closed object schemas:
https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses.
After the validation-worker and retry fixes, final `pnpm verify` passed with 59 Rust tests,
32 native tests, 26 server tests, builds, formatting, lint, and TypeScript checks.
The mission integration test passed in isolation against development Neon,
including specific `INVALID_SCHEDULE` reporting, transition to failed, retry,
cancelled-request requeue, and successful completion. A parallel integration-suite attempt passed seven
tests but its mission test got an empty initial claim; the isolated mission test
passed on rerun. The sandbox-only run could not resolve the development database.

## Handoff or outcome
App binding succeeded on
the development bundle, but the launcher exited after a concurrent Rust rebuild,
leaving an orphan app and no Vite. Stopped only that review-created orphan and
relaunched the guarded session with a PTY; no user session was killed. The local
API already listening on port 3000 is preserved; stopped the failed additional
API watcher. The restored session was ready with native PID 5822 and Vite 5749.
Creating the guarded desktop review then returned exactly "Computer Use was not
approved to use Polar Dev". No scheduling click or live inference occurred. The
initial successful binding only showed the empty homescreen; it does not verify
the changed UI. Attempted Ctrl+C cleanup of this review's development session;
the tool call was interrupted before reporting completion, so shutdown remains
unconfirmed. Do not repeat terminal input blindly. The pre-existing API server
on port 3000 remains untouched.

Implementation and automated/database verification were complete. At that point,
desktop UI/IPC success, failure/cancellation, compact layout, and actual model
scheduling quality remained unverified. `pnpm native:status` reported
the managed app ready once (native PID 22535); a later status attempt failed
because process inspection returned `ps EPERM`. This turn did not access the
app through Computer Use. The next action at that time was to run the Mission
scheduling smoke review in Verification with a synthetic mission; inspect initial
and regenerated schedules before applying anything. Do not replace the user's
live mission merely for testing.

User subsequently requested stopping both development sessions. The server had
already exited by the targeted process check. Sent SIGTERM to the inspected native
launcher (5312), which forwarded shutdown to its Tauri/Vite group. `pnpm
native:status` now reports Stopped with no native/server/launcher/watcher; ports
3000 and 1420 have no listeners. Cleanup is confirmed. The next acceptance action
above remained pending at that time; start the development sessions again when
resuming review.

## Final usage acceptance — 2026-10-09
The user reports testing mission-scheduling usage successfully and confirms it
works. This closes the remaining live-use acceptance criterion. The user did not
itemize window sizes or individual failure/cancellation scenarios; this record
captures their overall successful usage verification without claiming those
specific scenarios were separately exercised.

Implementation, automated/database verification, and user-reported successful
live usage are complete. No remaining acceptance work is recorded.
