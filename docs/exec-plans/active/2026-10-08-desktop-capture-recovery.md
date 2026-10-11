# Desktop capture recovery

Status: Active (reopened after recurrence)
Owner: Codex
Created: 2026-10-08

## Original goal and acceptance criteria (see reopened criteria below)

Debug and fix repeated agent desktop verification failures. Preserve existing
development sessions and unrelated feature work.

- [x] Establish the failing layer from local evidence, distinguishing process
      readiness, window discovery, capture, and product prerequisites.
- [x] Make verification select and raise the real development window before
      capture, with bounded recovery that cannot repeat the same failure forever.
- [x] Restore Polar's minimized/hidden main window when macOS reopens the app.
- [x] Add deterministic regression checks and exercise the helper in the actual
      development app, including the workspace dialog open/close flow.
- [x] Run required verification and record remaining external limitations.

## Context

Neither active feature plan covers verification tooling. The completed
[desktop verification plan](../completed/2026-10-08-desktop-verification.md)
fixed launch ownership and app identity; it did not establish reliable capture
when macOS window visibility changes. The workspace plan records capture failures
for native PID 70219. Current status identifies the same development bundle with
new PID 99533, Vite PID 41445, and launcher PID 41048. Preserve those sessions.

Read Product, Architecture, Verification, Plans, both active plans, the completed
desktop plan, and current launcher/tests. No product or UI behavior change is
needed. Existing uncommitted application/documentation changes predate this work.

## Steps and progress

- [x] Inspect history, current tooling, and live process/capture state.
- [x] Identify capture failure from local macOS logs.
- [x] Implement executable window selection/raise and bounded capture recovery.
- [x] Handle macOS reopening and verify window restoration in the rebuilt app.
- [x] Exercise real native flow and regressions; update Verification.
- [x] Finish required checks and archive when acceptance criteria pass.

## Decisions and discoveries

- 2026-10-08: Local SDK `SCError.h` identifies -3811 as InternalError (video/audio
  capture failure), distinct from denied authorization (-3801) and missing
  entitlements (-3803). It is not evidence of a permission denial.
- 2026-10-08: Unified logs show SkyComputerUseService PID 36015 reporting
  `failed display lookup for windowBounds`, `cgError=0 found=0`, twice at
  13:58:28 and twice at 13:58:34. Filters had no resolved display. The generic
  ScreenCaptureKit wrapper obscured a window/display-selection failure. Exact
  private window bounds were redacted; off-Space versus stale-window selection
  cannot be distinguished from these logs. Stage Manager currently reports off.
- 2026-10-08: Current CUA binding, screenshot, workspace-context opening, closing,
  and subsequent screenshot succeeded under PID 99533. The same capture-service
  PID is still running. Global missing capture authorization is unsupported by
  this evidence. No permission or service change was performed.
- 2026-10-08: Use the documented AX standard-window Raise action before capture,
  and AX observations for routine interactions. Process readiness remains
  separate from capture success. Keep the procedure in Verification and expose
  its mechanical operations through a reusable module rather than prose alone.
- 2026-10-08: Controlled minimization reproduced `noWindowsAvailable` while
  process status remained ready (PID 99533). The permitted exact-path rebind
  returned `timeoutReached`. Stopped UI automation at this failure. Polar's
  Builder::run had no RunEvent::Reopen callback; installed Tao forwards macOS
  applicationShouldHandleReopen without restoring minimized windows. Add the
  standard reopen handler (show app, unminimize/show/focus main window). This is
  a functional window-lifecycle fix; its required watcher rebuild is a concrete
  state change, not a restart solely to reset capture recovery. Read Design and
  the installed Tauri/Tao source before changing this behavior.

## Verification

- `pnpm native:status`: sandbox failed with `ps EPERM`; approved inspection passed
  and reported ready with the exact managed app path and native PID 99533.
- CUA: exact app binding and workspace-dialog close/capture reproduction passed.
- Focused local `log show` established the failed display lookup above.
- At initial inspection, helper regressions, live helper execution, and
  `pnpm verify` remained outstanding; final results follow.
