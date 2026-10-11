# Verification

Run commands from the repository root. Prerequisites are Node.js 22.12+, pnpm
10.10.0, Rust 1.89+ with rustfmt, and platform Tauri build prerequisites.
Install JavaScript dependencies with `pnpm install --frozen-lockfile`. Server
environment variables come from the selected root `.env.development.local` or
`.env.production.local`, or an explicitly scoped shell. See
[Authentication](AUTHENTICATION.md) and `server/.env.example`. Commands no longer
load the legacy `.env.local` automatically. Unit tests strip real credentials;
live authentication/database tests must use development.

| Command | Evidence |
| --- | --- |
| `pnpm format` | Formats supported source and config files with Oxfmt |
| `pnpm format:check` | Checks supported source and config files without changing them |
| `pnpm lint` | Oxlint correctness rules for frontend, server, and scripts |
| `pnpm check:docs` | Harness paths exist, AGENTS.md stays short, local Markdown file links resolve |
| `pnpm check:frontend` | AST checks local source aliases, named JSX event/ref handlers, hook composition, and registry rendering |
| `pnpm test:frontend-check` | Regression fixtures prove the frontend checker rejects prohibited patterns and permits render-only JSX |
| `pnpm check` | Oxfmt check, Oxlint, documentation and frontend checks, checker regression tests, and TypeScript checks for native and server |
| `pnpm build` | Native production frontend and compiled server; no desktop installer |
| `pnpm build bundle` | Production macOS DMG using `native/production.json` and ad-hoc signing; no notarization |
| `pnpm check:rust` | Rust formatting and locked dependency compilation at `native/src-tauri/Cargo.toml` |
| `pnpm test:rust` | Rust tests using `native/src-tauri/Cargo.lock` |
| `pnpm --filter @polar/native test` | Desktop window bounds, resize recovery, reduced-motion policy, and frontend import-boundary checks |
| `pnpm --filter @polar/server test` | Fastify health response and server configuration tests |
| `pnpm test:environments` | Credential-file selection, test isolation, and desktop development/production build configuration |
| `pnpm --filter @polar/server test:integration` | Live development Neon authentication, device approval, bootstrap, and revocation with temporary-account cleanup |
| `pnpm verify` | Oxfmt, Oxlint, documentation, both package builds, native UI geometry/motion/import-boundary tests, Rust checks/tests, and server tests |
| `pnpm dev:native` | Interactive desktop validation, including Vite and Rust command behavior |
| `pnpm native:status` | This checkout's Vite/native session and exact automation target |
| `pnpm test:native-dev` | Regression checks for instance classification, exclusive launch ownership, window raising, and bounded capture recovery |
| `pnpm dev:server` | Fastify development server with reload |
| `pnpm dev` | Both applications with sibling process cleanup |
| `pnpm tauri build` | Platform-specific desktop packaging; required when packaging paths change |

For documentation-only changes, `pnpm check:docs` is sufficient. For application
changes, run `pnpm verify` and relevant behavior checks. Report prerequisite
failures and zero-test runs accurately; skipped checks are not tested behavior.

For native command changes, exercise success and failure through the actual
desktop app. For UI changes, inspect the changed flow at relevant window sizes.
Browser preview alone does not verify Tauri commands. Generated output in
`native/dist/`, `server/dist/`, `native/src-tauri/target/`, and
`native/src-tauri/gen/schemas/` must not be treated as source.

## Desktop verification procedure

Use this procedure before any desktop smoke review. The supported launcher is
`pnpm dev:native` (also used by `pnpm dev`). Direct `pnpm tauri dev` bypasses the
guard and macOS development identity; reserve it for explicit CLI debugging.

1. Run `pnpm native:status`. It inspects processes and port 1420, and probes the
   Vite server for its checkout identity. Inspection permission failures are
   blockers, not evidence that no development process exists.
2. Reuse a `ready` session. For `starting`, wait for compilation and check status
   again. For `stopped` or `vite-only`, run `pnpm dev:native`; it starts only the
   missing parts and holds exclusive launch ownership through startup/rebuilds.
   A repeated invocation reports the existing session without launching anything.
   For `port-conflict` or `native-only`, resolve the reported session first;
   never kill a process just because it occupies the port. Existing unguarded
   sessions can be reviewed manually; switch launchers only after their owner
   stops them. Preserve sessions you did not start.
