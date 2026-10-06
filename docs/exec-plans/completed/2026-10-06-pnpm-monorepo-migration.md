# Migrate Polar to a pnpm monorepo

Status: Complete
Owner: Codex
Created: 2026-10-06

## Goal and acceptance criteria

Move the Tauri desktop app into `native/`, add a TypeScript Fastify service in `server/`, and establish root pnpm workspace orchestration and documentation. Preserve native behavior, product identity, Rust lockfile, existing owner changes, and existing Vite port. Complete the checks and runtime scenarios requested in the migration brief; record any platform limitations accurately. Do not add product endpoints beyond `/health`, integrations, or modify owner-provided architecture/product/design documents.

## Context

- Current repo is a single Tauri 2 + React 19 + Vite 8 application at the root.
- `AGENTS.md` is already modified by the owner; `ARCHITECTURE.md` is already untracked owner content. Preserve both and make only the requested `AGENTS.md` map/command edits.
- Tauri currently runs `pnpm dev`, serves port 1420, and builds frontend output into root `dist/`.
- Existing `pnpm-lock.yaml` is lockfile v9 and `src-tauri/Cargo.lock` must move unchanged.
- Fastify v5 requires Node.js 20+; Vite 8 requires Node.js 20.19+ or 22.12+. Use Node 22.12+ and verify with official docs.

## Steps and progress

- [x] Inspect current state, linked docs, scripts, configs, path references, and existing changes.
- [x] Move native sources/config while preserving Tauri identity, port, permissions, and lockfile.
- [x] Add pnpm workspace/root commands and Fastify TypeScript package with configuration validation, `/health`, graceful shutdown, and focused tests.
- [x] Update repository and verification documentation and ignore rules.
- [x] Install/update and frozen-install the single root lockfile; run `pnpm check` and `pnpm verify`.
- [x] Exercise server development/production, invalid PORT, graceful shutdown, Tauri UI/greet, Tauri packaging, and combined root dev lifecycle.
- [x] Review final diff/path references, update verification evidence, and archive this plan.

## Decisions and discoveries

- 2026-10-06: Keep the existing Tauri Vite port (1420); it is explicitly fixed and has no observed conflict.
- 2026-10-06: Root `pnpm dev` will use one root process supervisor to run `native` Tauri dev and `server` watch mode. Tauri's before-dev hook remains responsible for its own single Vite instance.
- 2026-10-06: Pin the package manager to the installed pnpm version after confirming compatible workspace support.
- 2026-10-06: Use `node --watch-path=src --import tsx` for server development reload; it ran in the current Node 23.9 environment with watchers scoped to server source.
- 2026-10-06: Relocating the existing ignored Cargo target cache preserved stale absolute paths. Cleared it with `cargo clean`, then all normal Rust checks and Tauri packaging succeeded from `native/src-tauri`.

## Verification

`pnpm install` succeeded with pnpm 10.10.0 and produced the one root lockfile. `pnpm install --frozen-lockfile` succeeded.

`pnpm verify` succeeded after the final changes: docs, both TypeScript checks, native frontend and server builds, Rust format/check, Rust tests, and all 4 server tests. Cargo reported 0 Rust unit/doc tests.

Server integration: development and compiled production servers both returned HTTP 200 with `{"status":"ok"}` from `/health`. `PORT=65536 pnpm --filter @polar/server start` logged the validation error and exited 1. SIGINT logged graceful closure for both modes.

Desktop integration: `pnpm dev:native` started Tauri with Vite on the preserved port 1420. The packaged app opened with the original greeting UI; entering `Monorepo` displayed `Hello, Monorepo! You've been greeted from Rust!`. `pnpm tauri build` succeeded outside the sandbox and produced the macOS `.app` and `.dmg` bundles.

Combined development: `pnpm dev` started Fastify and Tauri; `/health` returned 200, Vite logged one ready instance on port 1420, Ctrl+C stopped both process trees, and a follow-up connection to 1420 was refused.

Final review: `git diff --check` passed. The relocated `native/src-tauri/Cargo.lock` has the same Git blob hash as the original `src-tauri/Cargo.lock`. Generated frontend and Rust output remains ignored.

## Handoff or outcome

Complete. Root commands, package layout, and operational checks are documented in `README.md`, `AGENTS.md`, and `docs/VERIFICATION.md`. The owner’s modified `AGENTS.md` content and untracked `ARCHITECTURE.md` were retained; no commit was created.
