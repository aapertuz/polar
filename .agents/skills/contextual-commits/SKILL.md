---
name: contextual-commits
description: Commit requested repository changes in coherent groups with Conventional Commit messages. Use when asked to commit work or organize pending changes into commits.
---

# Contextual commits

Create commits that each tell one coherent change story. A feature or fix may include its source, tests, documentation, and plan updates in the same commit. Split independent changes even when they share a directory; do not split one change just because its files have different types.

## Before staging

1. Read `AGENTS.md`, `docs/VERIFICATION.md`, and any active execution plan for the work. Inspect `git status --short`, staged and unstaged diffs, untracked files, and recent commit subjects.
2. Identify which changes the user asked to commit. Preserve unrelated work and any pre-existing staged content. When ownership or intent is unclear, inspect the relevant code or ask for scope before including it.
3. Map the requested changes into independently understandable groups. Keep coupled implementation, tests, documentation, and lockfile changes together. Order commits so each snapshot makes sense on its own.

## Stage and commit each group

1. Stage exact paths or hunks for one group. Avoid `git add .` and broad globs in a mixed working tree. If pre-existing staged content would contaminate the commit, isolate the intended snapshot without discarding or silently unstaging the user's work.
2. Inspect `git diff --cached --check`, `git diff --cached --stat`, and the full staged diff. Confirm the staged content matches the group's intent and contains no unrelated files, secrets, or generated output.
3. Run the verification required by `docs/VERIFICATION.md` for the changes being committed. The Git hooks check the working tree, so they do not prove a partial staged snapshot is valid. Address failures before committing; report checks that could not run.
4. Write a Conventional Commit subject: `type(scope): imperative summary`. Use a type matching the change, such as `feat`, `fix`, `refactor`, `docs`, `test`, `build`, `ci`, or `chore`. Omit the scope if it adds no clarity. Use a body when the reason or a meaningful tradeoff is not clear from the subject; use `BREAKING CHANGE:` for incompatible behavior.
5. Commit, inspect the resulting commit and remaining `git status --short`, then repeat for the next group. If a hook rejects a commit, fix the cause and recheck the staged snapshot. Do not bypass hooks merely to finish.

Report commit hashes and subjects, verification actually run, and any requested changes left uncommitted with the reason.
