# Verification

Run commands from the project root. Prerequisites are Node/pnpm, the Rust toolchain
with rustfmt, and the platform's Tauri build prerequisites. Use
`pnpm install --frozen-lockfile` to install frontend dependencies.

| Command | Evidence |
| --- | --- |
| `pnpm check:docs` | Harness paths exist, AGENTS.md stays short, local Markdown file links resolve |
| `pnpm check` | Documentation check plus TypeScript type checking |
| `pnpm build` | TypeScript checking and production frontend bundle |
| `pnpm check:rust` | Rust formatting and locked dependency compilation |
| `pnpm test:rust` | Existing Rust tests; initially there are none |
| `pnpm verify` | All documentation, frontend build, and Rust checks above |
| `pnpm tauri dev` | Interactive desktop validation |
| `pnpm tauri build` | Platform-specific packaging; use when packaging is affected |

For documentation-only changes, `pnpm check:docs` is sufficient. For application
changes, run `pnpm verify` and relevant behavior checks. Add regression tests for
meaningful behavior changes. Report prerequisite failures and zero-test runs
honestly; never silently skip a check and report full verification.

For native command changes, exercise success and failure through the actual
desktop app. For UI changes, inspect the changed flow at relevant window sizes.
Record scenarios and outcomes in the plan or final report. Browser preview alone
does not verify Tauri commands. Generated output must not be treated as source.

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
