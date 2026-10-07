# Verification

Run commands from the repository root. Prerequisites are Node.js 22.12+, pnpm
10.10.0, Rust 1.89+ with rustfmt, and platform Tauri build prerequisites.
Install JavaScript dependencies with `pnpm install --frozen-lockfile`. Server
environment variables come from the shell; `.env.example` documents them, and the
server does not load `.env` files automatically.

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
| `pnpm verify` | Oxfmt, Oxlint, documentation, both package builds, native UI geometry/motion/import-boundary tests, Rust checks/tests, and server tests |
| `pnpm dev:native` | Interactive desktop validation, including Vite and Rust command behavior |
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

## Homescreen desktop smoke review

Run `pnpm dev:native`. The homescreen uses immutable sample data and ephemeral UI state.

1. Check the default F1 Pilot view, then select US Sales and Product. Confirm title, facts, tabs, context, and timeline change together.
2. Drag mission and timeline by their headers, overlap them, and move partly offscreen. Resize to 800×600 and back; confirm the headers remain reachable. Use Move window with arrow keys, Shift for precision, and Escape to cancel; use Window controls → Reset layout.
3. Open each rail/island preview, the proposal preview, calendar, and timeline details. Check Escape/outside dismissal and focus return. Search should focus its input. Tab navigation and compact timeline must keep keyboard focus within their open surface.
4. Inspect 1672×941, 1440×900, 1280×800, 1024×768, 800×600, and a narrow single-column layout. Internal scrolling should reveal content without horizontal page overflow.
5. With permission, temporarily enable macOS Accessibility → Motion → Reduce motion. Exercise tabs and previews, then restore the original setting. Policy tests additionally check that spatial reveals and scaling are removed.

These manual scenarios do not establish backend behavior or automated pointer-gesture coverage. No application packaging changed, so the homescreen change does not require `pnpm tauri build`.

## Provider connection smoke review

Run `pnpm dev:native` and open launcher → Settings. If another development server
already occupies port 1420, use its running desktop instance rather than starting
a second Vite server.

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
   registration. Quick AI should still show its sample preview.

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
