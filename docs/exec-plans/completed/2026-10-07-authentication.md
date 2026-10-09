# Polar application authentication

Status: Complete
Owner: Codex
Created: 2026-10-07

## Goal and acceptance criteria

Provide real Polar application sign-in using Better Auth, independently of the ChatGPT
account used for inference. This plan delivers the identity and persistence
foundation required by the separate
[AI mission creation plan](2026-10-07-ai-mission-creation.md).

Confirmed requirements:

- Use real application sign-in rather than a development-only user.
- Use Better Auth for application identity and Neon for canonical Postgres state.
- Keep application identity separate from model-provider identity.
- Hosted browser sign-in uses email/password for the first release.
- Authentication and database state have separate production and development
  environments. Testing must use development (confirmed 2026-10-08).
- Neon production and development are provisioned. The production HTTPS auth
  origin remains unprovisioned; local development uses its configured loopback
  origin. Never commit or request secret values in chat.

Planned acceptance criteria, based on the architecture and the proposed defaults
below:

- Users can sign in through the system browser, cancel or retry sign-in, restore
  their session after restarting, and sign out. Development validation uses the
  local server and development Neon; production requires its HTTPS auth origin.
- Application credentials stay in Rust-managed secure storage. React receives
  presentation state; provider tokens never become application credentials.
- Fastify authenticates requests and checks current Polar workspace membership.
- First authenticated bootstrap creates a Polar user, a default workspace, and
  its owner membership atomically and idempotently.
- Registered devices belong to an authenticated Polar user. Another user cannot
  access or use that registration.
- Authentication and credential-store failures produce actionable states. A
  failed sign-in does not erase an existing draft.
- No unauthenticated fallback grants access to shared product state.
- Development server, desktop, migrations, and live tests select development;
  production requires explicit selection. Mislabelled branch/database targets
  fail before connecting, without exposing credentials.
- Development and production use separate database/auth state, auth secrets,
  browser cookies, and desktop credentials. Existing unscoped credentials cannot
  silently become the development configuration.

Outside this increment: team invitations, workspace-management UI, Better Auth's
Organization plugin, mission creation, document processing, and reasoning workflows.
The many-to-many user/workspace model remains compatible with future teams.

## Context

The inspection on 2026-10-07 found:

- `server/src/app.ts` exposes only a health route; `server/src/config.ts` validates
  host and port. There is no application identity, domain database, or device
  registration implementation.
- `native/src/App.tsx` mounts the desktop homescreen. Application sign-in is not
  wired into the root composition.
- `native/src-tauri/src/providers/` implements ChatGPT connection management and
  fixed-prompt inference testing. Its provider identity and credentials must
  remain independent of the new Polar account.
- No relevant active execution plan existed before these two plans were saved.

The provider-change inspection on 2026-10-07 confirmed that authentication is
still unimplemented: neither package has a Clerk dependency, and Clerk references
exist only in these two active plans. This revision changes the planned integration;
there are no existing application sessions or Clerk data to migrate.

Read [Product](../../PRODUCT.md), [Architecture](../../../ARCHITECTURE.md),
[Design](../../DESIGN.md), [Frontend conventions](../../FRONTEND.md), and
[Verification](../../VERIFICATION.md) when resuming. Inspect current code again;
target directories in the architecture are not proof of existing modules.

## Steps and progress

- [x] Inspect current server, desktop, provider, and architecture boundaries.
- [x] Record the agreed identity provider and split authentication from AI work.
- [x] Save the linked active plans.
- [x] Replace the identity provider with Better Auth in both plans and revalidate
  the proposed device sign-in, session validation, and persistence approach.
- [x] Confirm browser sign-in methods and their configuration prerequisites.
- [x] Establish server-owned Better Auth configuration, versioned application
  contracts, and Neon migrations for auth records, Polar users, workspaces,
  memberships, and registered devices.
- [x] Implement Polar-hosted browser sign-in and device verification/approval pages.
- [x] Implement Rust-managed application sign-in, secure persistence, renewal,
  restoration, cancellation, and sign-out.
