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
| `pnpm check:rust` | Rust formatting and locked dependency compilation at `native/src-tauri/Cargo.toml` |
| `pnpm test:rust` | Rust tests using `native/src-tauri/Cargo.lock` |
| `pnpm --filter @polar/native test` | Desktop window bounds, resize recovery, reduced-motion policy, and frontend import-boundary checks |
| `pnpm --filter @polar/server test` | Fastify health response and server configuration tests |
| `pnpm test:environments` | Credential-file selection, test isolation, and desktop development configuration |
| `pnpm --filter @polar/server test:integration` | Live development Neon authentication, device approval, bootstrap, and revocation with temporary-account cleanup |
| `pnpm verify` | Oxfmt, Oxlint, documentation, both package builds, native UI geometry/motion/import-boundary tests, Rust checks/tests, and server tests |
| `pnpm dev:native` | Interactive desktop validation, including Vite and Rust command behavior |
| `pnpm native:status` | This checkout's Vite/native session and exact automation target |
| `pnpm test:native-dev` | Regression checks for instance classification and exclusive launch ownership |
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
4. Confirm status is `ready`, the selected window has the expected changed
   interface, and the changed flow works before claiming native verification.
   Frontend changes use Vite HMR; Rust changes must finish rebuilding and produce
   a new native PID. Rebind the app after native restart. Browser review verifies
   frontend behavior only; native IPC must be exercised in the selected app.
5. Read the computer tool's returned API documentation. On macOS, `getApp` can
   select/launch a bundle; do not call an unavailable `computer.launch_app` or
   supply unsupported browser visibility options. These automation errors do not
   call for Tauri capability changes. Report unavailable automation explicitly.
6. For `noWindowsAvailable`, `SCStreamErrorDomain`, or a similar window/capture
   failure, allow **one recovery attempt**: run `pnpm native:status`, discard the
   old app binding, and, only if status is `ready` with an automation target,
   bind again using its exact `automation.appPath`. Retry the failed operation
   once using fresh observations and the documented API. If status or rebinding
   fails, stop without retrying the operation. Process readiness alone does not
   establish that automation can discover, capture, or control the window.
   If the retry fails, stop native window/capture automation for this session.
   Do not continue the same failure through renamed tasks, other coordinates,
   screenshots, resize attempts, alternate APIs, or repeated rebinding. A
   successful screenshot between failures does not reset the recovery budget.
   Resume only after a concrete relevant state change, such as the user restoring
   capture access/window visibility or a required native rebuild finishing with
   a new PID; record the change first. Do not restart the app or change permissions
   just to reset the budget. Record the operation, error, app path/native PID,
   recovery attempted, and remaining smoke checks in the current task's evidence.
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

## Homescreen desktop smoke review

Use the desktop verification procedure above.

1. Confirm the default workspace has zero missions, no sample weather or notifications, and the centered message on the canvas and empty timeline in the existing desktop layout. No dark mission window should appear until a mission exists. Quick AI should open with the input focused. Close it with Escape and confirm focus returns to the island mark. The island clock should match the device's local time and advance across a minute boundary.
2. Open notifications and people; confirm empty messages. Open the launcher and Settings. Check Escape/outside dismissal and focus return. Reopen Quick AI from the island or New mission button. Context and Sources must not offer sample missions. AI responses still use the existing simulated preview; no mission persistence is implemented.
3. Inspect a large window, 800×600, and a narrow layout. Confirm content remains reachable without horizontal overflow.
4. Deadline calculations are covered by `native/tests/countdown.test.ts`: timestamp offsets, day/minute rollover, elapsed time after sleep, expiry, and absent/invalid deadlines. There is no deadline on the empty workspace. Mission components and fixtures remain in source for future data wiring; no runtime demo is available.

Browser preview verifies frontend behavior only. It does not verify native provider commands. No packaging paths changed, so this change does not require `pnpm tauri build`.

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
