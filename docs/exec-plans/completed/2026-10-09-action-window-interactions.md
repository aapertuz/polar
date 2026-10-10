# Action window interactions

Status: Complete
Owner: Codex
Created: 2026-10-09

## Goal and acceptance criteria

Explicit requirements: the action detail window is draggable and resizable;
document the desktop window standard in `docs/DESIGN.md`.

- [x] Drag the action window by its chrome without dragging from controls.
- [x] Resize from edges/corners with readable minimum dimensions and viewport limits.
- [x] Provide keyboard movement/resizing, scrolling, dismissal, and focus return.
- [x] Keep the header recoverable after the viewport changes.
- [x] Update the design guide.
- [x] Finish required verification and native gesture checks; browser results do
  not establish native pointer/focus behavior.

Scope stays in the UI. Existing action editing/completion controls remain visual.

## Context

The first action surface used a fixed modal dialog. Existing mission/timeline
windows already use shared drag, movement, and bounds hooks. Add shared resize
geometry/behavior and compose those hooks in the action window. The capture
investigation is separate and remains active; no duplicate capture plan.

## Steps and progress

- [x] Inspect the action surface, shared desktop hooks, documentation, and tests.
- [x] Implement window interaction and design guidance.
- [x] Verify and record outcomes.

## Decisions and discoveries

- User explicitly authorized updating the owner-maintained design guide.
- Implementation decision: show action details as a floating nonmodal window,
  preserving access to the desktop beneath it. Close explicitly or with Escape
  while the window has focus; clicking outside does not close a work window.
- Reuse existing bounded drag and keyboard movement hooks. Window geometry is
  local UI state for the open window; no persisted settings or backend changes.
- Native capture was blocked in the preceding review by a stale-binding
  rejection. Browser evidence must remain distinguished from Tauri evidence.
- Shared resize geometry and pointer/keyboard handlers are implemented. The
  action window now composes shared movement, bounds, and resizing hooks and
  retains its chrome while the body scrolls. The design guide is updated.
- Before live review, fresh status reports ready with a changed native PID
  74430 (previously 86031), launcher 74157, watcher 74296, and Vite 66588. This
  is a concrete application lifecycle change; bind the exact managed app for
  the new window interaction review. The prior blocked review is not reused.
- Native visual review revealed that `flex: 1` collapsed the body in an
  intrinsically sized dialog. Changed it to `flex: 1 1 auto`; a fresh native
  capture showed the complete window with the body restored and scrolling.
- The design guide defines the standard for all desktop work windows. Existing
  mission/timeline resizing is a follow-up, outside this action-window change.

## Verification

`pnpm check:frontend`, native TypeScript, and final `pnpm verify` passed after
the flex fix. The full suite includes four new resize geometry tests covering
all edges, anchored opposite edges, minimum/maximum dimensions, and tiny
workspaces, along with formatting, lint, docs/frontend checks, TypeScript,
builds, launcher/environment tests, native tests, Rust checks/tests, and server
tests. Local socket tests ran with approved sandbox escalation. Packaging did
not change, so no packaged build was required.

A temporary browser harness used the production action components. At
1323×788 CSS pixels, dragging changed position by exactly -100/+50, and southeast
resizing changed dimensions by +50/-104. Keyboard movement changed x by -16;
Escape restored the original position while leaving the window open. Keyboard
resize changed width by -16 and height by -4 with Shift. Scrolling reached the
footer without moving the header. Outside clicks kept the window open; Escape
closed it and returned focus to the opening control. At 800×600 and 390×700,
dimensions recovered to viewport limits, the 160px header strip remained
reachable, and the body had no horizontal overflow. A newly opened narrow
window fitted the viewport with 12px margins and scrollable content. The browser
viewport override was reset and the temporary harness removed.

Tauri visual appearance was captured successfully on native PID 74430. A
guarded drag failed with `Computer Use server error -10005: noWindowsAvailable`.
Fresh status stayed ready; the single recovery succeeded, without confirming
that drag applied. A subsequent independent click was rejected as a changed
binding. Evidence: captureState blocked, recoveryUsed true, failedOperation
click, bindingRefreshes zero. Stopped native automation; see the separate
[capture recovery plan](../active/2026-10-08-desktop-capture-recovery.md).

On 2026-10-09, the owner reported completing verification and requested moving
this plan to completed. This owner-provided manual verification closes the
remaining native acceptance checks. It is separate from the agent's browser
checks and blocked native gesture automation described above.

## Handoff or outcome

Implementation, automated verification, browser checks, and owner-provided
manual verification are complete. The action detail window moves and resizes,
keeps its chrome visible while content scrolls, and supports keyboard controls
and focus return. The desktop window standard is documented in `docs/DESIGN.md`.
Mission/timeline resizing remains a separately scoped follow-up in the
[debt tracker](../tech-debt-tracker.md). Capture automation remains under its
separate active investigation and does not block this completed feature.
