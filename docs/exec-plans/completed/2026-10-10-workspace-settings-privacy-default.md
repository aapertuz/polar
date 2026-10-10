# Workspace settings, privacy, and optional default

Status: Complete (desktop verification confirmed by owner)
Owner: Codex
Created: 2026-10-10
Completed: 2026-10-10

## Goal and acceptance criteria

Use ordinary workspaces with explicit **Private** or **Shared** privacy. Replace
the current **Workspace context** surface with **Workspace settings**, and add
creation, switching, renaming, deletion, and an optional account default.

There is no special personal workspace designation. Personal goals and knowledge
belong to the account independently; implementing that separate personal layer
remains future work.

- [x] Create, list, select, rename, and permanently delete ordinary workspaces.
- [x] Private workspaces are accessible only to their owner; Shared workspaces
      are accessible only to their members and are never public.
- [x] Owners can change privacy without automatically granting or revoking access;
      changing to Private is rejected while other members remain.
- [x] Each account can set or clear an optional default independently of the
      selected workspace. Each desktop restores its last valid selection.
- [x] Workspace settings replaces all Workspace context entry points and exposes
      General and Context sections in both empty and populated Home states.
- [x] Owners can manage the workspace brief, documents, and notes. Members can
      inspect the saved brief and source contents.
- [x] Switching isolates missions, timeline, action windows, context, and drafts;
      late responses and pending operations cannot cross workspace boundaries.
- [x] Unfinished Quick AI input and context edits are retained per account and
      workspace during the session; saved drafts remain persisted.
- [x] Deleting the last workspace leaves an authenticated empty account with
      workspace creation and account settings available.
- [x] Existing workspaces, contents, valid memberships, and stored credentials
      migrate correctly; removed membership is never recreated.
- [x] Required automated, integration, and actual desktop checks pass. Any blocked
      native acceptance checks remain explicitly unverified and keep this plan active.

Invitations, member management, content-level private/shared permissions, and
account-owned personal goals/knowledge are deferred.

## Context

Read [Product](../../PRODUCT.md), [Architecture](../../../ARCHITECTURE.md),
[Design](../../DESIGN.md), [Frontend conventions](../../FRONTEND.md),
[Verification](../../VERIFICATION.md), and [Authentication](../../AUTHENTICATION.md)
before implementation.

Current implementation facts established during planning:

- `server/src/domain/bootstrap.ts` creates an ordinary workspace named
  `Personal workspace` and assumes an owned workspace exists on every bootstrap.
- `server/src/db/schema.ts` makes `workspace.ownerUserId` unique, restricting
  accounts to one owned workspace. Membership roles are owner/member.
- `native/src/features/missions/components/MissionSwitcher.tsx` hardcodes the
  `PERSONAL WORKSPACE` caption.
- The existing workspace-context feature supports briefs, document extraction,
  notes, source inspection, replacement, and removal. Its member view omits the
  saved brief.
- `native/src-tauri/src/application_auth/commands.rs` refreshes account status by
  replacing the stored selection with bootstrap's workspace. The secure session
  currently requires a workspace ID and name.
- Home and Quick AI hold one workspace's state and drafts in memory. Native
  mission/context requests infer their workspace from the current secure session.
- The local reasoning worker captures its account/workspace at command start;
  preserve that scope through completion and isolate frontend responses.
- Mission references to proposals require care when deleting workspace data;
  the outbox stores workspace references inside JSON payloads.

### Implementation baseline — 2026-10-10

Fresh inspection confirmed the workspace model is still single-workspace:
`workspace.owner_user_id` is unique, there is no privacy or account-preference
table, and bootstrap creates/returns `Personal workspace` while rejecting
accounts without an owner membership. Context and mission routes authorize via
the selected workspace header. Rust stores that selection inside the secure
session and refresh replaces it with bootstrap's workspace. The frontend renders
Home directly; the existing auth and workspace-context hooks are not composed
into workspace selection/settings.

The working tree already contains unrelated, uncommitted action scheduling,
action detail/window-resize, timeline, design, and desktop-capture-recovery
changes, including generated migration `0005`. Preserve their exact contents and
use the next migration number for workspace changes.

