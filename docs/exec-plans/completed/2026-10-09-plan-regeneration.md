# Regenerate a mission plan

Status: Complete
Owner: Codex
Created: 2026-10-09

## Goal and acceptance criteria
- Add a Regenerate plan button at the top-right of the mission window, beside the menu.
- Generate with the original mission conversation/attachments, current saved plan, and current workspace context.
- Show loading and actionable errors; prevent duplicate clicks.
- Preserve the saved mission until a reviewed replacement is applied, and retain its identity.
- Preserve existing output length/detail rules.

The user confirmed preview before applying a replacement. Existing
product rules require human involvement for changes to outcome or success criteria.

## Context
The capture-recovery active plan covers an unrelated vendor issue and remains
untouched. Generation, proposals, and activation already exist in
`server/src/missions.ts`, `native/src-tauri/src/mission_api.rs`, and
`native/src/features/quick-ai/hooks/useQuickAi.ts`. Activated drafts retain their
conversation and attachments. No schema migration is needed: a mission's current
proposal identifies its originating draft.

## Steps and progress
- [x] Inspect existing generation, persistence, and presentation.
- [x] Extend saved-mission regeneration and reviewed application.
- [x] Add Plan button and loading/error/review states.
- [x] Run regression/full checks and desktop review.

## Decisions and discoveries
Keep the original mission draft activated while generating a new proposal; preserve
current mission content until review. Reuse queued desktop inference and revision
checks. Reject application if execution progress would be discarded.

## Verification
- `pnpm verify` passed after initial implementation.
- `pnpm --filter @polar/server test:integration` passed all 8 development tests,
  including context reuse, unchanged plan before Apply, same mission identity,
  refreshed actions, repeated Apply, stale proposal rejection and workspace access.
- Desktop status was ready. Computer Use returned "Computer Use was not approved
  to use Polar Dev" during exact app binding; no desktop observation occurred.
- User supplied a current Overview screenshot and requested top-of-window placement.
  Moved the button to the shared header beside the menu, visible on saved missions
  in every tab. Draft review retains its existing Refine and Apply controls.
- Final `pnpm verify` and `git diff --check` passed after header placement:
  checks/builds, 9 frontend checker, 23 launcher/review, 2 environment,
  28 native, 45 Rust, and 21 server tests.
- Live inference and desktop clicks/layout at relevant window sizes remain
  unverified because app access was denied. Integration tests use deterministic
  model output; they establish persistence, not actual model writing quality.

## Handoff or outcome
At that point, implementation and automated verification were complete, while
desktop acceptance remained open. The proposed next action was to inspect the
top-right button at normal/compact window sizes, generate a preview, and review
error/cancellation handling before applying. Applying rejects missions with
execution progress to avoid discarding completed or ongoing actions. Original
proposals and the previous proposal ID remain stored for future restoration; no
Undo UI was added.

## Tone refinement — 2026-10-09
The user's regenerated-plan screenshot still showed awkward administrative phrasing.
Updated `mission-output-guidelines.txt` with their exact preferred documentation/hours
sentence as the tone reference. Removed the suggestion to replace "align" with
"agree"; it can be natural and precise in context. Require whole-sentence rewrites
and clear references, preserving checkpoint conditions versus action instructions.
Existing sentence-length, field-budget and detail rules are unchanged. Full
`pnpm verify` and `git diff --check` passed. Actual model adherence to this latest
revision remains unverified; next action is review of a newly generated preview.

## Action timing — 2026-10-09
User requested dates for near-term timeline actions and confirmed rolling ranges:
days 0–6 show Today/By [date], days 7–13 show Next, later dates show Later.
Add date-only `dueOn` to generated actions, preserving older plans without it.
Use Upcoming when no date is known; retain explicit dates in the Plan detail and
show past dates as overdue. Reuse the current-time hook so labels update after
midnight and sleep. No database column migration: dates persist in plan content;
action queries project them by matching their unique title.
Acceptance: validated generation dates, persisted/reloaded timing, exact boundary
and local-date tests, legacy compatibility, required verification. Next: implement
contract/provider, API projection, and timeline date formatting.

### Action timing implementation and checks
- Generated action schema now requires nullable date-only dueOn; shared validation
  accepts older proposals without it and rejects impossible calendar dates.
- The planning payload supplies its UTC timestamp/time zone. Explicit source dates
  stay intact; inferred dates are proposed assumptions. Near-term dates also belong
  in action details. Existing sentence and detail budgets remain unchanged.
- Dates persist in plan JSON and project into action queries by unique action title.
  Timeline presentation uses local calendar days and the existing live clock hook.
- `pnpm verify` passed: builds/checks, 31 native tests (3 new date-label tests),
  45 Rust tests, 22 server tests (calendar validation/legacy compatibility), plus
  existing frontend/launcher/environment checks.
- `pnpm --filter @polar/server test:integration` passed all 8 tests, including
  action-date persistence/reloading after activation and regeneration, and null
  dates for legacy actions. Temporary test accounts were cleaned up.
- `TZ=America/New_York node --experimental-strip-types --test
  native/tests/action-timing.test.ts` passed all 3 tests, exercising DST, midnight,
  rolling range boundaries, ordinal suffixes, overdue and year-crossing dates.
  `git diff --check` passed.