- `pnpm test:native-dev` passed all 11 checks (5 existing launcher tests and 6
  new desktop review tests). First run exposed a test assertion comparing an
  Error cause with a plain object; corrected the assertion and reran successfully.
- `pnpm verify` sandbox run passed through checks/builds/native tests and Rust
  compilation; 2 Rust socket tests failed with PermissionDenied. Approved rerun
  passed all checks/builds, 11 launcher/review tests, 26 native tests, 42 Rust
  tests, and 21 server tests. Native reopen change requires another check run.
- Required native lifecycle rebuild finished: `cargo check --locked` passed;
  watcher restarted the app from PID 99533 to PID 38742. Status is ready with
  the same Vite PID 41445, launcher PID 41048, and exact managed bundle. Record
  this concrete state change before resuming UI verification of the new handler.
- Rebuilt-app check: exact CUA binding and helper initialization passed at PID
  38742. Clicking the actual native Minimize control and obtaining AX state now
  succeeded (the same operation failed with noWindowsAvailable before the
  handler). The following raised-window capture visibly showed Quick AI at
  800×600, captureState available/recoveryUsed false. No new native process or
  capture-service restart was needed for restoration. This verifies minimized
  restoration; off-Space restoration was not exercised.
- Hidden-app check: Command+H followed by AX observation succeeded; restoring
  the original large window through the native Zoom action and subsequent
  helper capture visibly showed Quick AI. Window restoration required no capture
  retry. The development app was left running at its original large size.
- Final `pnpm verify` with approved local socket access passed after the Rust
  reopen change: formatting, lint, docs/frontend checks, TypeScript, both builds,
  9 frontend checker tests, 11 launcher/review tests, 2 environment tests,
  26 native tests, 42 Rust tests, and 21 server tests. No live provider inference
  or feature integration test was needed for the window/tooling change.
- Final `pnpm native:status` reports ready, native PID 38742, original Vite
  PID 41445 and launcher PID 41048. Old packaged app PID 39496 remains intact.
  No session was stopped, credentials changed, permissions reset, or commit made.
- `git diff --check` passed. Packaging configuration/paths were unchanged;
  `pnpm tauri build` was not required.
- Live helper imported successfully into CUA. It bound and raised the exact
  development standard window. Workspace-dialog capture and subsequent
  close/capture returned successfully; captureState available, recoveryUsed false.
  The first workspace frame was blank while AX content was available; do not
  count that as visual feature acceptance. The closed-dialog Quick AI frame
  visibly showed the expected interface. No data was edited or inference sent.

## Original handoff (superseded by recurrence)

Delivered a macOS reopen handler restoring the main window, an executable CUA
review helper that raises the actual standard window before capture and enforces
a finite capture-recovery budget, six new regression checks, and updated
Verification instructions. The controlled minimized-window failure before the
native change now succeeds in the rebuilt app. Hidden restoration and actual
dialog close/capture also passed.

The original -3811 logs establish failed window/display lookup, but do not reveal
which private window/Space was selected. No universal fix to the external capture
service is claimed. Cross-Space/cached-window coverage is recorded in the debt
tracker. Feature acceptance criteria remain in their existing active plans;
this task does not establish live model quality or mission persistence. Next
feature sessions should follow the updated desktop procedure and resume those
checks using the current development app.

## Reopened investigation — 2026-10-08

Acceptance remaining:

- [x] Correct the capture-before-raise ordering and account for implicit captures
      and failed actions under one review budget.
- [x] Exercise the corrected helper in the already-running app; distinguish
      mitigated repository defects from any remaining vendor capture failure.
- [x] Verify checks and correct misleading size/capture evidence and instructions.
- [ ] Establish and resolve the remaining external capture trigger, including
      initial binding and cross-Space behavior; no universal fix is verified.

The failed session at 14:45 used raw `app` calls, not the review helper. Logs at
14:45:08.278 and 14:45:31.089 again report failed display lookup. Its last call
batched setValue, Save, and AX observation; the applied result is uncertain.
The installed CUA adapter implements getApp, getAXState, and screenshot APIs
through the same get_app_state/getSkyshot operation. AX observations are not
capture-free. The original helper therefore captured before Raise, used three
captures per review frame, and exposed actions outside its failure accounting.
This invalidates the original claim that the procedure reliably establishes
visibility before capture. The minimized-window native fix remains verified.

