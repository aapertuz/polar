# Action detail editing

Status: Complete
Owner: Codex
Created: 2026-10-09

## Goal and acceptance criteria

Make saved mission actions editable from the action detail window.

Explicit requirements:

- Change, add, and remove people assigned to an action.
- Change the action deadline and priority.
- Add and remove context resources for an action.
- Mark an action complete.
- Remove the duplicate `Upcoming` status chip when its timing is already represented by the deadline.

Acceptance criteria:

- [x] Timeline action details load the selected persisted action and display its current fields.
- [x] Workspace members can be assigned or removed; nonmembers cannot be assigned.
- [x] Deadline can be changed or cleared, and priority can be set to High, Medium, or Low.
- [x] Action context can include or remove sources already authorized for the mission; removing a link does not delete the source.
- [x] Completion updates saved status and removes the action from upcoming work; the action can be reopened from its still-open detail window.
- [x] Action edits persist across refreshes and are recorded with the mission revision, domain event, and outbox event.
- [x] The detail window presents one deadline-derived timing control rather than separate `Upcoming` and `Today` controls.
- [x] The detail window remains usable with keyboard input and at compact viewport sizes.
- [x] Required verification and relevant behavior checks pass; any native UI check that cannot run is reported accurately.

## Context

The timeline is derived from saved `mission_action` rows. The current detail
window is presentation-only. `mission_action` stores priority and status but not
deadlines or assignments. Mission context sources live in the saved mission
content, while the current action window shows every mission source without an
action-specific association. The current user appears as the default owner in
the timeline presentation, so new actions should preserve that initial
assignment when activated.

The active [desktop capture recovery plan](../active/2026-10-08-desktop-capture-recovery.md)
tracks an unrelated automation issue. The completed
[action window interactions plan](2026-10-09-action-window-interactions.md)
established the window's move, resize, scroll, and focus behavior; it explicitly
left editing controls visual.

Supported implementation decisions:

- Saved actions are authoritative; edits go through the Tauri command and
  authenticated server route.
- Assignments are workspace members, and action context consists of source
  references already included with that mission.
- Existing actions keep their currently displayed source set and default
  current-user assignment during migration.
- Keep the plan focused on existing action fields. Action creation, deletion,
  editing title/description, and uploading new sources are outside this request.

## Steps and progress

- [x] Inspect product, architecture, design, verification guidance, active and
  completed plans, current action window, persistence, and caller paths.
- [x] Add validated and authorized server-side action updates and schema
  migration for deadlines, assignments, and context links.
- [x] Add the Tauri update command and connect editable detail controls to
  refreshed mission state.
- [x] Run the required repository checks and focused presentation, contract,
  and command validation tests.
- [x] Apply the additive schema migration to the isolated development database
  and confirm that the existing mission still loads in the native app.
- [x] Verify the persisted edit round-trip and authorization against that
  database, and review the detail window at regular and compact sizes.

## Decisions and discoveries

- 2026-10-09: `ActionDetail` renders disabled preview controls. The live home
  screen loads missions from `polar_missions`; a React-only edit would be lost
  on refresh and would not update timeline state.
- 2026-10-09: The timeline's `Today`/`Upcoming` label is computed from the due
  date. The detail window also displays a hard-coded `Upcoming` status chip.
  Remove that chip and retain one editable deadline-derived label.
- 2026-10-09: Added action-specific deadline, workspace-member, and mission
  source-link persistence. Updates validate membership and source authorization,
  increment mission revision, emit a domain event, and enqueue its outbox event.
  The Tauri command validates its payload before calling the authenticated API.
- 2026-10-10: The development migration had not been applied, and the mission
  loader hid fetch failures as an empty mission list. Applied the migration to
  the isolated development database and changed the homescreen to preserve the
  empty state for a successful empty result while showing a retryable error on
  load failure. The live native app now shows “Deliver We Are One Pilot” with
  30 supporting actions; the saved mission was not deleted.

## Verification

`pnpm verify` passes, including all 37 native tests, all 62 Rust tests, all 30
server tests, formatting, lint, documentation, frontend boundaries, and both
production builds. The first sandboxed run denied two existing local-socket
Rust tests; the full command passed when rerun with the required socket access.
The migration was applied to the isolated development database. On 2026-10-10,
the user confirmed personally verifying the remaining persisted edit, access,
and native UI acceptance criteria, including compact-size use. The native app
also showed the saved mission with its supporting actions after migration.

## Handoff or outcome

Outcome: Complete. The user verified the remaining runtime acceptance criteria
in the native app and migrated development environment.
