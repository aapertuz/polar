# Reliable desktop verification

Status: Complete
Owner: Codex
Created: 2026-10-08

## Goal and acceptance criteria

User approved a single documented procedure and shared executable instance
detection. Prevent duplicate development launches, distinguish this checkout from
other servers and stale packaged apps, and give the live macOS development app a
distinct automation identity. Reuse existing sessions without stopping them.
Keep credentials and application data in their existing locations.

- [x] Status identifies this checkout's server and native process, or explains gaps.
- [x] Repeated and concurrent starts cannot launch a second development session.
- [x] macOS automation selects the current development bundle while old Polar runs.
- [x] Frontend updates and Rust restarts reach that same development identity.
- [x] Verification procedure exists only in docs/VERIFICATION.md; AGENTS.md links to it.
- [x] Required verification and focused regression checks pass, with gaps recorded.

## Context

Neither existing active feature plan covers development tooling. Authentication's
remaining native smoke review is affected, but its product work is outside scope.
The baseline has unrelated authentication/Neon changes; preserve them.
The running packaged debug binary predates the rebuilt raw development binary.
CUA lists duplicate com.antoniopertuz.polar identities. The old bundle does not
follow Vite HMR. Current pnpm dev:native starts Tauri unconditionally.

## Steps and progress

- [x] Inspect launch scripts, Tauri/Cargo behavior, running instances, and docs.
- [x] Implement shared status/launch guard and development bundle runner.
- [x] Consolidate the verification procedure and wire regression checks.
- [x] Exercise live reuse, identity, HMR/rebuild, cleanup, and required checks.

## Decisions and discoveries

- 2026-10-08: Use Cargo's target runner through Tauri dev, preserving Tauri's Rust
  watcher. Copy each freshly built executable into an ignored development bundle
  with a distinct macOS plist identity. Leave Tauri's identifier and credential
  service names intact; do not edit generated target bundles.
- 2026-10-08: Put procedure in Verification, link from AGENTS; no extra skill or
  hook reminder. Add deterministic regression coverage for this repeated failure.
- 2026-10-08: Live rebuild initially exposed an orphaned app: a Node runner that
  spawned the native process did not share Cargo's lifecycle. Replaced it with
  a shell runner that prepares the bundle, then execs the app under the same PID.
  Added a deterministic PID/argument regression. Two subsequent Rust restarts
  and shutdown passed with no orphan.

## Verification

Read-only baseline: process inspection and bundle timestamps confirm stale bundle
selection; no Vite listener.

- `pnpm test:native-dev`: passed (5 regression checks, including eight simultaneous
  stale-lease claimants with exactly one winner and shell exec PID preservation).
- `pnpm check:docs`: passed.
- `pnpm verify`: sandbox run reached Rust tests, then a local-listener test failed
  with EPERM. Rerun outside sandbox passed: 9 frontend checker tests, 3 launch
  checks, 26 native frontend tests, 34 Rust tests, 9 server tests, checks/builds.
- `pnpm dev:native`: launched through Cargo target runner; status reports ready,
  exact development bundle, Vite PID, native PID, and the separate old bundle.
- CUA `getApp` using exact development bundle path selected Polar Dev with WebKit
  URL localhost:1420; old packaged Polar remains running.
- Repeated `pnpm dev:native`: returned success without launching processes; same
  Vite/native PIDs. Ownership file also blocks starts during startup/rebuilds.
- Frontend reload: temporary document title reached the actual Polar Dev WebKit
  tree. Restored the exact original title afterward.
- Rust watcher: temporary comment and its removal each caused rebuild/restart.
  Native PID changed, Vite PID stayed fixed, CUA rebound to the same bundle path.
  Restored main.rs exactly. Settings showed current Polar account and ChatGPT
  sections. Account status remained pending; live authentication was not tested
  and the authentication feature plan stays active.
- Ctrl+C: stopped this review's native app, runner/watcher, and owned Vite server;
  old packaged Polar PID 39496 remained. Final status reports stopped development.
- Vite-only reuse: started standalone Vite PID 70705, then guarded native launch.
  Same Vite PID and null server session were retained; native automation identity
  was verified by status. Native shutdown preserved that independent server.
  Stopped the standalone server afterward because this review created it.
- Foreign listener / wrong-checkout probe: temporary HTTP server on 1420 caused
  port-conflict and launcher exit 1 in both cases. No native process launched and
  the test listener remained alive. Test server closed afterward.
- Linux was not exercised; Windows guard is unsupported. Production Tauri bundle
  configuration was not changed; packaging build not required for this dev runner.
- Final `pnpm verify` after relative-process detection adjustment: passed all
  checks/builds, 9 frontend checker tests, 5 launch regression tests, 26 native
  frontend tests, 34 Rust tests, and 9 server tests. `git diff --check` passed.

## Handoff or outcome

Delivered guarded launch/status commands, exact macOS development automation
target, regression coverage, and one procedure in docs/VERIFICATION.md linked
from AGENTS.md. No skill or hook instructions were added. Existing unrelated
authentication/Neon work was preserved. All temporary source probes were restored.
Review-created sessions were stopped; the existing packaged Polar app remains.
Platform follow-up is recorded in the debt tracker. Authentication's live smoke
review remains in its own active plan.
