# Verification

Run commands from the repository root. Prerequisites are Node.js 22.12+, pnpm
10.10.0, the Rust toolchain with rustfmt, and platform Tauri build prerequisites.
Install JavaScript dependencies with `pnpm install --frozen-lockfile`. Server
environment variables come from the shell; `.env.example` documents them, and the
server does not load `.env` files automatically.

| Command | Evidence |
| --- | --- |
| `pnpm check:docs` | Harness paths exist, AGENTS.md stays short, local Markdown file links resolve |
| `pnpm check` | Documentation check plus TypeScript checks for native and server |
| `pnpm build` | Native production frontend and compiled server; no desktop installer |
| `pnpm check:rust` | Rust formatting and locked dependency compilation at `native/src-tauri/Cargo.toml` |
| `pnpm test:rust` | Rust tests using `native/src-tauri/Cargo.lock` |
| `pnpm --filter @polar/server test` | Fastify health response and server configuration tests |
| `pnpm verify` | Documentation, both package builds, Rust checks/tests, and server tests |
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

## Optional pre-commit hook

This folder was not a Git repository when the harness was installed. After Git
is initialized, inspect `git config --get core.hooksPath` and any existing hooks.
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