User authorized a read-only Swift/CoreGraphics window diagnostic. Sandbox
returned no displays/windows; approved execution found display 1, 1512×982,
scale 2. PID 38742 has main window 81757 at x356/y121, **401×301 points**,
plus menu/helper windows; no Polar window was marked on-screen at inspection.
This establishes current visibility state, not visibility at the earlier failures.
The recorded screenshot is 802×602 physical pixels. The earlier drag incorrectly
halved an 800×600 point window: the reported 800×600 layout evidence actually
covers approximately 400×300. Correct that claim rather than treating it as a
verified 800×600 defect.

Implementation in progress: cache the observed standard-window index, Raise
before each subsequent single combined observation, guard actions and all
observation APIs with the same finite budget, and require observation between
actions. Never automatically replay an uncertain mutation. Initial binding can
still fail before a window index is known: the public macOS API offers no
capture-free discovery/observation operation. A visibility experiment with the
already-observed Raise action will test the changed operation order on the same
running PID; do not restart sessions or reset privacy permissions.

Next action: run deterministic regression checks, test the corrected order once
in the existing app, and record whether vendor capture still blocks verification.

### Corrected helper/live evidence

- Cached binding Raise initially failed with "Computer Use is not active" before
  any capture. CUA requires initial get_app_state to activate a binding. This is
  another dependency on capture; cached indices cannot restore an inactive tool
  session. Stopped that path and tested initialization of the changed helper.
- Query-string cache busting was unsupported by CUA's module loader (no UI
  operation ran). Loaded an exact temporary copy of the changed module instead.
- Fresh status confirmed ready, unchanged native PID 38742, Vite 41445, launcher
  41048, watcher 41195; old packaged PID 39496 preserved. Corrected helper binding,
  Raise/AX observation, Zoom, combined observation all succeeded.
- Resized using the actual original Retina screenshot. Authorized CoreGraphics
  diagnostic confirmed main window 81757 at **800×600 points** on display 1,
  backing scale 2. A later on-screen-only query listed the main window, whereas
  earlier samples did not. These samples show visibility changes during the
  investigation, not proof of the exact original -3811 trigger.
- Confirmed 1600×1200-pixel combined screenshot at 800×600 points. Brief setValue
  to its existing text and input click, each followed by guarded observation,
  succeeded. Native Zoom restored the large window. captureState available,
  recoveryUsed false. No Save, inference, restart, or permission reset performed;
  the earlier committed brief remains unconfirmed.
- `pnpm test:native-dev` passed 15 tests: 5 launch and 10 corrected review checks.
  Mocks now allow AX, binding, action, Raise, and combined capture failures, and
  prove actions cannot bypass accounting or automatically replay uncertain Save.

Next action: finish required full verification and record the external limitation.
Initial capture and cross-Space vendor failure remain outside repository control;
do not archive this investigation as a universal capture fix.

### Final checks and current handoff

`pnpm verify` passed with approved local socket access: formatting, lint,
documentation/frontend/TypeScript checks, both builds, 9 frontend checker tests,
15 launcher/review tests, 2 environment tests, 26 native tests, 42 Rust tests,
and 21 server tests. `git diff --check` passed. Packaging paths did not change;
no packaged build was required. No new native source change was needed in this
reopened phase.

Repository defects are corrected and exercised in the already-running app.
The failing layer is SkyComputerUseService's ScreenCaptureKit display selection,
and all public macOS CUA observations depend on that layer. The signed installed
vendor service is outside this checkout, its failing bounds are private in logs,
and the public API does not expose capture-free initial observation. We cannot
truthfully claim its initial/cross-Space failure is fixed by repository changes.
Keep this plan active. Next action is a controlled cross-Space/vendor capture
investigation when that environment or diagnostic capability is available; use
the guarded helper for intervening feature checks and retain actual failures.
Do not equate a run of successful observations with eliminating intermittent
vendor failures. Save persistence and feature acceptance remain with their plans.

## Continued controlled reproduction