3. On macOS, select the exact `automation.appPath` reported by status using
   `cua.getApp(appPath)`. The ignored `.polar-dev/Polar Dev.app` has identity
   `com.antoniopertuz.polar.dev`; Cargo refreshes its executable on each native
   launch, including Tauri watcher restarts. A packaged `polar.app` is a snapshot
   and does not follow live Vite changes. Name-only `polar` selection and raw
   `target/debug/polar` selection are not reliable automation targets.
   After reading the returned tool documentation, use
   [the desktop review helper](../scripts/desktop-review.mjs) in `cua_repl`.
   Assign the actual JSON from the latest status command to `nativeStatus`, then:

   ```js
   var desktopReviewModule = await import(nativeStatus.root + '/scripts/desktop-review.mjs');
   var review = await desktopReviewModule.createDesktopReview(cua, nativeStatus);
   ```

   Use this helper for the entire review, including when the app was already
   running. It caches the single observed AX standard window and invokes its
   documented `Raise` action **before the next observation**, without taking a
   new capture just to discover Raise. Initial `getApp` and window discovery
   themselves can fail: macOS exposes no capture-free observation through the
   current public CUA API. Across turns the tool can mark a binding inactive.
   For that exact pre-action rejection, the helper refreshes the binding and
   indices once before Raise; it preserves the capture-recovery budget. Raising is a visibility mitigation, not a guarantee
   that the external capture service will work.
   Use `review.app` for actions, `await review.observe()` for AX state, and
   `await review.capture()` for one combined AX/screenshot observation. All
   exposed actions and observations share the same failure budget. Observe and
   re-derive indices between actions, particularly between editing and Save;
   do not retain a raw app binding or recreate the helper to reset its automatic
   budget. Explicit user retry instructions follow step 6.
   Polar also handles macOS reopen events by showing the app and restoring/focusing
   its main window. A running process with a minimized window must become usable
   when selected again; do not equate a live PID with a discoverable window.
4. Confirm status is `ready`, the selected window has the expected changed
   interface, and the changed flow works before claiming native verification.
   Frontend changes use Vite HMR; Rust changes must finish rebuilding and produce
   a new native PID. Rebind the app after native restart. Browser review verifies
   frontend behavior only; native IPC must be exercised in the selected app.
5. Read the computer tool's returned API documentation. On macOS, `getApp` can
   select/launch a bundle; do not call an unavailable `computer.launch_app` or
   supply unsupported browser visibility options. These automation errors do not
   call for Tauri capability changes. Report unavailable automation explicitly.
   On macOS, AX observations also request a screenshot internally: `getApp`,
   `getAXState`, `getScreenshot`, and `getAXStateAndScreenshot` all use the
   installed adapter's `get_app_state` operation. AX is useful for selecting
   controls but does not bypass capture errors. When both forms of evidence are
   needed, use one combined observation instead of multiple captures. Before
   live feature checks, establish their prerequisites once: development API,
   Polar sign-in, correct workspace/role, and provider/worker when needed. Missing
   prerequisites are separate from capture failures; a member-only view or an
   unauthenticated session cannot establish owner editing or mission creation.
6. For `noWindowsAvailable`, `SCStreamErrorDomain`, or a similar window/capture
   failure, allow **one recovery attempt**. Run `pnpm native:status`; with the
   helper, assign its fresh JSON to `nativeStatus`, then call
   `await review.recoverCapture(nativeStatus)`. On the same PID it first attempts
   Raise using the last observed window, then rebinds the exact app and obtains
   one combined observation. A new PID requires discovering new AX indices.
   These operations can themselves fail. An explicit "Computer Use is not
   active ... get_app_state" response permits the already-budgeted rebind before
   Raise; it does not require another recovery. Other Raise errors, status,
   binding, or capture failures stop recovery. Do not bypass the helper.
   An action may apply before its tool call fails. A successful recovery does
   **not** authorize replaying an edit or Save: inspect fresh state and confirm
   the committed result before deciding what work remains. Never blindly replay
   mutations. Process readiness does not establish capture or control readiness.
   A successful observation between failures does not reset the budget. Any
   later action or observation failure blocks the helper. Do not continue through
   renamed tasks, alternate APIs, screenshots, coordinates, resizes, or rebinding.
   An explicit user instruction such as "try again" authorizes one fresh attempt
   even when the native PID is unchanged. Honor that instruction; record the user
   message and fresh status, then call `review.retryCapture(nativeStatus, requestId)`
   with a stable ID for that message (for example `user-retry-2026-10-08-15:19`).
   Reusing that ID cannot repeat the attempt. A manual retry does not replenish
   automatic recovery or authorize replaying a mutation. If no review object is
   available in that session, or its cached version lacks `retryCapture`, bind
   the exact app once and obtain one combined observation under the same explicit
   instruction; stop if it fails and retain that the automatic budget is spent.
   Without an explicit user retry request, resume after a concrete relevant
   change and record the change first. An unchanged PID establishes only process
   identity; do not treat it as proof that capture remains broken. Do not restart
   the app or change permissions just to reset the budget.
   Record the failed operation, full error/cause, app path/native PID,
   `review.evidence`, recovery attempted, and remaining checks. Initial binding
   or discovery failure means no safe window index has been established: stop.
   The explicit inactive-binding rejection is a pre-action protocol condition.
   The helper refreshes it once during observation and uses newly discovered
   indices; a rejected edit/Save is never replayed. Call `review.observe()` and
   decide the next action from that state. Refresh failures retain the normal
   capture budget; repeated inactive rejection stops rather than looping.
   Continue independent checks; browser results cannot close native acceptance
   criteria, and unfinished native criteria must remain explicitly unverified.