There are substantial pre-existing uncommitted application and documentation
changes. Inspect and preserve them. Recheck these facts against the current code
before editing. The active
[desktop capture recovery plan](../active/2026-10-08-desktop-capture-recovery.md) covers
separate tooling work; do not replace or close it as part of this feature.

## Steps and progress

- [x] Inspect the initial workspace, context, account, and draft flows.
- [x] Resolve workspace privacy, default, deletion, and unfinished-input behavior
      with the user and save the agreed plan.
- [x] Reinspect current code, callers, tests, and uncommitted changes; establish
      the implementation baseline.
- [x] Implement persistence migration, workspace APIs, and authorization.
- [x] Implement Rust commands, account restoration, and explicit workspace scope.
- [x] Implement workspace selection, settings, and isolated frontend state.
- [x] Verify migration, automated behavior, integration, and actual desktop flows
      (automated and migration evidence below; desktop verification confirmed by owner).
- [x] Update permitted documentation and plan evidence; archive only after all
      acceptance criteria are verified.

## Decisions and discoveries

### Confirmed product decisions — 2026-10-10

The user approved ordinary workspaces with explicit privacy and an optional
default, replacing the earlier proposal for exactly one designated personal
workspace. The earlier personal-designation and replacement-before-deletion
requirements are superseded.

- Private means owner-only. Shared means members-only, never public.
- Remember the last workspace per desktop; use the account default for first
  sign-in or when no valid saved selection exists.
- Allow accounts with no workspaces, including after deleting the last one.
- Permanently delete workspace contents after explicit confirmation.
- Preserve unfinished input per workspace during the session.
- Member invitations and management remain outside this change.

### User experience and implementation defaults

- Replace the hardcoded caption with the selected workspace's name and privacy
  indicator. Make it a selector listing accessible workspaces, with **Create
  workspace** and **Workspace settings** actions.
- Creation asks for a name and privacy, defaults to Private, creates the owner
  membership, and selects the new workspace. It does not change the account default.
- Settings uses the existing dialog and design tokens, with General and Context
  sections. Update both empty and populated Home entry points.
- General supports renaming, changing privacy, setting/clearing the account
  default, and deletion. Owners manage workspace properties; any member can
  choose an accessible workspace as their own default.
- Context retains brief editing, document imports, notes, source inspection,
  replacement, and removal. Members can read the saved brief and sources; owners
  can edit them. Original imported files remain on the importing device.
- Switching to Shared grants no access automatically. Reject switching to
  Private while other members remain; do not remove them automatically.
- Deletion requires typing the workspace name and confirms permanent removal of
  its missions, drafts, and context. Keep account settings accessible when empty.

### Persistence and authorization

- Persist private/shared privacy and remove the unique constraint limiting each
  user to one owned workspace.
- Store the optional default as an account preference referencing an accessible
  workspace. Deletion clears affected defaults automatically.
- Backfill owner-only workspaces as Private and workspaces with collaborators as
  Shared. Preserve names, contents, and memberships. Initialize the default from
  the existing owned workspace only where membership remains valid.
- Provision one Private `My workspace` for new accounts, with no designated
  default. Existing accounts with zero workspaces remain empty; bootstrap must
  not recreate deleted workspaces or revoked memberships.
- Enforce owner-only membership for Private workspaces in database rules and
  authorization. Privacy changes and deletion use transactions with membership
  rechecks.

### Implementation decisions — 2026-10-10

- The account default is stored in `workspace_preference`, separate from local
  selection. A foreign key clears the default on deletion; database triggers
  reject defaults without membership and clear them on membership removal.
- Migration `0006_opposite_sphinx.sql` follows the existing uncommitted `0005`
  migration. It marks workspaces with member rows Shared, leaves owner-only
  workspaces Private, backfills only valid owner defaults, and adds database
  guards for private membership and concurrent privacy changes.
- Workspace API routes are in `server/src/workspaces.ts`. Deletion locks and
  rechecks the owner membership, requires an exact typed name, removes matching
  outbox work (including legacy request/event references), then deletes missions
  before drafts and workspace-owned context. New outbox payloads include their
  workspace ID so future cleanup is direct.
