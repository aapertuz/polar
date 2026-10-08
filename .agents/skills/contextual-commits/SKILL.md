---
name: contextual-commits
description: Commit requested repository changes in coherent groups with Conventional Commit messages. Use when asked to commit work or organize pending changes into commits.
---

# Contextual commits

Create a small sequence of reviewable commits, each telling one coherent change story. A feature or fix may include its directly related source, tests, and documentation in the same commit. A multi-layer implementation can still need several commits: do not combine setup/configuration, backend/data work, desktop/UI work, and broad documentation merely because one plan delivered them. Split independent concerns even when they share a directory; do not split one concern only because its files have different types.

Prefer commits organized around a single implementation boundary or prerequisite, such as environment/tooling setup, server/data behavior, desktop behavior, and plan/setup documentation. Put a test with the behavior it covers. Keep a lockfile with the dependency change that updates it. Order commits so prerequisites come first and each commit is understandable from its subject and diff. Avoid arbitrary file-count limits, but if a reviewer must understand several separate layers to assess a commit, split it further.

## Before staging

1. Read `AGENTS.md`, `docs/VERIFICATION.md`, and any active execution plan for the work. Inspect `git status --short`, staged and unstaged diffs, untracked files, and recent commit subjects.
2. Identify which changes the user asked to commit. Preserve unrelated work and any pre-existing staged content. When ownership or intent is unclear, inspect the relevant code or ask for scope before including it.
3. Map the requested changes into independently understandable groups before staging. For work spanning multiple layers, write down a proposed subject and exact path set for each commit. Keep coupled implementation, its tests, and any essential usage documentation together; place broad plan progress, environment setup, or unrelated follow-up docs in their own commit when they describe a separate concern. Order commits so prerequisites come first and each snapshot makes sense on its own.

## Stage and commit each group

1. Stage exact paths or hunks for one group. Avoid `git add .` and broad globs in a mixed working tree. If pre-existing staged content would contaminate the commit, isolate the intended snapshot without discarding or silently unstaging the user's work.
2. Inspect `git diff --cached --check`, `git diff --cached --stat`, and the full staged diff. Confirm the staged content matches the group's intent and contains no unrelated files, secrets, or generated output.
3. Verify the staged work without creating a test loop. Run focused checks for a commit's changed behavior when needed, but do not repeat the same full suite for every commit in a sequence. Run the repository-required aggregate verification once against the final implementation snapshot (and the relevant live or desktop checks once when required). If a commit hook repeats a check automatically, count that result and do not run it again without a failure or new change. The Git hooks check the working tree, so they do not prove a partial staged snapshot is valid; inspect staged diffs and ensure intermediate commits remain coherent. Address failures before committing and report checks that could not run.
4. Write a Conventional Commit subject: `type(scope): imperative summary`. Use a type matching the change, such as `feat`, `fix`, `refactor`, `docs`, `test`, `build`, `ci`, or `chore`. Omit the scope if it adds no clarity. Use a body when the reason or a meaningful tradeoff is not clear from the subject; use `BREAKING CHANGE:` for incompatible behavior.
5. Commit, inspect the resulting commit and remaining `git status --short`, then repeat for the next group. If a hook rejects a commit, fix the cause and recheck the staged snapshot. Do not bypass hooks merely to finish. When splitting a commit that was just created in the current task, preserve its content and parent history, then verify the final commit sequence and working tree.

Report commit hashes and subjects, verification actually run, and any requested changes left uncommitted with the reason.
