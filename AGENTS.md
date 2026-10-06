# Working in Polar

Polar is a pnpm monorepo with a Tauri 2 desktop app and a Fastify server. Inspect current code before assuming product behavior.

## Map

- `native/`: Tauri 2 desktop application with React 19, TypeScript, and Vite.
- `native/src/`: React UI; `native/src/App.tsx` currently calls the Rust `greet` command.
- `native/src-tauri/src/`: native application and command handlers.
- `native/src-tauri/tauri.conf.json`: desktop configuration and build integration.
- `native/src-tauri/capabilities/`: native permission scopes.
- `server/`: TypeScript Fastify application; `server/src/app.ts` configures the server.
- `pnpm-workspace.yaml`: the `@polar/native` and `@polar/server` workspace packages.
- [Documentation index](docs/README.md): project knowledge and workflow entry points.
- [Execution plans](docs/PLANS.md): when to plan and how to resume work.
- [Verification](docs/VERIFICATION.md): commands, limitations, and optional hooks.
- [Local procedures](.agents/skills/README.md): add skills when procedures repeat.

The owner will supply `docs/product.md`, `docs/architecture.md`, and
`docs/design.md`. Read them when present; do not create or change them unless
explicitly requested. Missing docs are unknowns, not permission to invent requirements.

## Operating policy

1. Inspect relevant code, docs, and existing changes before editing. Preserve
   unrelated work. Follow established conventions and keep changes focused.
2. Small, clear tasks need no saved plan. Use a short conversational plan for
   medium tasks. Save an execution plan for complex or multi-session work.
3. For large ambiguous work, capture intent and acceptance criteria in an optional
   change spec before implementation. Ask only about decisions that block progress.
4. Keep plans current with decisions, progress, and evidence. Promote durable
   knowledge into docs; archive completed plans after acceptance criteria are met.
5. Use pnpm and preserve `pnpm-lock.yaml` and `native/src-tauri/Cargo.lock`. Do not edit
   generated output in `native/dist/`, `native/src-tauri/target/`, or `native/src-tauri/gen/schemas/`.
6. Validate inputs at native command boundaries; keep native permissions narrow.
   Check both callers and handlers when changing the frontend/native contract.
7. Run checks appropriate to the change. For code changes, use `pnpm verify`;
   exercise changed desktop behavior in Tauri as well. A build is not a UI test.
8. Report what changed, checks actually run, and remaining gaps. Never describe
   skipped checks or zero discovered tests as tested behavior.
9. Turn recurring failures into a focused test, check, documentation correction,
   or specialized skill. Avoid speculative abstractions and process scaffolding.

## Quick commands

- `pnpm dev:native`: desktop development, including its Vite server.
- `pnpm dev:server`: Fastify development server with reload.
- `pnpm dev`: launch both applications with coordinated shutdown.
- `pnpm tauri dev` / `pnpm tauri build`: run Tauri CLI commands from `native/`.
- `pnpm check`: documentation and both package TypeScript checks.
- `pnpm verify`: documentation, both builds, Rust format/check/tests, and server tests.

Keep this file a concise map. Put detailed procedures in linked documents.