User requested the next step and continued investigation. Hypothesis: capture
failure depends on window visibility/Space transitions rather than every normal
interaction. Reuse PID 38742 with the existing guarded review budget. Establish
a visible baseline; if it succeeds, perform one desktop-navigation experiment,
inspect the already-authorized read-only window mapping, then attempt the guarded
observation. Do not save workspace data, create Spaces, or change OS settings.
Record failed operations without repeated polling. Stop on the established
recovery boundary. A Space transition counts as exercised only if window
visibility evidence confirms it; a keyboard shortcut alone is insufficient.

### Binding activation finding and correction

The baseline observation failed. Its single recovery exposed the underlying
cause: "Computer Use is not active ... first must call get_app_state". PID 38742
was still ready. The recovery failed before rebinding because it attempted Raise
on the inactive binding. No Space transition was performed and no -3811 was
established by this experiment. The earlier helper conflated this explicit
pre-action rejection with capture failure and made recovery impossible.

Changed the helper to recognize only that explicit inactive-binding response.
Before an observation, it may refresh the exact app binding once, discover fresh
indices, then Raise and observe. An action rejected as inactive is never replayed;
it requires fresh observation. This refresh preserves the capture budget. Actual
capture failures, including during refresh, remain bounded; persistent inactive
rejection cannot loop. Recovery likewise allows its already-authorized one rebind
when the old binding is inactive. Errors now retain their cause in evidence.

`pnpm test:native-dev` passed 20 checks, including 5 new activation regressions.
The old blocked object used the superseded implementation and misclassified the
activation rejection; the changed activation ordering is a concrete relevant
code change for the next live experiment. Use a new imported revision solely to
exercise that correction, not to reset a genuine capture failure's budget.
Next: live baseline/visibility experiment with the corrected revision, full
verification, and current handoff. Cross-Space remains unverified until observed.

### Continued live result

The corrected revision bound and observed the already-running PID 38742
successfully. A single Ctrl+Right was accepted, but the read-only diagnostic
still listed main window 81757 as on-screen at 1512×948 points. Its subsequent
guarded observation succeeded, recoveryUsed false and bindingRefreshes zero.
The shortcut did not establish an off-Space test; cross-Space coverage remains
unverified. The actual inactive-binding branch is covered by regression tests,
with the real protocol rejection above providing its fixture. No workspace data
was saved or app process restarted. The large window and editor remain intact.

Official OpenAI troubleshooting documents in-app feedback with optional session
sharing: https://learn.chatgpt.com/docs/reference/troubleshooting#feedback-and-logs.
If -3811 recurs with a visible window under the corrected helper, preserve that
session/time/window identity and submit a vendor report through that channel.
Prepare the report locally; do not transmit sessions or logs without explicit
user authorization. Current next action is required verification of this latest
activation fix, followed by workspace acceptance with the corrected procedure.

### Latest verification and next action

Full `pnpm verify` passed after the activation correction with approved local
socket access: checks/builds, 9 frontend checker tests, 20 launcher/review tests,
2 environment tests, 26 native tests, 42 Rust tests, and 21 server tests.
`git diff --check` passed. Local vendor report prepared at
`/private/tmp/polar-capture-bug-report.md`; nothing was sent. It contains version,
redacted log evidence, confirmed behavior and explicit unknowns, without session
content or workspace text. ChatGPT desktop is 26.930.31730/build 12947 and macOS
26.0.1/25A362.

Next action: resume workspace desktop verification with Polar visible on its
current desktop and this guarded review helper. Genuine -3811 remains unresolved;
if it recurs in that baseline, append its exact operation/time/window evidence
and use the prepared report through the official feedback channel. Initial
capture failure and proven cross-Space coverage remain open; this plan stays
active. The binding protocol defect is fixed and regression-covered, but its
automatic refresh has not yet been exercised across another real user-turn
boundary under the updated helper. Keep that limitation explicit.

### Reproduction, recovery, and report handoff — 2026-10-08

- Fresh status kept native PID 38742, Vite 41445, launcher 41048, and watcher
  41195. Corrected helper resumed across this user turn: it handled one
  `Computer Use is not active ... get_app_state` rejection by rebinding once,
  refreshed indices, raised, and observed. It reported `bindingRefreshes: 1`,
  `recoveryUsed: false`.