7. Stop only development sessions you launched, via their terminal's Ctrl+C.
   The launcher forwards shutdown to its child process group. If a crash leaves
   an unreadable ownership file, inspect status/processes before removing the
   reported `.polar-dev/session.json` or its `.guard` directory. Never remove
   ownership belonging to a live session.

The development bundle changes macOS discovery identity only. Tauri's application
identifier, application data directory, and credential service names remain the
same. The status/launch guard supports macOS and Linux with `ps` and `lsof`;
the distinct bundle target applies to macOS. Windows inspection is not implemented.

### Diagnosing macOS capture failures

`SCStreamErrorDomain -3811` is an internal video/audio capture failure, not a
permission diagnosis. The macOS SDK distinguishes declined authorization (-3801)
and missing entitlements (-3803). On 2026-10-08, local logs for the workspace
review failure showed `failed display lookup for windowBounds`, `cgError=0
found=0`: the computer-use helper could not map its selected window to a display.
The exact bounds were private, so off-Space and stale-window selection remain
possible triggers. The original helper captured before raising, since its AX
window discovery also triggered capture. The corrected helper raises a cached
standard window before subsequent observations and accounts for action errors,
but cannot repair initial binding failure inside the external service. Do not change Polar's Tauri capabilities, reset macOS privacy
permissions, or restart unrelated apps based on this generic error.

For a recurrence, inspect a short log interval around its recorded timestamp:

```sh
/usr/bin/log show --last 10m --info --debug --style compact --predicate 'process == "SkyComputerUseService" AND eventMessage CONTAINS "failed display lookup"'
```

The error belongs to the capture helper; `pnpm native:status` establishes process
identity only. Request shell inspection escalation if `ps`, `lsof`, or local
socket checks fail under the sandbox. An approved rerun is a distinct check;
record its result. A successful capture must still visibly show the expected
interface; blank, stale, or incomplete frames do not verify UI appearance.

## Homescreen desktop smoke review

Use the desktop verification procedure above.

1. Confirm the initial workspace has no sample weather or notifications. No mission window should appear until there is a persisted mission or a proposal being reviewed. Quick AI should open with its goal input focused. Close it with Escape and confirm focus returns to the island mark. The island clock should match the device’s local time and advance across a minute boundary.
2. Create a draft, attach a text PDF, DOCX, Markdown, or text file before entering the goal, then close and reopen Quick AI. Confirm the draft and extracted context return. Also add pasted context, remove a source, and verify the next inference uses only the remaining context. Unsupported, corrupt, scanned-only, invalid UTF-8, and oversized files should show an actionable extraction error; originals remain local.
3. With a connected ChatGPT account and selected model, send a goal and context. Confirm clarification appears in the conversation, answer it, and wait for a structured proposal. Review it in the existing mission window, refine it, and verify the old proposal cannot activate. Review the replacement proposal and activate it. The new mission and its dependency-ready next action should appear on Home. A provider request uses the selected account’s allowance.
4. Restart the desktop and confirm the activated mission, next action, draft conversation, and source metadata remain. Test cancellation, provider failure and retry, unavailable server, and waiting for the authorized desktop worker. Check keyboard navigation through attach, paste, review, refine, and activate controls, including visible focus and focus return. Check reduced motion.
5. Inspect a large window, 800×600 points, and a narrow layout. Confirm content remains reachable without horizontal overflow. Account for backing scale: on a 2× display an 800×600-point window produces a 1600×1200-pixel original screenshot. Do not infer point dimensions from drag endpoints alone; confirm window bounds and scale through an authorized diagnostic or the OS before recording size acceptance.
6. Deadline calculations are covered by `native/tests/countdown.test.ts`: timestamp offsets, day/minute rollover, elapsed time after sleep, expiry, and absent/invalid deadlines. Missions without a deadline should not show a fabricated countdown.