- [x] Implement server authentication, idempotent bootstrap, current membership
  authorization, and device registration.
- [x] Render minimal sign-in and account controls using existing desktop
  primitives; the current Vite preview renders Polar account separately from
  ChatGPT.
- [x] Verify account controls, native device-code initiation, and cancellation
  in the exact development Tauri app launched by `pnpm dev:native`.
- [x] Complete full native account sign-in, restart/restoration, renewal,
  revocation, and sign-out smoke verification using development; review the
  required layouts and error states. Basic controls do not prove this lifecycle.
- [x] Provision the Neon project context, initialize `neon.ts`, and deploy the
  policy after confirming the production branch already matched it.
- [x] Test the Drizzle migrations on a short-lived production child branch and
  apply them to production.
- [x] Move production HTTPS provisioning and deployment verification to the
  debt tracker, per user instruction on 2026-10-08. Development verification
  remains required for completion.
- [x] Run repository verification, desktop smoke launch, and update setup docs.
- [x] Provision persistent development database with schema only and configure
  separate ignored environment files without altering production data.
- [x] Add explicit environment selection and branch/endpoint validation to server,
  migrations, and development/test commands.
- [x] Isolate desktop credentials and browser cookies by environment; validate
  desktop server configuration and environment changes.
- [x] Run environment regression tests, development-only live auth/database
  checks, required verification, and update setup guidance.

## Decisions and discoveries

### Completion audit — 2026-10-08

- Resumed the existing plan; preserved all prior in-progress changes. Remaining
  work was full native lifecycle/layout verification and broader live
  authorization checks. User explicitly deferred production HTTPS hosting and
  validation to the debt tracker; it is no longer a completion criterion.
- Found bootstrap HTTP 403 was treated as a transient server error in Rust,
  leaving revoked membership credentials stored. Restoration must clear invalid
  sessions on either bootstrap or registration rejection.
- Sign-out must clear secure local storage before waiting for remote revocation,
  so a process interruption or unavailable server cannot retain local access.
- Added live development regressions for concurrent bootstrap, user-owned device
  registration, cross-workspace rejection, renewal/expiry, membership removal,
  unauthenticated approval, foreign browser origins, invalid clients, and denial.
  All seven integration test cases passed.
- Browser device inspection returned 200 without identity; fixed the hosted UI
  to check the session first and refuse another client/account's code. Added
  deterministic browser-script tests, network error handling, and explicit
  cookie-origin enforcement for plugin mutations.
- Actual native smoke exposed a camelCase/snake_case device response mismatch;
  fixed Rust decoding and added a regression test.
- `pnpm verify` passed: formatting, lint, docs, frontend conventions,
  TypeScript, builds, 26 native UI tests, 38 Rust tests, and 16 server tests.
- `pnpm --filter @polar/server test:integration` passed all seven live cases
  against development Neon, including concurrent bootstrap, device ownership,
  membership rejection, renewal/expiry, approval denial, and revocation.
- Guarded `pnpm dev:native` smoke passed actual browser approval, desktop
  bootstrap/device registration, account display, restart restoration, active
  renewal through Rust transport, revoked-session recovery, and local sign-out
  with the server offline. Sign-out cleared the desktop credential and reported
  that remote revocation could not be confirmed. The temporary account was
  deleted afterward. Existing ChatGPT connection remained intact.
- Inspected Settings at 800×600, maximized, and a 758×474 tiled narrow window;
  account actions remained visible and no horizontal overflow appeared.


### Environment separation — 2026-10-08

- User requires production/development auth and databases, with tests on development.
- Inspection: ignored `.env.local` and `.neon` target production; server dev/start
  and migrations load that same file. Better Auth is self-managed on Fastify,
  so its tables must use the selected database; do not enable Managed Neon Auth.
- Implementation choice: create a persistent schema-only development branch to
  avoid copying production users, passwords, sessions, or domain records. Use
  dedicated `.env.development.local`/`.env.production.local` files and pin the
  expected public Neon endpoint for each environment. Keep original `.env.local`
  intact but stop loading it automatically.