- The workspace window was visibly present on the current desktop; combined
  capture succeeded. After a scroll action and successful AX observation, the
  next combined capture failed with exact native error `Computer Use server
  error -10005: Error Domain=com.apple.ScreenCaptureKit.SCStreamErrorDomain
  Code=-3811 "Failed to start stream due to audio/video capture failure"`.
- Fresh status was still ready with the same PID. The single recovery raised,
  rebound, refreshed indices, and returned a full screenshot of the same
  workspace surface. `recoveryUsed: true`, no process restarted. Main window
  81757 was on-screen in a subsequent read-only CoreGraphics listing. The
  latest visible screenshot was full-scale; no Save was performed in this test.
- Thus the repo helper now handles between-turn tool deactivation and exits a
  verified transient ScreenCaptureKit failure without a loop. It does not
  prevent the intermittent stream failure. Cross-Space trigger remains untested.
  A 5-minute unified-log query showed no event; the 20-minute query showed only
  a successful 14:58 window registration. The native error itself is captured.
- Updated local report: `/private/tmp/polar-capture-bug-report.md`. Attempted to
  open ChatGPT (`com.openai.codex`) for the user-authorized feedback submission;
  Computer Use explicitly rejected app access with “not allowed ... for safety
  reasons.” No report or session was transmitted; do not route around that
  rejection. The report is ready for the user to submit via the desktop app's
  `/` feedback flow, without attaching the session unless they choose to.

The root issue is now narrowed to intermittent ScreenCaptureKit stream startup
failure after ordinary app interaction, with successful in-place recovery. The
repository cannot repair that native service. Keep the investigation active;
use the one-recovery helper for remaining feature checks and leave provider-side
submission as a user action due to the explicit Computer Use policy rejection.

### Explicit user retry must be honored

User showed another session refusing their "try again" solely because the native
PID was unchanged and the automatic budget was spent. This is a repository
procedure defect: unchanged process identity does not establish persistent
capture failure, and explicit user authorization overrides our automatic retry
limit. Add a bounded explicit retry entry point: one attempt per recorded user
request, fresh status and exact app identity, no mutation replay, no additional
automatic recovery allowance. Correct Verification so other sessions honor the
request without requiring a restart or a changed PID.

The explicit retry entry point is implemented as
`review.retryCapture(freshStatus, userRequestId)`. A stable ID permits one attempt
for that user message, including on the unchanged PID after a blocked automatic
recovery. It never replenishes automatic recovery or replays a mutation. Updated
Verification also covers older cached helpers or sessions without a review
object: the explicit request permits one exact bind/combined observation, without
resetting the automatic budget. Existing historical "state change required"
notes do not override explicit user retry instructions.

`pnpm verify` passed after this change, including 23 launch/review tests (3 new
explicit-request regressions), 26 native tests, 42 Rust tests and 21 server tests.
`git diff --check` passed. This phase did not attempt a new live capture; the
external -3811 remains unresolved. Next action for the other session is to read
the current desktop procedure and honor the existing "try again" instruction
with one fresh observation of the ready development app, even with PID 38742.

### Action detail UI review — 2026-10-09

- Initial `pnpm native:status` reported ready, native PID 86031, Vite PID
  85940, watcher 85656, and the exact managed `Polar Dev.app` path. Binding,
  guarded observation, and an action click/capture succeeded, but showed the
  old detail popover. The Vite server and watcher subsequently disappeared;
  fresh status reported native-only. The original native process was preserved.
- Restored only the missing frontend with `pnpm --filter @polar/native dev`.
  The sandbox rejected socket binding with EPERM; approved execution started
  Vite PID 66588 on port 1420. Fresh status reported ready with the unchanged
  native PID and exact development bundle. No native restart or privacy change.
- The next guarded `getAXState` rejected the stale binding with
  `The user changed '/Users/antoniopertuz/Documents/work/personal/polar/.polar-dev/Polar Dev.app'. Re-query the latest state with get_app_state before sending more actions.`
  One recovery, following fresh status, failed with the same cause. Evidence:
  captureState blocked, recoveryUsed true, failedOperation recoverCapture,
  bindingRefreshes zero. Stopped native interaction; this is a tool binding
  rejection, not evidence of ScreenCaptureKit -3811.