Browser preview verifies frontend behavior only. It does not verify native provider commands. No packaging paths changed, so this change does not require `pnpm tauri build`.

## Mission scheduling smoke review

Follow the desktop verification procedure above. Both initial creation and
regeneration use interpretation followed by a separate scheduling request with
the selected account/model. Clarification uses only interpretation. No candidate
proposal should appear until scheduling succeeds; either request may fail or be
cancelled without publishing a partial plan.

1. Create a synthetic mission with a deadline and actions that depend on each
   other. Inspect a proposal's checkpoint deadlines and earliest-first order.
   Action completion dates must fall on or before their checkpoint deadlines;
   prerequisite actions must appear before their dependents. Same-day actions
   are allowed. Check that dates inferred by Polar appear as proposed assumptions.
2. Check the first recommendation against the first dependency-ready action.
   In Plan, verify exact checkpoint/action dates at normal and compact sizes.
   In Timeline, local day 0 is Today, day 1 Tomorrow, days 2–6 Next, and day 7
   onward Upcoming. Past dates remain overdue; older undated work stays Upcoming.
3. Regenerate a synthetic saved mission. Review its revised schedule before
   applying, then reopen it and confirm checkpoint/action deadlines persist.
   Do not replace a user's live mission merely to test. Older saved missions
   receive a schedule only after regeneration and reviewed application.
4. Exercise cancellation and failure during scheduling. Preserve the saved
   mission and verify retry gives a new reviewed proposal. Review unrealistic
   or conflicting dates; Polar must not silently relax fixed commitments.

Automated coverage lives in Rust's provider scheduling/pipeline tests,
`native/tests/action-timing.test.ts`, `native/tests/plan-dates.test.ts`,
`server/tests/mission-scheduling.test.ts`, and development mission integration
tests. Deterministic tests establish protocol, date, order, and persistence
behavior; they do not establish the actual model's scheduling quality.

## Provider connection smoke review

Use the desktop verification procedure above and open launcher → Settings.

1. At 800×600 and a larger window, check Settings scrolling, keyboard focus,
   dismissal, and focus return to the launcher. Browser preview should explain
   that connection requires the desktop app.
2. Select Continue with ChatGPT. Verify the official browser sign-in opens and
   Cancel returns Settings to an idle state without saving an account. Cancelled
   or rejected callbacks must not show a connected account.
3. With the user's account, complete browser consent. Verify the first-use plan
   notice, account label, and model catalog. Select a model and test connection;
   only completed inference should report success. This consumes plan allowance.
4. Restart Polar. Verify the saved account/model, stable registration, and hidden
   first-use notice. Add another registration, including the same email when
   available; switch accounts and verify model selection belongs to each account.
5. Exercise expired/revoked access and reconnect. Check actionable quota, denied
   access, and network errors; no request should switch billing routes. Inspect
   that logs and IPC contain no tokens. Test renewal with a genuinely expiring
   session; do not manufacture credentials in plaintext to force this scenario.
6. Cancel a test, then disconnect. Verify local tokens remain cleared even if
   remote revocation cannot be confirmed, and reconnect uses the same saved
   registration. The empty workspace should remain available after disconnecting.

Protocol unit tests supplement these scenarios. Report live scenarios that were
not performed; opening the browser alone does not prove subscription access.

## Optional pre-commit hook

Inspect `git config --get core.hooksPath` and any existing hooks.
If no hook system exists, activate the included hook with:

```sh
git config --local core.hooksPath .githooks
```

If hooks already exist, integrate `pnpm check` with them instead of replacing
them. The supplied hook checks the working tree, including unstaged changes; it
does not prove that a partially staged snapshot is valid. Run `pnpm verify`
before sharing code. Future CI can call the same command on the target platform.
No hosted CI provider or global agent hook configuration is assumed.

The documentation check validates file targets, not Markdown heading anchors,
external URLs, or the truth of prose. Review those when changing documentation.
