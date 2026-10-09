# Polar account authentication

Polar account authentication uses Better Auth for email/password identity and
Neon Postgres for canonical sessions and Polar workspace state. It is separate
from the ChatGPT provider connection in Settings. Rust owns the desktop bearer
credential and sends authenticated requests; React receives only account
presentation data.

## Configuration

Polar has two environments. Better Auth is self-managed by Fastify; its users,
passwords, sessions, and device codes live alongside domain tables in the selected
Neon database. Managed Neon Auth is not enabled.

| Environment | Neon branch | Database | Local configuration |
| --- | --- | --- | --- |
| Development | `development` | `polar_development` | Root `.env.development.local` |
| Production | `production` | `polar_production` | Root `.env.production.local` or deployment variables |

The ignored files contain separate credentials and Better Auth secrets. The
development database-role password was rotated after branch creation so it does
not share production's inherited role password. Start
from [`server/.env.example`](../server/.env.example). The command runner loads
only the selected file, replacing inherited database/auth settings. With no file,
shell configuration must explicitly declare the matching `POLAR_ENV`. The old
root `.env.local` is no longer loaded automatically. The server itself reads
validated process variables.

Public branch, endpoint, and database names are pinned in
[`server/environments.json`](../server/environments.json). Startup and migrations
reject a URL pointing to the other environment, even with a misleading branch
label. Update these public targets when deliberately replacing Neon endpoints.
Configure:

| Variable | Purpose |
| --- | --- |
| `POLAR_ENV` | `development` or `production`. Required; independent of build optimizations. |
| `NEON_BRANCH` | Must match the selected environment's configured branch. |
| `DATABASE_URL` | Selected Neon endpoint and database. Use the pooled connection with TLS (`sslmode=verify-full`). |
| `DATABASE_URL_UNPOOLED` | Direct endpoint for the same environment/database. Required for migrations; no pooled or localhost fallback. |
| `BETTER_AUTH_SECRET` | Server-only secret with at least 32 characters. Generate and provision it in the server environment. |
| `BETTER_AUTH_URL` | Public origin that serves `/api/auth/*` and the `/device` approval page. Use HTTPS in production; local development may use `http://127.0.0.1:3000`. |
| `POLAR_DESKTOP_CLIENT_ID` | Public client ID matching the desktop: `com.antoniopertuz.polar.desktop.development` in development, `com.antoniopertuz.polar.desktop` in production. |
| `HOST`, `PORT` | Fastify bind address and port. Defaults are `127.0.0.1` and `3000`. |

Mission reasoning is orchestrated by Inngest. Development connects to the local
Inngest Dev Server and does not require Inngest credentials. Production requires
`INNGEST_EVENT_KEY` and `INNGEST_SIGNING_KEY`; Fastify refuses to start without
both so mission events cannot silently accumulate in the outbox.

`pnpm dev:server`, `pnpm dev:native`, and `pnpm dev` use development. The desktop
launcher takes the public server origin/client ID from development configuration
and does not pass database credentials or auth secrets to Tauri. Debug builds
default to development at `http://127.0.0.1:3000`.

Release desktop builds default to production and require an explicit HTTPS
`POLAR_API_BASE_URL` in the build environment. Set `POLAR_ENV=production` and the
matching public `POLAR_DESKTOP_CLIENT_ID` when building. These values are public,
embedded settings, not secrets; Cargo rebuilds when they change.

`pnpm --filter @polar/server start` explicitly selects production; use
`start:development` to run the compiled server locally. Production's database
is configured, but its canonical HTTPS `BETTER_AUTH_URL` remains unset and must
be provisioned before starting production authentication.

## Database setup

The development branch was created without production rows, then an empty
`polar_development` database was migrated from the checked-in Drizzle files.
This avoids copying users or sessions and avoids inheriting tables with missing
migration history. The unused schema-copy database was removed. Production's
existing `neondb` was renamed `polar_production`, preserving its contents.

Apply migrations to development by default. Do not put connection strings in
shell history or commit them:

```sh
pnpm --filter @polar/server db:migrate
```

When changing `server/src/db/schema.ts`, generate and review a migration before
applying it:

```sh
pnpm --filter @polar/server db:generate
pnpm --filter @polar/server db:migrate
```

The migration keeps Better Auth user, session, account, verification, and device
code tables separate from Polar users, workspaces, memberships, and registered
devices. The first authenticated bootstrap creates a user's Polar record, default
workspace, and owner membership in one transaction. Existing users are not
granted membership again if it has been removed.

Production migration is a separate, explicit command after development verification:

```sh
pnpm --filter @polar/server db:migrate:production
```

`db:generate` only generates schema files and does not load credentials or connect
to a database. Neon CLI's ignored local `.neon` context selects development.
To refresh connection files, select the correct branch **and database name**;
a default `neon env pull` can choose another database and will then be rejected
by the endpoint/database validation.

## Testing

`pnpm verify` runs hermetic server tests with `NODE_ENV=test` and
`POLAR_ENV=development`, without loading real database/auth credentials. It does
not perform live database tests. Run the development-only integration suite separately:

```sh
pnpm --filter @polar/server test:integration
```

The integration suite requires development configuration, fails before opening
a pool if it targets production, and uses temporary accounts with cleanup. It
exercises real Better Auth browser cookies, device approval, bearer bootstrap,
device registration, and revocation against development Neon.

## Sign-in behavior

The hosted `/device` page supports email/password account creation and sign-in.
It requires a signed-in browser session, verifies the code, and asks for explicit
approval or denial. It tells the user to approve only a code displayed by their
own Polar desktop. Device codes expire after 30 minutes; Better Auth's returned
polling interval and `slow_down` response are honored by Rust.

Better Auth session rows last 30 days and extend after one day of activity.
Cookie caching is disabled so revoked sessions are checked against Postgres.
Email verification and password reset delivery are not configured in this
increment. Do not enable either until an email delivery provider is selected.

The desktop stores the opaque Better Auth session token and a Polar-generated
device ID in the operating system credential store. The device ID is not derived
from the ChatGPT provider host ID. Account status IPC never returns the bearer
token. Sign-out clears the local credential even when remote revocation cannot
be confirmed; the UI reports whether the server confirmed it.

Browser cookie prefixes distinguish development and production. Desktop keychain
entries, device IDs, and credential-operation locks are scoped by environment,
server origin, and client ID. The old unscoped keychain entry is preserved but
is not reused; sign in again after this update. Switching environments cannot
send a previously saved token to the other server.
Desktop requests also identify their environment; a mismatched server rejects
them before auth/database work. This guard supplements session authentication;
the environment header is not an identity credential.

## References

- [Better Auth device authorization](https://better-auth.com/docs/plugins/device-authorization)
- [Better Auth bearer sessions](https://better-auth.com/docs/plugins/bearer)
- [Better Auth Fastify integration](https://better-auth.com/docs/integrations/fastify)
- [Better Auth Drizzle adapter](https://better-auth.com/docs/adapters/drizzle)
- [Drizzle PostgreSQL migrations](https://orm.drizzle.team/docs/migrations)