- A temporary browser harness reviewed the actual new action components at a
  normal viewport, 800×600 CSS pixels, and 390×700 CSS pixels. Confirmed dark
  window appearance, responsive metadata, no horizontal overflow, scroll access
  to the completion footer, Escape/close dismissal, and trigger focus return.
  The harness was removed. These checks establish frontend UI behavior only;
  the new action window has not been visually verified in Tauri.
- Final `pnpm verify` passed after the CSS refinements with approved local socket
  access: formatting, lint, documentation/frontend/TypeScript checks, both
  builds, 9 frontend-checker tests, 23 launcher/review tests, 2 environment tests,
  32 native tests, 60 Rust tests, and 28 server tests. The initial sandbox run
  failed two Rust socket tests with PermissionDenied; the approved runs passed.
  `git diff --check` passed. Packaging was unchanged, so no packaged build was
  required. The restored Vite server remains running for the original app.

### Action window interaction review — 2026-10-09

The next review started after a concrete native lifecycle change: PID 74430,
launcher 74157, watcher 74296, and Vite 66588. The exact managed development
bundle was selected through a new guarded helper. Initial observations and
captures succeeded. Native appearance showed the new action window, and a fresh
capture after a flex sizing correction showed its restored scrollable body.

A chrome drag failed with `Computer Use server error -10005: noWindowsAvailable`.
Fresh status remained ready on the same PID. The single automatic recovery
succeeded, returning fresh AX state and a full screenshot. The failed gesture
was not replayed and was not treated as verified. A later independent click was
rejected with `The user changed '/Users/antoniopertuz/Documents/work/personal/polar/.polar-dev/Polar Dev.app'. Re-query the latest state with get_app_state before sending more actions.`
Final evidence: captureState blocked, recoveryUsed true, failedOperation click,
bindingRefreshes zero, userRetryRequests empty. Native automation stopped.

Browser checks independently verified action dragging, corner resizing, keyboard
movement cancellation, precise keyboard resizing, scrolling, dismissal/focus
return, and compact/narrow recovery. The owner subsequently reported completing
manual verification and requested closing the
[action window plan](../completed/2026-10-09-action-window-interactions.md).
That feature is complete; the external capture issue remains under investigation.

Next action: investigate the guarded review's changed-binding rejection after
a successful recovery under the documented bounded procedure. Do not replay
uncertain gestures or reset this review's
automatic budget. Existing -3811 and cross-Space limitations remain open.

### Contextual commit handoff — 2026-10-10

The owner requested committing the pending work by context. Action details and
their window controls are grouped on `feat/action-details`; workspace backend,
desktop, and completed-plan records are grouped on `feat/workspace-settings`;
this capture-review record is on `docs/desktop-review`. The branches are stacked
in that order above `main` so their prerequisites remain available.

The final application tree passed `pnpm verify` with approved local socket
access; the sandboxed attempt blocked two existing Rust socket tests. Commit
hooks also ran `pnpm check`. This session did not repeat live database tests or
desktop gestures; their earlier evidence and owner verification remain recorded
in the completed feature plans. No new capture evidence was established.

Next action remains investigating the changed-binding rejection after recovery
under the documented bounded procedure. Capture recovery remains Active, with
the external -3811 trigger and cross-Space coverage unresolved.

### Pre-push launcher test failure — 2026-10-11

The owner reported that the pre-push verification failed in the concurrent
stale-lease recovery test, counting zero winners instead of one. Acceptance for
this follow-up: await complete child output before asserting ownership, retain
a deterministic delayed-output regression, and pass focused stress checks and
the full pre-push verification command before committing the correction.

The original test passed 100 ordinary repetitions. Delaying each worker's stdout
until process exit reproduced the exact `0 !== 1` failure: the promise resolves
on `exit`, which does not guarantee stdout has drained. The same collection
pattern exists in the Cargo runner test. Both output assertions now await
`close`. The concurrency test explicitly pauses stdout until `exit`, making the
original assertion order fail deterministically while preserving the checks for
one winner and seven rejected starters.