- Scope: environment separation and meaningful live development verification.
  Preserve unrelated in-progress desktop tooling and provider authentication.
- Provisioned schema-only branch `development` (`br-round-tree-b5x6cps8`). Its
  copied tables lack migration history, so created an empty `polar_development`
  database, applied checked-in Drizzle migrations, and removed the unused schema
  copy. Production rows were never copied or queried for testing.
- User requested semantic database names. Renamed existing production `neondb`
  to `polar_production` through Neon API; preserved contents. Updated scoped
  production credentials and the legacy file's URL paths without printing secrets.
- Local Neon context now selects development. Both scoped ignored environment
  files exist with independent generated auth secrets; production origin stays
  unset until provisioned.
- Neon schema-only branching inherited the database-role password. Rotated
  `neondb_owner` only on development and updated its two connection URLs; production
  credentials were unchanged. Live development integration passed again afterward.

### Confirmed user decisions — 2026-10-07

- Real user sign-in is part of the first implementation, using Better Auth.
- Better Auth replaces the originally selected Clerk integration.
- Neon stores canonical structured state.
- Authentication and AI mission creation have separate execution plans.
- Hosted browser sign-in will use email/password for the first release.
- Neon and the canonical HTTPS origin were not provisioned when implementation
  started. The Neon project is now connected; the canonical origin remains
  unprovisioned. Keep its related settings as placeholders and do not invent
  credentials.

### Decisions supported by project documentation

- Tauri/Rust owns native operations and local credentials; Fastify owns cloud
  authorization and durable product state.
- Users and model-provider accounts are different identities.
- Users can belong to multiple workspaces. Authorization must use current
  membership and ownership, including for device operations.
- React uses typed IPC for native behavior. External inputs require runtime
  validation on both sides of the boundary.
- Domain/application rules remain independent of Fastify, SQL clients, and UI
  implementations. Cross-module coordination belongs in operations.

### Agent proposals — implementation defaults, not separately approved requirements

- Use Better Auth's first-party `deviceAuthorization()` flow with `bearer()`.
  Rust requests a device code, opens the verification URL in the system browser,
  and polls `/api/auth/device/token`. Show the user code; keep the device code
  private. Honor expiry and polling intervals, including `slow_down`, denial,
  cancellation, and retry. Allow only the configured Polar desktop client ID;
  this public identifier is not a client secret or device ownership proof.
- Polar must host browser sign-in and device verification/approval pages; Better
  Auth supplies auth endpoints, not a managed sign-in UI. Require browser
  authentication, code confirmation, and explicit approval or denial. Serve this
  flow over HTTPS in production and restrict return URLs to Polar-owned routes.
- The first-party token response's `access_token` is an opaque Better Auth session
  token. Store it only in Rust-managed secure storage and use it for authenticated
  REST. This flow does not require OIDC scopes, an OAuth Provider/JWT plugin, or
  OAuth refresh tokens. Keep model-provider authentication independent.
- Resolve bearer credentials through `auth.api.getSession` in the Fastify auth
  adapter and map the verified Better Auth user ID to a stable Polar user. Reject
  missing, expired, or revoked sessions; never trust a client-supplied user ID.
  Check current Polar membership on each protected operation.
- Persist sessions in Neon. Configure session lifetime and activity-based
  extension explicitly, and verify Rust requests trigger extension correctly.
  Restore by validating the stored credential against the server; require new
  browser sign-in after expiry or revocation. Avoid session caching that would
  delay revocation. Sign-out attempts server session revocation and clears local
  credentials even when offline; report any unconfirmed remote revocation.
- Mount Better Auth under `/api/auth/*` through its Fastify integration. Configure
  the canonical auth URL, server secret, trusted browser origins, cookie security,
  and rate limits. Keep secrets on the server and preserve browser CSRF checks.
- Use Drizzle with pooled Postgres connections and versioned migrations. Introduce
  Zod schemas and JSON Schema in `packages/contracts/`; validate serialized
  contracts in Rust as well as TypeScript.
