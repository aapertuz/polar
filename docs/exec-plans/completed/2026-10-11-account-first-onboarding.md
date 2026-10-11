# Account-first onboarding

Status: Complete
Owner: Codex
Created: 2026-10-11

## Goal and acceptance criteria

User requirement: replace the confusing signed-out home → workspace settings
detour with polished, logical onboarding that establishes an account first.

- [x] Signed-out users see an account-first welcome screen, without mission,
  timeline, or workspace management controls.
- [x] Reuse existing browser authentication, with visible pending/code/cancel,
  error, retry, and automatic continuation states.
- [x] Authenticated users without a selected workspace can create or select one.
- [x] Existing authenticated users with a selected workspace enter Home directly.
- [x] Preserve Polar typography, colors, keyboard focus, and compact scrolling.
- [x] Exercise fresh-account browser approval, cancellation, workspace creation,
  and automatic Home entry through the native app at relevant window sizes.

## Context

`HomeScreen` passed `openWorkspaceSettings` to the empty state's account-settings
button. `App.tsx` now gates Home on authenticated identity and selected workspace;
`pages/onboarding/` composes existing account and workspace hooks. The old account
button also points to the actual Settings overlay. The hosted device page already
supports account creation and sign-in, so authentication protocols are unchanged.

Existing active plans cover capture recovery and mission evidence, not onboarding.
This record documents the implementation and completed desktop acceptance.

## Steps and progress

- [x] Inspect product, architecture, design, frontend rules, auth UI/handlers,
  workspace creation, related tests, and active plans.
- [x] Implement focused account/workspace setup and repair the incorrect link.
- [x] Add rendered-component tests and update frontend entry-point documentation.
- [x] Run required automated verification and inspect browser layouts.
- [x] Finish fresh-account native acceptance, then archive this plan.
- [x] Remove implicit workspace creation from first account bootstrap, update
  integration fixtures to create their workspaces explicitly, and verify new
  account → empty bootstrap → explicit workspace creation → restored workspace.

## Decisions and discoveries

- 2026-10-11, continuation: Direct code inspection found that first bootstrap
  automatically creates a private workspace and Rust immediately selects it.
  This would skip the advertised workspace step. The intended account-first,
  then user-created workspace flow requires removing that implicit creation.
  Existing accounts/memberships remain intact; no migration is needed.
- 2026-10-11, continuation: The previous session's shutdown output revealed a
  React Fast Refresh hook-order error after adding a hook to `useHomeScreen`.
  A clean launch is required to distinguish HMR state from a runtime defect.
  The clean managed launch successfully restored Home and completed the new flow.

- 2026-10-11: Setup is derived from actual account/workspace status, not a persisted
  welcome-dismissed flag. Session restoration has a loading state. Provider setup
  remains in its established flow after workspace setup.
- 2026-10-11: Reused `WorkspaceCreateSurface`; onboarding omits its Cancel button
  because there is no prior authenticated workspace to return to. Sign out remains
  available. Creation locks form inputs while pending.
- 2026-10-11: The managed development app restored the existing Weft workspace
  directly. The user then explicitly authorized signing out the development
  session. Fresh-account acceptance used a disposable development account and
  synthetic workspace; both were removed after signing out that test account.
- 2026-10-11: Step changes and cancel/retry restore heading focus and scroll to
  the top, so compact-window scroll position does not hide the next step.

## Verification

- `pnpm verify`: passed after escalation for local socket access. Includes 43
  native tests (five onboarding rendering cases), 67 Rust tests, and 33 server
  tests, plus lint, format, docs, frontend conventions, builds, and harness checks.
- Initial sandboxed run: two Rust local TCP listener tests failed with EPERM;
  the approved full rerun passed. Initial Vite SSR rendering tests passed but
  logged an EPERM WebSocket warning; the full approved run had socket access.
- Browser: signed-out welcome visibly reviewed at default size and viewport
  overrides 800×600 and 390×600, then override reset. Browser zoom meant the narrow
  CSS viewport was approximately 354px. Text and action remained reachable.
  Browser preview deliberately disables native sign-in.
- `pnpm --filter @polar/server test:integration`: passed, 9 live development
  integration tests. Verified signup/device approval, empty first bootstrap,
  explicit workspace creation/restoration, authorization, workspace lifecycle,
  and missions. Initial sandbox DNS resolution failed; approved network rerun
  passed. Temporary integration accounts were cleaned by the suite.
- Desktop: `pnpm native:status` ready; exact app
  `.polar-dev/Polar Dev.app`, native PID 1393, selected with the documented
  desktop-review helper. Verified existing-account Home restoration, authorized
  sign-out, keyboard activation, confirmation code/browser instructions,
  cancellation and retry, actual browser approval for a fresh test account,
  workspace form enablement and pending locking, native workspace creation,
  and automatic Home entry with the new private workspace selected.
- Native captures at compact and enlarged window sizes (1600×1200 and
  3024×1896 screenshot pixels) showed reachable content; compact pending-state
  scrolling reached cancel/browser controls. Exact point dimensions/backing
  scale were not independently measured. Browser narrow checks above supplement
  native review. No capture failure occurred.
- Error-state copy and browser-preview limitation are covered by rendered
  component tests; a live denied/expired sign-in was not forced. Rust protocol
  tests cover authentication failures. No provider flow was changed or tested.
- Final `pnpm verify` passed after the focus/scroll adjustment. Disposable native
  test account and cascading workspace data cleanup completed successfully.
  Final native welcome screenshot: `/private/tmp/polar-onboarding-final.png`.

## Handoff or outcome

Implemented and verified account → explicit workspace setup → Home. The managed
development app is signed out and shows the new welcome, ready for the user's
own sign-in. No remaining implementation steps. No packaged application was
rebuilt or installed; owner-maintained product, architecture, and design
references are unchanged.