Follow-up acceptance is verified: `pnpm test:native-dev` passed all 23 tests;
the delayed-output concurrency regression passed 200 repetitions (1,600 worker
processes); and `pnpm verify`, the command used by the pre-push hook, passed
with approved local socket access. This includes 9 frontend-checker tests,
23 launcher/review tests, 2 environment tests, both builds, 38 native tests,
66 Rust tests, and 32 server tests. `git diff --check` passed. No application
behavior or packaging changed; no new desktop capture was attempted.

Next action for publishing: retry the Git push after committing this correction.
The broader plan remains Active; its next investigation is still the
changed-binding rejection after recovery under the documented bounded procedure.

### Terminal-color launcher regression and publishing — 2026-10-11

The owner reported the same failure after the output-drain correction and
explicitly requested pushing until it works. The actual `git push -u origin
main` passed its enabled pre-push hook and created `origin/main`. However,
`FORCE_COLOR=1 node --test --test-name-pattern='concurrent starters'
scripts/native-dev.test.mjs` reproduced the exact failure on the corrected
tree. Console formatting decorates boolean results with ANSI escapes, so the
test cannot count them as the literal string `true`. The earlier delayed-output
reproduction identified an additional test weakness but did not establish the
cause of the owner's terminal failure.

Acceptance for this follow-up: serialize worker results as plain text, explicitly
force color in the regression worker environment, retain delayed-output coverage,
pass verification under terminal/color conditions, and confirm the corrected
commit reached GitHub through the enabled push hook. Next action: implement the
plain-text output and forced-color regression, then verify, commit, and push.
The broader capture investigation remains Active.

Implemented plain stdout serialization, with `FORCE_COLOR=1` explicitly inherited
by every worker. The forced-color regression failed before serialization changed
and passed afterward. The combined forced-color/delayed-output case passed 100
repetitions (800 workers). `FORCE_COLOR=1 pnpm test:native-dev` passed all 23
tests in a terminal, and `FORCE_COLOR=1 pnpm verify` passed the full suite in a
terminal with approved local socket access (9 checker, 23 launcher/review,
2 environment, 38 native, 66 Rust, and 32 server tests, plus both builds).
`git diff --check` passed. Next action: commit and push the verified correction
through the enabled hook, then record the remote confirmation.

Publishing follow-up is complete: correction `7834033` was pushed to GitHub's
`main` using `git push origin main` from a terminal. The enabled pre-push hook
ran the entire `pnpm verify` suite successfully before GitHub accepted the
`86725e7..7834033` update. The history secret scan covered 209 commits and found
no leaks under the existing narrow disposable-test-key exception. No hook was
bypassed. The broader capture plan remains Active; next action is still the
changed-binding recovery investigation, with the external -3811 trigger and
cross-Space coverage unresolved.

### Navbar mark as desktop app icon — 2026-10-11

The owner requested using the navbar logo as the app icon. Acceptance for this
packaging follow-up: preserve `PolarMark` geometry and colors, replace the
configured desktop icon assets, include the icon in the managed development
bundle, and verify the production macOS installer. Existing onboarding changes
and development sessions must be preserved.

Added the editable SVG source at
[`app-icon.svg`](../../../native/src-tauri/app-icon.svg), with the existing
white ring and red dot on a rounded dark background. Tauri's icon generator
produced the desktop PNG, ICNS, and ICO assets; mobile outputs were kept outside
the repository. The managed development bundle now copies `icon.icns` into
Resources and declares `CFBundleIconFile`. The owner supplied the public
production origin `https://polarserver-production.up.railway.app` for installer
verification. Next action: verify the isolated development bundle metadata,
run `pnpm verify`, and build/inspect an ad-hoc-signed production DMG.

The isolated launcher check passed: a temporary copy of the real launcher built
a development bundle whose `CFBundleIconFile` and copied ICNS bytes match the
configured icon. No existing development app was modified or restarted.
`pnpm verify` passed on the current application tree with approved local socket
access. The production DMG build is running with the supplied HTTPS origin,
production client ID, and `APPLE_SIGNING_IDENTITY=-`. Next action: inspect the
finished bundle's icon, metadata, signature, and disk-image integrity.

