# Working in Polar

Polar is a pnpm monorepo with a Tauri 2 desktop app and a Fastify server. Inspect current code before assuming product behavior.

## Map

* `native/`: Tauri 2 desktop application with React 19, TypeScript, and Vite.
* `native/src/`: React UI; `native/src/App.tsx` mounts the fixture-based homescreen in `pages/home/`.
* `native/src-tauri/`: Rust application, Tauri configuration, and capabilities.
* `server/`: TypeScript Fastify application; `server/src/app.ts` configures the server.
* `pnpm-workspace.yaml`: the `@polar/native` and `@polar/server` workspace packages.
* [Documentation index](docs/README.md): project knowledge and workflow entry points.
* [Product requirements](docs/PRODUCT.md): intended behavior, terminology, scope, and non-goals. Read before defining or changing product behavior.
* [Target architecture](ARCHITECTURE.md): system boundaries, data ownership, and execution flows. Read before changing interfaces, persistence, dependencies, or responsibilities across modules.
* [Design system](docs/DESIGN.md): UI hierarchy, components, tokens, interaction, and accessibility. Read before any UI or visual change; reuse existing components and documented tokens.
* [Execution plans](docs/PLANS.md): when to plan and how to resume work.
* `docs/changes/`: optional change specifications for large or ambiguous work.
* [Verification](docs/VERIFICATION.md): commands, limitations, and optional hooks.
* [Local procedures](.agents/skills/README.md): add skills when procedures repeat.

The three documents above are owner-maintained project references. Do not modify them unless explicitly requested. If implementation requires a durable change to them, record the proposed change in the execution plan or final report for the owner to resolve.

* [Hooks](docs/HOOKS.md): automatic Git and Codex checks, setup, and troubleshooting. Hooks supplement verification; run the checks required by docs/VERIFICATION.md even when hooks are inactive. The Codex Stop hook formats changed source and checks documentation.

`ARCHITECTURE.md` describes a target architecture and includes proposed paths and provisional choices. Inspect the repository to establish what is implemented; do not treat planned components as existing or implement future scope merely because it is documented.

Explicit user instructions and product requirements define intended behavior. Current code and tests describe existing behavior. When they conflict, investigate the discrepancy rather than silently choosing one as authoritative.

## Operating policy

1. Inspect the code directly involved in the change, its callers and dependencies, related tests, linked documentation, and existing changes before editing. Expand the search when a change crosses module, frontend/native, persistence, or product boundaries. Preserve unrelated work, follow established conventions, and keep changes focused.

2. Before starting implementation, check `docs/exec-plans/active/` for a plan covering the requested work. Resume and update that plan instead of creating a duplicate. For a clear change confined to one area, work directly or use a short conversational plan. Create a saved plan when work spans multiple sessions, requires coordinated changes across boundaries, or involves a migration or unresolved implementation risks. Use `docs/exec-plans/active/YYYY-MM-DD-short-name.md` and the template in [docs/PLANS.md](docs/PLANS.md). Record acceptance criteria before implementation.

   During planning, distinguish explicit requirements, decisions supported by project documentation, and agent proposals. Do not present inferred interaction behavior or added features as settled acceptance criteria. Clarify consequential ambiguities before finalizing the plan; routine implementation choices may be resolved autonomously. Unreviewed proposals must remain visibly labeled in the saved plan.

3. Add a change spec at `docs/changes/YYYY-MM-DD-short-name.md` when the intended behavior, scope, or acceptance criteria need clarification beyond the execution plan. Use the template in [docs/changes/README.md](docs/changes/README.md) and link the spec from the plan. A spec is optional when the request and plan already define the outcome. Resolve uncertainty through code and documentation first; ask the user when an unresolved decision changes intended behavior, scope, or compatibility, and continue independent work while waiting.

4. Update the active plan after each completed step or material decision, and before ending a session. Record progress, decisions and reasons, verification commands and results, blockers, and the next action. Keep unfinished or blocked plans in `active/`, with their status and remaining work explicit.

5. Once all acceptance criteria are verified, set the plan status to Complete and move it to `docs/exec-plans/completed/`, keeping its filename. Repair links to and from the moved plan. Record non-blocking follow-up work in `docs/exec-plans/tech-debt-tracker.md`; unmet acceptance criteria keep the plan active. Mark any associated spec Complete and update its plan link. Copy lasting decisions into the relevant current docs, respecting the owner-provided document restriction above. Completed plans are historical context; confirm their claims against current code, docs, and user requirements before reusing them.

6. Use pnpm for frontend dependencies and Cargo for Rust dependencies. Keep `pnpm-lock.yaml` and `native/src-tauri/Cargo.lock`; update them through their package managers when dependencies change. Do not edit generated output in `native/dist/`, `server/dist/`, `native/src-tauri/target/`, or `native/src-tauri/gen/schemas/`.

7. Validate external input in Rust command handlers before performing native operations. Grant only the Tauri capabilities needed by the requested behavior. When changing a command name, arguments, return value, or error behavior, update and verify both the frontend caller and Rust handler.

8. For documentation-only changes, run `pnpm check:docs`. For application or build-tooling changes, run `pnpm verify` and tests covering the changed behavior. Exercise changed desktop behavior with `pnpm dev:native`; use `pnpm tauri build` when packaging is affected. Follow [docs/VERIFICATION.md](docs/VERIFICATION.md). If a check cannot run, report the command, reason, and remaining verification rather than treating it as passed.

9. Report what changed, checks actually run, and remaining gaps. Never describe skipped checks or zero discovered tests as tested behavior.

10. When the same failure recurs, add a regression test or deterministic check where feasible. Correct misleading documentation when it contributed to the failure. Add a skill under `.agents/skills/<procedure-name>/SKILL.md` only for a repeated specialized procedure, following [.agents/skills/README.md](.agents/skills/README.md).

## Quick commands

* `pnpm dev:native`: desktop development, including its Vite server.
* `pnpm dev:server`: Fastify development server with reload.
* `pnpm dev`: launch both applications with coordinated shutdown.
* `pnpm tauri dev` / `pnpm tauri build`: run Tauri CLI commands from the repository root; the script targets `native/`.
* `pnpm format`: format supported source and config files with Oxfmt.
* `pnpm lint`: lint frontend, server, and scripts with Oxlint.
* `pnpm check`: formatting, lint, documentation, and both package TypeScript checks.
* `pnpm verify`: formatting, lint, docs, builds, native/server tests, and Rust checks/tests.

Keep this file a concise map. Put detailed procedures in linked documents.