- Default membership guards take a key-share lock on the membership row; a
  concurrent membership revocation therefore cannot leave a stale default.
- Device registration now resolves the Polar account directly and does not
  require an active workspace. Bootstrap provisions `My workspace` only when it
  creates a new Polar account record; an existing empty account stays empty.

### API and native interfaces

- Add authenticated endpoints for listing/creating workspaces, updating
  name/privacy, deleting a workspace, and setting/clearing the account default.
- Add shared contracts for workspace summaries, mutations, and account workspace
  preferences. Names are trimmed, nonempty, and at most 120 characters.
- Extend bootstrap to return accessible workspaces and a nullable default.
  Update frontend and Rust contracts together, removing the assumption that
  authentication requires an owned workspace.
- Add Rust commands for workspace management and selection, validating inputs
  before requests. Keep bearer credentials inside Rust.
- Keep existing context endpoint URLs. Pass the originating workspace ID
  explicitly for workspace-scoped mission, context, and reasoning operations.
- Device registration remains account-scoped and works without a workspace.

### Selection and isolation

- Persist the last selection per desktop. On sign-in/restoration choose: valid
  saved selection, accessible account default, then oldest accessible workspace;
  otherwise show the empty-account state.
- Changing the default does not switch the current workspace. Account refresh
  preserves a valid selection; transient network failures preserve saved state.
- Scope missions, timeline, action windows, context, drafts, and unfinished input
  to selection. Clear previous visible data during switching and ignore late
  responses from another workspace.
- Capture originating workspace IDs so pending saves cannot be redirected by a
  switch. Preserve unfinished Quick AI input and context edits per account and
  workspace in memory for the session; restore persisted drafts on return.
- Already-running reasoning finishes against its original workspace. New polling
  follows selection; returning resumes saved drafts and pending work.
- Deletion removes dependent missions before drafts/proposals, associated
  context and outbox work, and local caches. Reject late reasoning results so
  they cannot recreate deleted data. Clear session caches on sign-out.
- A final async-state audit found React may evaluate a queued Quick AI state
  updater after the active workspace has changed. The updater now rechecks both
  active and loaded scope when React applies it. The development integration
  test also checks a stale reasoning-result request after its workspace is
  deleted; execution remains pending with the development migration approval.
- Workspace caches are cleared when the refreshed account workspace list no
  longer contains a workspace, including deletion of a non-selected workspace.
- Context remains workspace-owned. Changing privacy, selection, or default never
  publishes or transfers account-owned personal material.

### Delivery constraints

Preserve existing uncommitted changes and keep desktop capture recovery separate.
Do not modify owner-maintained Product, Architecture, or Design references without
explicit permission; record proposed durable updates here or in the final report.

## Verification

Planning and the implementation baseline inspected code, linked docs, relevant
callers/tests, current migrations, and the uncommitted diff. The server TypeScript
check, native TypeScript check, and Rust `cargo check --locked` passed during
implementation. The native suite passes (37/37), server unit tests pass (30/30),
Rust tests pass (65/65) when run outside the sandbox, and `pnpm check:docs`
passes. A full `pnpm verify` reached Rust tests but its sandboxed run could not
bind loopback sockets in two Rust tests; a separate escalated Rust run passed.
One server fixture was updated for the new membership join and its full unit
suite now passes. At this stage, a full verify rerun, migration branch testing,
development integration, and actual desktop review were pending; subsequent
results and owner verification are recorded below.

The development Neon branch was checked read-only: migration 0005 is present,
0006 is not, and its workspace table is in the expected pre-0006 state. The
Neon migration helper selected the project default branch rather than the
development parent, so it could not find the development database. With the
user's approval, a temporary branch was created explicitly from development and
0006 was applied transactionally. Post-migration checks found four expected
guards, zero invalid defaults, and zero Private workspaces with member rows.
The cloned data had two owner-only Private workspaces. Both temporary test
branches are awaiting cleanup. No local database credentials have been changed.