Icon follow-up is complete. The production command
`POLAR_ENV=production POLAR_API_BASE_URL=https://polarserver-production.up.railway.app POLAR_DESKTOP_CLIENT_ID=com.antoniopertuz.polar.desktop APPLE_SIGNING_IDENTITY=- pnpm tauri build --bundles dmg --ci`
passed and produced `native/src-tauri/target/release/bundle/dmg/polar_0.1.0_aarch64.dmg`.
Read-only inspection of the DMG confirmed the production bundle identifier,
embedded backend origin/client ID, and `CFBundleIconFile=icon.icns`; the bundled
ICNS exactly matches the generated navbar-mark icon. Its extracted PNG was
visually inspected. Configured PNG sizes/transparency and ICNS/ICO containers
were also checked. `codesign --verify --deep --strict` and `hdiutil verify`
passed; signature display confirms ad-hoc signing with no Apple team identity.
The DMG is not notarized. Development Dock appearance takes effect on the next
managed native launch; the existing session was preserved. No live production
sign-in or new desktop capture was performed.

The broader capture plan remains Active. Next action remains investigating the
changed-binding rejection under bounded recovery; the external -3811 trigger
and cross-Space coverage remain unresolved.

### One-command production installer — 2026-10-11

The owner requested the exact command `pnpm build bundle`. Acceptance: build the
macOS production DMG with the supplied Railway origin, production client ID,
current logo, and ad-hoc signing without manual environment setup; preserve
ordinary `pnpm build`; keep server credentials out of the desktop build
environment; and verify both full checks and the exact requested command.

Use a root build dispatcher and checked-in public desktop production settings.
The Tauri pre-build command runs the native package's existing frontend build,
so it must not recurse into the root bundle dispatcher. Next action: implement
the dispatcher/configuration, document usage, verify environment isolation, then
run `pnpm verify` and `pnpm build bundle` sequentially.

Implemented the root dispatcher and `native/production.json`, with the supplied
public Railway origin/client ID. Desktop packaging does not load server env
files; it removes inherited database/auth/Inngest and Apple certificate/notary
credentials and sets production plus ad-hoc signing explicitly. Added public
configuration and environment-isolation coverage to `test:environments`, and
documented the exact command in README, Authentication, and Verification.

`pnpm test:environments` passed all 4 tests. `pnpm build unexpected` rejected an
unknown argument with usage and exit 1. `pnpm verify` passed with approved local
socket access, including the existing plain build through the dispatcher. The
exact `pnpm build bundle` command is now running. Next action: verify the DMG
output and record the final result; existing icon work remains preserved.

One-command installer acceptance is complete. `pnpm build bundle` passed with
no manual environment assignments and produced
`native/src-tauri/target/release/bundle/dmg/polar_0.1.0_aarch64.dmg`. Read-only
inspection confirmed the configured production origin/client ID are embedded,
the current logo's ICNS is packaged exactly, and the production bundle identity
is correct. `codesign --verify --deep --strict` and `hdiutil verify` passed;
signature display confirms ad-hoc signing with no Apple team identity. The
installer remains unnotarized. No live production sign-in or desktop gesture
was performed. The existing capture investigation remains Active; next action
is still the changed-binding recovery investigation under its bounded procedure.

### Icon and installer commit handoff — 2026-10-11

The owner requested contextual commits. Desktop icon assets and the managed
development bundle icon are committed as `40dba4d` (`feat(native): use navbar
mark as desktop app icon`). The production dispatcher, public configuration,
environment-isolation tests, and usage documentation are committed as
`ba5c8a0` (`build(desktop): add one-command production installer`). This
verification record is kept in a separate documentation commit.

The full `pnpm verify`, exact `pnpm build bundle`, environment tests, and
installer integrity/signature checks passed earlier against this implementation.
Both implementation commits also passed the enabled `pnpm check` hook. No
credentials or generated build output were staged. No new live sign-in or
desktop capture was attempted. Next action is checking the final commit sequence
and clean working tree; the broader capture investigation remains Active with
the changed-binding recovery investigation as its next work.
