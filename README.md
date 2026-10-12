# Polar

Polar is a pnpm monorepo with a Tauri desktop application and a Fastify server.

## Structure

- `native/`: Tauri 2, React 19, TypeScript, and Vite desktop app.
- `server/`: TypeScript Fastify service with a health endpoint.
- `docs/`, `scripts/`, `.agents/`, and `.githooks/`: shared repository guidance and tooling.

## Prerequisites

- Node.js 22.12.0 or newer (`.node-version` records the compatible baseline).
- pnpm 10.10.0, pinned by the root `packageManager` field.
- Rust and Cargo with `rustfmt`, plus the platform dependencies required by [Tauri 2](https://v2.tauri.app/start/prerequisites/).

Install JavaScript dependencies from the repository root:

```sh
pnpm install --frozen-lockfile
```

## Development

Run one application or both:

```sh
pnpm dev:native   # Tauri desktop app; Tauri starts its Vite frontend
pnpm dev:server   # Fastify with TypeScript reload
pnpm dev          # both applications; either exit stops the other
```

The server listens on `127.0.0.1:3000` by default. Set `HOST` and `PORT` in the shell before running it. `.env.example` documents the variables; the server does not load `.env` files automatically.

Run Tauri CLI commands from the root with arguments forwarded to the native package:

```sh
pnpm tauri dev
pnpm tauri build
```

## Checks and builds

```sh
pnpm check       # documentation and both TypeScript packages
pnpm check:rust  # Rust format and compile checks
pnpm test:rust   # Rust tests
pnpm build       # native frontend and compiled server; no desktop installer
pnpm build bundle # production macOS DMG with the configured logo and backend
pnpm verify      # full repository verification, including server tests
```

Run `pnpm build bundle` on a Mac to create the production installer in
`native/src-tauri/target/release/bundle/dmg/`. It uses the public backend origin
and desktop client ID in [`native/production.json`](native/production.json),
including the Railway origin configured for Polar. Edit that file when changing
the production backend. The command uses ad-hoc signing without an Apple
Developer certificate or notarization; macOS may require Open Anyway for a
downloaded app. Server credential files are not loaded for desktop packaging.

## Downloads

Versioned macOS installers are published on the GitHub
[Releases](https://github.com/aapertuz/polar/releases) page. To publish a
release, update the root `package.json` and `native/src-tauri/tauri.conf.json`
versions to the same value, commit and push those changes, then push a matching
`v` tag (for example, `v0.1.0`). The release workflow builds the production DMG
on macOS and attaches it to the GitHub Release. Releases currently contain a
macOS DMG only; the app is ad-hoc signed and not notarized.

## Server production commands

```sh
pnpm --filter @polar/server build
pnpm --filter @polar/server start
```

The health check is `GET /health`, returning `{"status":"ok"}`. Configure production `HOST` and `PORT` through the process environment.