- Use Better Auth's Drizzle PostgreSQL adapter. Generate and review its core and
  device-authorization schema, then apply versioned Drizzle migrations. Keep auth
  user/session/account/verification/device-code records separate from Polar
  domain records. Uniquely map an auth user to a Polar user; perform default
  workspace and owner-membership bootstrap in one idempotent domain transaction.
- Expose typed interfaces for auth status/connect/cancel/sign-out, authenticated
  bootstrap, and device registration. Rust owns authenticated REST transport;
  neither React nor the server receives reusable ChatGPT credentials.
- Provision one default workspace per user. Polar owns membership authorization;
  do not enable the Better Auth Organization plugin or build invitations in this
  increment.
- Bind the stable registered-device identifier to the authenticated Polar user.
  Do not reuse a ChatGPT provider host identifier as application identity.
- Sign-out stops account-authenticated background work and clears account-local
  cached material. Original user-selected source files are outside that cache.
- Provide minimal account controls in the existing desktop composition, with
  focus return, keyboard access, reduced motion, and responsive layouts. Avoid
  adding a separate onboarding wizard.

### Configuration required for live validation

- Neon project `snowy-term-67281307` has production and development branches with
  their own semantic databases and scoped ignored configuration files. Local
  CLI context selects development. `server/.env.example` documents the required
  settings; the old `.env.local` is no longer loaded automatically. The canonical
  production HTTPS auth origin is still not provisioned. This does not block
  development sign-in or testing.
  `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, and
  `POLAR_DESKTOP_CLIENT_ID` are required; no secret values are recorded here.
- Email/password does not require social-provider credentials. Email verification
  and password-reset delivery are not in the first flow; do not invent an email
  delivery provider.

Revalidate provider compatibility and package versions before implementation.
Official references checked on 2026-10-07:
[Device authorization](https://better-auth.com/docs/plugins/device-authorization),
[Bearer sessions](https://better-auth.com/docs/plugins/bearer),
[Session management](https://better-auth.com/docs/concepts/session-management),
[Fastify integration](https://better-auth.com/docs/integrations/fastify), and
[Drizzle adapter](https://better-auth.com/docs/adapters/drizzle).

## Verification

Environment-separation session — 2026-10-08:

- Neon metadata confirms production contains `polar_production` and development
  contains `polar_development`. Production was renamed, not recreated; no
  production database queries or migrations were used for testing.
- `pnpm --filter @polar/server db:migrate` — passed on the empty development
  database and on a repeat run. The initial attempt on the schema-only copy
  failed because copied tables had no migration history; resolved by creating
  and migrating the empty semantic database rather than editing migration records.
- `pnpm --filter @polar/server db:generate` — passed, no schema drift.
- `pnpm --filter @polar/server test:integration` — passed against final
  `polar_development`; real signup/browser session, device approval, bearer
  bootstrap, repeated bootstrap, device registration, sign-out and revocation.
  Temporary account and related records were cleaned up.
- Final `pnpm verify` — passed: formatting/lint/docs/frontend conventions,
  both builds/TypeScript checks, 9 frontend-checker tests, 5 native-launch tests,
  2 environment-runner tests, 26 native frontend tests, 37 Rust tests, and
  14 server tests. The first sandbox run could not bind a mock-server socket;
  reran with permission. A new header test initially inspected a pre-send request;
  corrected it to check the header received by a real local HTTP server.
- `pnpm dev:server` and guarded `pnpm dev:native` — launched. CUA selected the
  exact `.polar-dev/Polar Dev.app`; Settings restored the development account
  as disconnected, initiated sign-in against `127.0.0.1:3000`, displayed its
  browser code, and cancellation displayed the cancellation message. The
  previously installed Polar and ChatGPT connection were preserved.
- `.env.local`, both scoped credential files, and `.neon` remain ignored. No
  secrets were printed. The old unscoped keychain entry remains untouched;
  users must sign in again into the appropriate environment.
- Development desktop/server processes launched for smoke review were stopped;
  the unrelated installed app was preserved. Start local work with `pnpm dev`.
- Full user-account sign-in/restoration in the desktop, production live auth,
  and packaging were not exercised here. No packaging paths changed.

Planning-session results:

- Repository and project references inspected; baseline working tree was clean.
- `pnpm check:docs` — passed after saving both linked plans on 2026-10-07.
- Application checks and live sign-in scenarios were not run in the planning
  session.

Provider-change session results:

- Reinspected server configuration/composition and desktop composition/dependencies;
  confirmed there is no implemented Clerk integration to replace.
- Checked official Better Auth integration documentation and updated both plans.
- `pnpm check:docs` — passed after the provider revision on 2026-10-07.
- Application checks and live authentication: not run; this revision is documentation
  only and does not implement or verify sign-in behavior.

Implementation session results:

- User confirmed email/password browser sign-in.
- Current official Better Auth docs confirm first-party device authorization
  returns a Better Auth session token at `/device/token`; bearer plugin enables
  authorization-header session lookup; approval requires an authenticated browser
  session and explicit approval/denial; Drizzle adapter schema should be generated
  and applied through Drizzle migrations; Fastify can mount `auth.handler` and
  call `auth.api.getSession`. Official Drizzle docs support node-postgres pools.
- User confirmed Neon/origin are not yet provisioned; use placeholders until
  they are. Required values are represented by environment variable names only.
- Added shared contracts, Better Auth email/password and device/bearer plugins,
  Zod/JSON Schema request/response validation, Drizzle auth/domain schema, and
  generated, versioned Drizzle migrations.
  Server configuration requires database URL, auth secret, public auth origin,
  and desktop client ID without logging their values.
- Added hosted device verification/approval HTML served by Fastify, plus protected
  account bootstrap and device registration endpoints with current membership checks.
- Added Rust device-code polling, system browser launch with origin validation,
  keychain persistence/restoration, bearer bootstrap/device registration, and
  local-first sign-out. The app Settings overlay shows the Polar account separately
  from ChatGPT and includes code, verification link, cancel, and sign-out controls.
- `pnpm --filter @polar/server check` — passed.
- `pnpm --filter @polar/server test` — passed (9 tests).
- Rust auth lifecycle tests — passed (10 tests), including secure-store restoration,
  concurrent operation locking, cancellation, late-approval commit rejection,
  expiry, revocation, backoff, and transient server failure handling.
- `pnpm verify` — passed, including formatting, lint, docs, native/server builds,
  26 native frontend tests, 34 Rust tests, and 9 server tests.
- `pnpm dev:native` — launched Vite and the Tauri debug process successfully.
  The Vite browser preview's Settings accessibility tree showed the new Polar
  account section separately from ChatGPT. Native app automation bound to the
  separately installed app with the same bundle identifier, so native account
  IPC/UI behavior remains unverified.
- Live Neon migrations, browser sign-in, device approval, restoration, expiry,
  and revocation could not run because Neon and the canonical HTTPS origin are
  not provisioned. No credentials were invented.
- `pnpm --filter @polar/server db:generate` — passed; Drizzle reports no schema
  changes beyond the checked-in migrations.
- `pnpm check:docs` — passed after updating the active plans and setup guidance.

Neon project setup follow-up:

- Installed Neon CLI 8.0.12 in an isolated temporary PNPM home because global
  installation into the user shell was not configured. No shell startup files
  were changed.
- Added `@neon/config` and `@neon/env` to the workspace root and created the
  requested `neon.ts` with `defineConfig({})`.
- Updated Drizzle to prefer `DATABASE_URL_UNPOOLED` for migrations and added its
  placeholder to `server/.env.example`; app traffic continues to use
  `DATABASE_URL`.
- `neon skills -y` — passed; installed the Neon skills into this repository.
- The first `neon auth` attempt returned `invalid_client`; rerunning the CLI so
  it opened the browser automatically succeeded (`Auth complete`).
- `neon link --project-id snowy-term-67281307 --branch production -y` — passed;
  production is the project's default branch. Connection values were kept out
  of command output and `.env.local` is ignored by Git.
- `neon config plan --project-id snowy-term-67281307 --branch production` —
  passed; the branch already matched the empty policy.
- `neon deploy` — passed; no policy changes were applied.
- `neon mcp -y` — passed per the supplied setup steps. The CLI wrote MCP
  configuration to detected global agent configs and minted an account-wide
  API key. No key value is recorded here.
- Neon reported the production branch is ready with zero application writes. A
  temporary child branch `polar-auth-migration-test` was created from it with
  a 2026-10-10 expiration for isolated migration validation.
- The checked-in Drizzle migrations applied successfully to the temporary
  branch and then to production using the direct URL. Connection strings were
  not printed. A first production attempt used the wrong env-file path and
  exited before connecting; the corrected command succeeded.
- `pnpm --filter @polar/server db:migrate` — passed after wiring the script to
  load root `.env.local`; the production migrations completed successfully.
- `pnpm --filter @polar/server db:generate` — passed; Drizzle found no schema
  drift after applying the checked-in migrations.
- Latest `pnpm verify` — passed after the Neon env-loading and migration config
  changes: formatting, lint, docs, TypeScript, native/server builds, 26
  frontend tests, 34 Rust tests, and 9 server tests.
- `pnpm dev:native` — launched twice. CUA selected the separately installed
  Polar app sharing the same bundle name; after the dev process exited, that
  installed app remained running. Its Settings tree shows the older provider
  UI without Polar account. The local Vite preview at `http://localhost:1420/`
  does show Polar account separately from ChatGPT. The actual Tauri debug
  window's account controls and native auth IPC remain unverified.