Next: desktop review and actual model schedule review remain pending under the
previous Polar Dev access denial. Existing saved plans without structured action
 dates need regeneration and review; no guessed dates were backfilled. Keep this
plan Active until those live acceptance checks can be observed.

## Regeneration error after selecting Sol 6.1 — 2026-10-09
User reported the inference error `ChatGPT returned an invalid response` after
changing models. The screenshot identifies the local generic protocol error,
not a server plan-validation failure. It does not prove which generic branch ran.

Found and corrected a concrete transport defect: the entire SSE body was limited
to 2 MiB, the same budget as plan output. Reasoning events, framing and repeated
terminal output counted against that budget. Separate stream transport at 16 MiB
from the unchanged 2 MiB plan output and 8 KiB connection-test output. Apply the
same stream budget to mislabeled SSE and buffered event/chunk bounds. The transport
cap now has a distinct local code and actionable message. Non-stream API helpers
retain their original bound; raw provider bodies/credentials are not logged.

Regression tests prove a stream larger than 2 MiB with reasoning events and a
valid small plan succeeds under both normal and mislabeled content types, while
oversized plan text and transport remain bounded. `pnpm verify` passed with 47
Rust tests, 31 native and 22 server tests plus all checks/builds. `git diff --check`
passed. Official structured-output and ChatGPT plan-inference documentation was
consulted; no model was changed and no speculative schema rollback was made.

This fixes a reproducible failure path; actual causation in the user's live
request remains unconfirmed. Next: retry the saved request with the selected
Sol 6.1 model and inspect the resulting exact error if it fails. No saved mission
was replaced or live inference submitted during this diagnosis. Desktop access
remains unavailable from the previous denial. Keep the plan Active.

## Result submission diagnosis — 2026-10-09
User supplied the later error `Polar could not validate the ChatGPT result`.
This comes from server-result submission, distinct from the earlier SSE error.
Current code exposes two reproducible defects: result submission inherits a
32 KiB body limit despite a 2 MiB provider output budget, and nested output
schema failures return INVALID_REQUEST before the INVALID_PLAN branch runs.
The provider's output schema also omits the server's field/count budgets.

Acceptance for this fix: detailed contract-valid results above 32 KiB reach
validation; oversized requests stay bounded; invalid output receives a specific
plan rejection; safe diagnostics identify status and schema paths without source
text or credentials; generation communicates the existing field budgets.
Preserve current contracts, mission content, model selection and review-before-apply.

Next: reproduce size and schema failures, fix transport/error classification and
provider budgets, run required checks and desktop retry. App binding now succeeds;
Terminal log access was denied by Computer Use policy. Exact cause in the reported
live request remains unconfirmed until submission can be observed.

### Result submission fix and verification
- Reproduced HTTP 413 with a contract-valid 36-action plan above 32 KiB.
  The result route now allows the existing 2 MiB provider output budget plus
  64 KiB for scheduling/envelope overhead. Other routes retain their own limits.
- Output schema failures now return INVALID_PLAN; submission metadata failures
  remain INVALID_REQUEST. Server diagnostics record only issue paths/codes.
  Native diagnostics record only request ID, HTTP status and allow-listed code.
  HTTP 413 now produces a distinct size message and marks the request failed,
  so a rejected result no longer stays claimed until its lease expires.
- Provider generation now receives the existing field/count limits using
  supported string patterns and array constraints. Guidelines explain the
  1,000-character detail and 500-character list-entry storage budgets without
  changing the saved contract or discarding plan substance. Official OpenAI
  structured-output documentation was consulted. No model/account was changed.
- Regression/server tests pass (28). `pnpm verify` passed outside the sandbox;
  the initial sandbox run reached Rust tests but two local-listener tests were
  denied permission. Development integration passed all 8 tests after the
  initial DNS-restricted run was rerun with network access. The integration
  fixture now exceeds 32 KiB through submission, persistence and regeneration;
  temporary accounts were cleaned up. `git diff --check` passed.
- Started the guarded desktop session after fresh status reported stopped;
  rebuilt native PID 86031. Native regeneration was invoked from the saved
  mission and visibly entered the building state. The retry completed on
  2026-10-09 at 23:25:15 UTC using gpt-6.1-sol. Read-only development diagnostics
  confirmed request 42871e98-4221-43bb-92a3-2b152dd705d7 is completed and its
  compact result JSON is 34,509 bytes, above the old 32,768-byte cap. Its current
  proposal has not been applied to the saved mission.
- Subsequent desktop observation failed with a user-changed-app binding error;
  the helper's single recovery also failed and automation stopped. Completion
  and review status are established by server records, not a final UI capture.
  The historical rejected output was not retained, so the exact size/field that
  triggered the screenshot's earlier request cannot be recovered.

This debugging fix is implemented and verified, including a successful live
regeneration. The proposal was ready for the user's review.

## Final usage acceptance — 2026-10-09
The user reports testing plan-regeneration usage successfully and confirms it
works. This closes the remaining live-use acceptance criterion. The user did not
itemize window sizes or individual error/cancellation scenarios; this record
captures their overall successful usage verification without claiming those
specific scenarios were separately exercised.

Implementation, automated verification, and user-reported successful live usage
are complete. No remaining acceptance work is recorded.