The complete `pnpm verify` passed again outside the sandbox after the final
state-isolation changes and passed once more after the integration assertion
correction. It includes formatting, lint, documentation, type checks,
native/server builds, 37 native tests, 65 Rust tests, and 30 server tests.
`git diff --check` also passed. The development integration suite passed all 9
tests, including the late-result-after-deletion assertion. On
2026-10-10, the user approved applying migration 0006 to development, running
the integration suite, and deleting both migration-test branches. Migration
0006 applied successfully through `pnpm --filter @polar/server db:migrate`;
remote history matches the migration file hash and all four expected triggers
are present, with zero invalid defaults or Private workspaces with additional
members. The first live integration run passed 8 of 9 tests and exposed an
incorrect assertion: an owner can set their default to a Shared workspace they
own. The test now expects that success and checks an outsider is rejected. The
next live integration run passed all 9 tests, including late result rejection
after deletion. Synthetic mission tests logged unavailable Inngest dispatches;
the API returned successfully and retained outbox recovery. Full verification
passed after the assertion fix. The privacy-migration test branch was deleted
with approval, followed by the backfill-test branch. A Neon branch-list query
confirmed neither temporary branch remains.
The guarded desktop session
was ready (native PID 6761, Vite PID 30392). Its AX tree showed the signed-out empty
workspace interface, but the first capture required recovery and the documented
single recovery attempt failed. No UI actions were taken. The desktop helper's
budget was exhausted; native IPC, visual layout, keyboard/focus, populated
settings/context, and size checks remained unverified by the agent. The owner's
subsequent manual verification is recorded below.

Required implementation checks:

- Test creation, name validation, privacy transitions, owner/member permissions,
  defaults, switching, deletion, and authenticated zero-workspace behavior.
- Cover concurrent privacy changes, cross-workspace access, stale responses,
  preserved unfinished input, saves during switching, and reasoning completion
  after deletion.
- Verify existing credentials restore, account refresh preserves selection, and
  removed membership is never recreated.
- Generate and review the Drizzle migration. Verify backfill on an isolated
  database branch before applying it to development, using the direct migration
  connection and existing environment procedures. Production migration is separate.
- Run `pnpm verify` and development integration tests using temporary accounts
  and synthetic workspaces.
- Exercise native command success and failure in the actual desktop app using
  the current desktop verification procedure. Review empty/populated settings,
  context imports, keyboard navigation, focus return, and normal, 800×600, and
  narrow layouts. Record blocked checks without treating browser checks as
  native command verification.

Plan-save validation: `pnpm check:docs` passed within the final `pnpm verify`
run and again after the latest plan update on 2026-10-10. Development migration
and integration verification are complete.

### Owner verification and closure — 2026-10-10

The owner reported, "i just verified myself, you can check the verification and
pass it to completed". This confirms manual verification of the feature and
authorizes closing the remaining desktop acceptance criteria. Individual native
gestures and window-size results were not separately supplied; this is owner
verification, not a successful repeat of the blocked agent desktop review.

Closure review inspected the existing verification record, current workspace
API and settings implementation, and integration assertions covering privacy,
defaults, deletion, empty accounts, and concurrent membership/privacy changes.
The recorded automated, migration, and integration checks passed as described
above. No application changes or fresh application-test runs were made during
closure. `pnpm check:docs` passed after archival on 2026-10-10.

The external capture limitation remains under the separate active desktop
capture recovery plan and existing debt-tracker entries. It no longer blocks
this feature following the owner's manual verification.

## Handoff or outcome

Complete. Workspace management, Private/Shared privacy, optional account
defaults, workspace settings/context, selection restoration, and isolated
workspace state are implemented. Migration and automated/integration checks
passed; the owner completed manual verification and requested archival.

The plan is archived in `completed/`, and its link to active capture recovery is
repaired. No feature implementation or acceptance work remains. Production
migration is still a separate deployment action. Deferred personal goals/knowledge
and member invitations remain outside this feature's scope.

Proposed durable updates for the owner-maintained references: document ordinary
Private/Shared workspaces, optional account defaults versus desktop selection,
and the authenticated zero-workspace state. Keep account-owned personal goals
and knowledge separate from workspace context.