- `pnpm add` initially failed under sandbox network restrictions; after the
  required escalation approval, `pnpm add -w @neon/config @neon/env --store-dir=...`
  completed successfully. No secret values were printed or written to source.
- `pnpm format` — passed. `pnpm verify` — passed after rerunning with loopback
  permission; the sandboxed run had first failed only because one Rust auth test
  could not bind its local mock-server socket. The full rerun passed formatting,
  lint, docs, TypeScript, both builds, 26 frontend tests, 34 Rust tests, and 9
  server tests.

Required during implementation:

- Test approval, rejection, cancellation, expiration, session restoration,
  renewal, and sign-out. Exercise the actual desktop app, not only a browser.
- Test invalid/revoked credentials, missing membership, cross-user device access,
  and repeated/concurrent bootstrap requests.
- Test browser sign-in, code confirmation, unauthorized approval, invalid client
  IDs, code reuse, polling backoff, and a late approval after desktop cancellation.
  A cancelled attempt must never persist a session.
- Test bearer session lookup, expiry extension through Rust transport, restoration
  after expiry/revocation, remote sign-out, and local cleanup when offline.
- Verify atomic user/workspace/membership creation and recovery from a lost
  response after commit. Invalid credentials must not provision accounts.
- Test secure-store failure and confirm logs, browser-accessible storage, and
  desktop React IPC do not expose desktop credentials. Browser sessions use
  secure HttpOnly cookies.
- Run `pnpm verify` and tests for the changed behavior. Run `pnpm dev:native` and
  inspect large, 800×600, and narrow layouts. Run `pnpm tauri build` if packaging
  paths change. Record live checks that cannot run and their prerequisites.

## Handoff or outcome

Authentication implementation and development verification are complete. The
active AI mission creation plan depends on the completed identity, workspace,
membership, device registration, secure Rust transport, and shared contracts.

Production authentication hosting and verification remain deferred by the user
and are recorded in the [technical debt tracker](../tech-debt-tracker.md). The
production database is provisioned; its canonical HTTPS origin and hosting are
not. Production sign-in must not be enabled until that follow-up is complete.

No packaging paths changed, so `pnpm tauri build` was not required. The temporary
development smoke-test account and its cascading auth/domain records were removed.

Do not modify owner-maintained product, architecture, or design references without
an explicit request. Record proposed durable amendments here for the owner.
