# Project hooks

## Git

- `pre-commit`: `pnpm check` (formatting, lint, documentation, frontend convention checks, and TypeScript checks).
- `pre-push`: `pnpm verify` (checks, builds, native tests, Rust checks/tests, server tests).
  Deletion-only pushes skip verification.

Both run from the repository root and propagate failures. They check the current
working tree, not an isolated staged or pushed commit. Partial commits and pushes
of other revisions still need checks against those revisions; CI should run
`pnpm verify` on the actual commit. Hooks do not stage, stash, format, or commit.

Activate per checkout with `git config --local core.hooksPath .githooks` after
checking existing hook configuration. The installer refuses to replace a different
hook path or custom default hooks. Do not bypass failures to claim verification.
To disable these Git hooks, unset that local key only if it still equals `.githooks`.

## Codex

`.codex/hooks.json` uses `scripts/codex-hooks.mjs`:

- `SessionStart` on startup, resume, clear, or compact: supplies a short document
  map and active-plan filenames. It does not load entire plans into context.
- `Stop`: runs the dependency-free documentation checker with a ten-second limit.
  Before checking docs, it runs Oxfmt on changed supported source and config files
  in the working tree. On documentation failure, it requests one repair pass;
  subsequent failure becomes a warning. Plan mode receives warnings only. The hook
  never runs a full build or claims that application tests passed. Pre-existing
  documentation or source changes can be formatted when they are still uncommitted.

Requires Git, Node, and a Codex release supporting these events. The project config
explicitly enables hooks. Open a fresh Codex session in this trusted project and
use `/hooks` in Codex CLI to review and trust the definitions. Installation does
not grant hook trust. Managed policy can disable project hooks. Disable these
hooks individually through `/hooks` when needed. Existing user/plugin hooks still
run independently; this setup does not replace them.

No hook grants tool permissions, reads secrets or transcripts, sends messages,
changes plans automatically, or runs checks after every edit. Hooks are feedback;
AGENTS.md remains the operating policy. Full verification and desktop smoke tests
remain the agent's responsibility.

Configuration reference: [OpenAI hooks documentation](https://learn.chatgpt.com/docs/hooks).

## Optional secret review before publishing

Install Gitleaks separately, then run from the repository root:

```sh
gitleaks git --log-opts='--all --full-history -m' --redact=100
gitleaks git --pre-commit --staged --redact=100
```

The first command checks Git history, including merge diffs; the second checks
staged changes. These scans are separate from `pnpm verify` and are not run by
the current Git hooks. Review untracked files and ignore rules before staging.
Local environment files, Neon credentials, signing material, credential folders,
databases, and build output belong outside the committed tree. Ignore rules do
not remove files that were previously committed.

The repository's [Gitleaks configuration](../.gitleaks.toml) retains the default
rules and permits only the disposable RSA private-key fixture used inside the
OAuth unit-test module. Other rules still scan that fixture, and the private-key
rule remains active for other paths. These fixture keys must never be used as
real credentials. A clean scan is evidence from known detection rules, not a
guarantee that every possible secret has been detected.
