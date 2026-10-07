# Homescreen UI implementation plan

Status: Complete
Owner: Codex / Antonio
Created: 2026-10-06

## Goal and acceptance criteria

Build Polar's homescreen from the user-provided reference image: a premium desktop operating environment with hardcoded mission data, draggable work surfaces, and restrained Motion interactions. The home should immediately answer: which mission is active, what needs attention, and what should happen next?

The initial request was planning only. On 2026-10-06 the user instructed Codex to implement the saved plan. The proposed UI interactions and visual adaptations below now define the implementation scope; newly discovered consequential ambiguities must still be clarified.

Acceptance criteria for eventual implementation:

- [x] The initial desktop composition matches the reference's hierarchy: warm light canvas, compact left rail, three mission cards, dark central mission window, light timeline, and top-centered black system island.
- [x] F1 Pilot is initially selected; US Sales and Product are available. Selecting a mission updates its title, outcome, facts, overview, plan, context, and timeline from consistent fixtures.
- [x] Overview shows one contextual risk/recommendation and a quiet summary strip. Upcoming actions appear in the timeline, without a second duplicate list in Overview.
- [x] Overview, Plan, and Context are usable tabs with hardcoded content, accessible selection states, and interruptible transitions.
- [x] Mission and timeline windows can be dragged independently from their header areas, brought forward on interaction, and reset to their default positions. Dragging does not interfere with text selection, scrolling, or controls.
- [x] Dragged windows stay reachable when the viewport changes, panels are toggled, or responsive breakpoints are crossed. Positions survive mission switching within the mounted app, and reset on reload.
- [x] Visible controls have defined UI responses, clear hover/press/focus feedback, and accessible labels. Demo responses do not claim actual data was saved or a real plan changed.
- [x] Motion uses the `motion` package, imported from `motion/react`; reduced motion removes nonessential spatial animations while retaining direct dragging and clear state feedback.
- [x] The screen remains usable at 1672×941 (reference), 1440×900, 1280×800, 1024×768, and the existing 800×600 Tauri window. Narrow layouts are readable rather than scaled-down desktops.
- [x] Keyboard navigation, focus return, Escape dismissal, contrast, and countdown text alternatives are verified. Dragging has a keyboard alternative.
- [x] `pnpm verify` passes and changed interactions are exercised with `pnpm dev:native`. Actual checks and limitations are recorded below before completion.

Scope is presentation and ephemeral UI state. Server operations, Rust commands, persistence, authentication, live weather/time/countdowns, AI reasoning, real mission creation, file operations, OS notifications, integrations, and a native notch companion are outside this change. Windows mean floating surfaces inside the existing Tauri app, not separate native windows. Native window resizing, snapping, and minimization are outside scope.

## Context

Read before execution:

- [Product](../../PRODUCT.md): mission-oriented attention, contextual recommendations, checkpoints and actions.
- [Design system](../../DESIGN.md): tokens, spatial hierarchy, components, accessibility, responsive breakpoints, and motion timing.
- [Architecture](../../../ARCHITECTURE.md): React presentation boundary; proposed future architecture is not implemented scope.
- [Verification](../../VERIFICATION.md) and [plan workflow](../../PLANS.md).

Inspected baseline:

- `native/src/App.tsx` is the Tauri/React greeting template; its only IPC call is `greet`.
- `native/src/App.css` contains starter styles; no reusable Polar UI components or tokens exist yet.
- `native/src/main.tsx` mounts React 19 with StrictMode.
- `native/package.json` has React, Tauri API, and opener dependencies; Motion and an icon system are absent.
- `native/src-tauri/tauri.conf.json` creates an 800×600 window. Keep its existing configuration for this scope and adapt the UI to it.
- No relevant active plan existed. Working tree was clean at initial planning inspection.

The reference is Image #1 in the planning conversation (1672×941). Use it during visual review. Its initial local attachment path is `/var/folders/4n/698pn2x92c9b0_bng6gz6yw00000gn/T/clipboard-2026-10-06-175945-DFFBAA41.png`; this temporary path may not survive another session. The composition and decisions below preserve the brief independently of that file.

## Proposed design and decisions

### Composition and visual treatment

Use the documented canvas `#E9E9E6`, near-black window `#0C0C0C`, light surface `#F7F7F4`, scarce Polar red, 22px mission-window corners, 16px supporting-panel corners, and documented spacing. Use a broad restrained shadow for the mission window. Preserve thin separators, compact rings, mono mission titles, readable sans body text, and a dot-matrix deadline.

Use locally bundled open-license Geist Sans/Mono and Doto font assets, with license notices, if available during implementation; documented system fallbacks keep the screen usable if acquisition is blocked. Draw simple consistent geometric SVG icons and the documented open-ring Polar mark; no icon-library dependency is required.

Place fine static grain and cropped geometry behind work surfaces; never behind text. The reference's large red disc should be reduced in dominance to honor the design system's scarce-red rule. Use flat surfaces rather than the reference's incidental gradients. Keep primary body text at least 14px and visible focus rings on dark and light surfaces.

Retain the reference's F1 Pilot outcome, 60% demo progress, 287/300 attendees, 3/6 checkpoints, and Nov 20 deadline. Freeze the sample clock to Nov 4, 2026, 15:24 and countdown to `16 : 00 : 35`; it is illustrative, not a ticking timer. Use the correct weekday and coherent future deadlines for the other mission fixtures. Replace reference labels “milestones” and “key tasks” with “checkpoints” and “actions.” Remove repeated remaining-time emphasis from the bottom summary; use overall progress, checkpoints, and action count there.

### Interaction contract

| Surface/control | Planned local UI response |
| --- | --- |
| Mission cards | Select fixture, update related content, preserve window position, and reset mission tab to Overview. |
| Overview / Plan / Context | Select tab. Plan shows a short checkpoint sequence and dependency explanation; Context shows brief, constraints, people, and evidence provenance. |
| Apply to plan | Open a demo preview of the proposed adjustment, with existing/proposed explanation. Closing returns focus; an optional preview confirmation says “Preview only” and never changes fixtures or marks work done. |
| Mission overflow | Open anchored menu with Reset layout and Show/Hide timeline. |
| Timeline action/activity row | Open a compact read-only detail popover with fixture owner, timing, and context. |
| View all | Expand recent activity within the timeline's scroll area; label becomes Show less. |
| Timeline calendar | Open read-only sample-date popover. |
| Add mission | Open a compact demo creation preview; no submission or fixture mutation. |
| Rail search | Open accessible local search overlay filtering hardcoded missions; selecting a result selects that mission. |
| Rail home / apps / documents / settings | Home returns to desktop; remaining controls open compact fixture-based launcher, context index, or appearance-preview popovers. No new application pages or settings persistence. |
| Island notification / people / launcher | Open compact read-only fixture popovers, reusing launcher content where appropriate. Sample weather and clock are display-only. |
| Window header | Pointer drag; grab/grabbing cursor, focus/raise, restrained lift feedback. |

Only one global popover/dialog is open at a time. Outside click closes nonmodal popovers; Escape closes overlays; dialogs trap focus and return it to the trigger. Local search is the only input needed; avoid building backend-shaped forms.

### Window movement and responsiveness

Use one reusable `DesktopWindow` for mission and timeline. Start drags through `useDragControls` on the noninteractive header region, with `dragListener={false}`, `dragMomentum={false}`, and `dragElastic={0}`. Keep pointer tracking direct; do not smooth the window behind the pointer or fling it on release. Header buttons never initiate drag. Use motion values for x/y to avoid React updates on every pointer event.

Raise a window on pointer interaction or focus entering it; keep island, anchored navigation, and overlays above the work windows. Allow mission/timeline overlap. Use the entire desktop canvas for movement bounds, including the space occupied by mission cards. Allow partial offscreen placement while retaining at least 160px of header width and 48px of header height. Measure the canvas and surface dimensions, and clamp offsets after resize or content-size change so the header remains reachable. Avoid scaling a shared ancestor of draggable surfaces.

Provide an accessible Move window menu: arrow keys move by 16px, Shift+arrow by 4px; Enter finishes, Escape restores the pre-move position. Reset layout restores both windows and provides recovery without dragging. Coordinate calculations should live in pure helpers for deterministic behavior checks when implementation is authorized.

At desktop widths above 1280px, use the documented three-zone composition with the central window taking the remaining width. At 1180–1280px, compress spacing without shrinking text; below 1180px, timeline becomes an on-demand supporting panel. Below 900px, replace mission cards with a compact mission selector. At 800×600, use a readable main mission surface with internal content scrolling and a timeline drawer; retain free dragging in the native desktop app even when the primary surface fills the workspace; compact browser layouts may remain fixed. On narrow layouts, use one column and a dedicated timeline view. Restore/clamp desktop positions when returning to a wide layout. Decorative geometry recedes at smaller sizes.

### Motion specification

| Interaction | Timing and behavior |
| --- | --- |
| Hover | 100–140ms surface/border feedback; no card translation. |
| Press | Subtle 0.98 scale on pointer press; immediate feedback and release within 140–180ms. |
| Tabs | 140–180ms selected-indicator transition; content crossfade without moving the window. |
| Mission switch | 220–280ms content opacity and at most 4px movement; geometry and drag offsets remain stable. |
| Popovers/panels | 180–220ms entry, shorter exit; origin anchored to trigger, scale starts at 0.98. |
| Window drag | Direct pointer movement; restrained elevation change, no bounce, inertia, or continuous decorative motion. |
| First appearance | Optional brief opacity reveal; controls are immediately usable. No repeated intro animation. |

Default easing: `[0.2, 0.8, 0.2, 1]` from the design system. Use `MotionConfig` with reduced-motion support and `useReducedMotion` for custom behavior; reduced motion keeps opacity feedback and removes spatial reveals, scale, and animated layout resets. Keyboard-driven interactions change state immediately. Isolate drag transforms on the outer window and content transitions on inner elements so they cannot compete. Avoid long staggers, animation on every countdown digit, and expensive repeated grain/blur paints.

Official implementation references: [Motion dragging](https://motion.dev/docs/react-drag) and [Motion accessibility](https://motion.dev/docs/react-accessibility), inspected during planning. Verify APIs again if execution happens after library changes.

### Approach selection

Recommended: React components, CSS tokens, typed fixtures, and Motion for window gestures and transitions. It provides the requested spatial experience with one new runtime dependency and no native boundary changes.

Alternatives considered: a static grid would reproduce the image but miss the requested dragging; separate Tauri windows would require native lifecycle and permission work beyond the UI-only scope. A global state library is unnecessary for the small amount of ephemeral state.

## Steps and progress

- [x] Inspect current UI, dependencies, active plans, product, design, architecture, and verification workflow.
- [x] Define scope, interaction responses, movement behavior, responsive rules, motion, and acceptance criteria.
- [x] Write and review this plan; no application changes made.
- [x] **1. Build the visual desktop and fixtures.**
  - Modify `native/src/App.tsx` to mount `HomeScreen`, removing the starter greeting UI and its IPC call from the screen.
  - Replace starter rules in `native/src/App.css` with global reset and documented tokens; create `native/src/styles/tokens.css` if separating tokens improves clarity.
  - Use `native/src/pages/home/HomeScreen.tsx` for page composition and `pages/home/styles/` for page-specific CSS. Put domain UI types and fixtures under the owning feature's `types/` and `fixtures/` folders.
  - Put mission components under `native/src/features/missions/components/`, timeline/attention components under `features/attention/components/`, and the shared rail and system island under `components/desktop/components/`; focused components own their surface rendering.
  - Create shared `native/src/components/ui/PolarMark.tsx`, `Icon.tsx`, and `ProgressRing.tsx`; use existing tokens and consistent SVG strokes.
  - Add any acquired font assets and licenses to `native/src/assets/fonts/`. Establish the default composition and responsive layout before motion tuning.
  - Check initial fixtures, primary hierarchy, narrow-window overflow, and absence of network/IPC calls.
- [x] **2. Add tabs and local demo responses.**
  - Add `MissionOverview.tsx`, `MissionPlan.tsx`, `MissionContext.tsx` inside `native/src/features/missions/components/`.
  - Own selected mission, selected tab, timeline visibility, expanded activity, and active overlay in `HomeScreen`; fixture modules remain immutable.
  - Create reusable `native/src/components/ui/Popover.tsx` and `Dialog.tsx` for dismissal, focus management, and accessible labels; create `pages/home/components/HomeOverlays.tsx` for page-level demo composition.
  - Exercise every interaction-contract row with pointer and keyboard. Confirm selecting missions updates timeline and context together and demo previews do not mutate progress.
- [x] **3. Add constrained draggable windows and Motion.**
  - Install with `pnpm --filter @polar/native add motion`; commit both package manifest and package-manager-generated `pnpm-lock.yaml` changes when committing implementation.
  - Create `native/src/components/desktop/components/DesktopWindow.tsx` and `native/src/components/desktop/hooks/useDesktopWindows.ts` for handles, active stacking, offsets, constraints, resize recovery, and reset. Keep the reusable media-query hook in `native/src/hooks/useMediaQuery.ts`.
  - Create `native/src/components/desktop/utils/windowGeometry.ts` for pure bounds/movement helpers. Verify edge clamping, windows larger than available area, repeated viewport resize, and keyboard cancellation using focused deterministic checks when authorized.
  - Implement the motion table using `motion/react`, `AnimatePresence`, shared tab indicators where appropriate, and reduced-motion configuration. Ensure exit animations do not retain keyboard-focusable hidden content.
  - Exercise rapid switching, interrupted overlays, pointer leaving a header, dragging after scrolling, header-button clicks, window overlap, layout reset, and breakpoint transitions.
- [x] **4. Review visual fidelity and accessibility in the desktop app.**
  - Run `pnpm dev:native`; inspect all target sizes against the reference and tokens. Capture review screenshots during implementation if tools permit.
  - Check tab semantics, focus order/return, move menu, screen-reader countdown text, target sizes, reduced motion, and readable metadata.
  - Tune spacing and motion without broadening scope; keep decorations subordinate to the active mission.
- [x] **5. Run required verification and close out.**
  - Run `pnpm verify`, reporting actual results, prerequisite failures, and zero-test limitations accurately.
  - No packaging changes are planned; run `pnpm tauri build` only if execution introduces packaging changes.
  - Record visual/interaction checks and any remaining gaps. Keep this plan active if acceptance criteria remain unmet.
  - When all criteria pass, mark Complete, move to `docs/exec-plans/completed/`, repair links, and record nonblocking follow-ups in the debt tracker.

## Decisions and discoveries

- 2026-10-06: Completed page/domain/shared folder migration. Home composes independent mission and attention components; timeline consumes a structural view type owned by attention. Extracted reusable media-query hook and mission progress helper; added import-boundary checks.
- 2026-10-06: Final contrast review found low-contrast notification count, mission count, breadcrumb separator, and avatar initials. Adjusted local styles without changing owner-maintained design tokens. Raised the timeline toggle above draggable surfaces so compact layouts retain a visible recovery control.

- 2026-10-06: User requested an explicit React folder convention in the architecture reference: Home is page composition, and domain features group components, hooks, utilities, types, and fixtures into subfolders. Updated `ARCHITECTURE.md` and this plan's target paths. At this documentation checkpoint, implementation files had not yet moved; migration was completed during final implementation review. The user's architecture-document request authorizes this focused reference update; product and design references remain unchanged.
- 2026-10-06: User requested implementation of the existing plan. Resume its UI-only scope; use the documented design decisions and the plan's proposed interaction contract without expanding functionality.
- 2026-10-06: Initial Motion installation hit an existing pnpm store mismatch. Reuse the existing store through an approved dependency-installation command rather than replacing the dependency tree.
- 2026-10-06: Native computer-use discovery selected an old installed app. Created a temporary review bundle in `/tmp` pointing to the actual development binary; its WebKit window loads the same Vite development URL. No application packaging configuration changed.
- 2026-10-06: Desktop review identified short-window header density, a hidden keyboard move control, drawer focus recovery, search autofocus, and WebKit header text selection during dragging. Corrected these before final verification.
- 2026-10-06: Added five deterministic window-geometry checks and included the native test command in `pnpm verify`; no UI test framework dependency was added.

- 2026-10-06: User authorized a plan only; this artifact is a proposed implementation design, not permission to execute it.
- 2026-10-06: Use in-app draggable mission and timeline windows. Anchored rail, switcher, and island retain orientation while work surfaces move.
- 2026-10-06: Preserve existing native configuration and capabilities. All data and interactions belong to React; no server or Rust changes are needed.
- 2026-10-06: Apply documented tokens and vocabulary where the image diverges. Do not modify the owner-maintained product, architecture, or design references.
- 2026-10-06: Keep the plan self-contained; a separate change spec would duplicate this UI-only brief. Planning was explicitly requested, so no additional process approval gates are added before producing the plan.

## Verification

Final acceptance review, 2026-10-06:

- Page/domain/shared migration compiles. Ten native checks pass, including two new import-boundary checks. Mission data stays in missions; attention receives its own structural view data through page composition.
- Final screenshots reviewed at 1672×941, 1440×900, 1280×800, 1024×768, and 390×843; actual native WebKit app reviewed at 800×600 and a wide window. Smaller surfaces scroll internally; compact layouts keep timeline access above movable windows.
- Keyboard tabs, local search autofocus/filter/selection, consistent mission/timeline updates, compact timeline focus looping, Escape dismissal and trigger focus return checked after migration. Earlier native/browser review covered all demo controls, proposals, people, documents, calendar, activity expansion, keyboard movement/cancellation, reset, and window overlap.
- Computed visible-text contrast reviewed for overview, plan, context, and search. Corrected the notification count, mission count, breadcrumb, and avatar initials; settled text states meet the documented thresholds. Countdown alternatives and selected tab semantics are present in accessibility snapshots.
- With explicit user permission, macOS Reduce motion changed from Off to On. Exercised native Plan tab and Window controls popover; browser media query confirmed the system preference. Restored Off and verified the setting afterward. Spatial-animation behavior is also covered by deterministic policy checks. An extra native coordinate drag attempt during this review encountered a computer-use window/pipe error; direct dragging was already verified in the earlier native drag review and no drag code changed in the migration.
- Final browser console review returned no captured errors or warnings. No backend, persistence, IPC, or native packaging behavior was added.

Dragging correction, 2026-10-06:

- User reported overly limited movement and prioritized native desktop dragging over browser behavior. Replaced central-workspace bounds with full-canvas bounds that allow partial offscreen placement; enabled dragging at every native window size.
- Actual native WebKit development app: moved mission window 400 CSS pixels left and 210 down across the mission-card area; independently moved timeline 350 pixels left and 85 up. Resized to 800×600 and dragged the mission window again. Verified Reset layout and focus return afterward.
- Pointer movement uses Motion values, no inertia, no elasticity, and no spring smoothing. Header controls do not initiate dragging, and WebKit text selection is suppressed on the drag handle.
- `pnpm --filter @polar/native test`: 8 passed, including revised bounds and resize recovery checks.
- `pnpm --filter @polar/native check`: passed.
- `pnpm verify`: passed after the dragging correction (documentation, both TypeScript checks/builds, 8 native checks, Rust formatting/compilation, and 4 server tests). Rust test commands discovered zero tests; they provide no Rust behavior coverage.
- Desktop/browser review of earlier UI interactions completed; manual reduced-motion emulation remains unverified. Deterministic motion-policy checks passed.

Implementation progress:

- `pnpm --filter @polar/native check`: passed after initial implementation.
- Motion installed with the existing pnpm store; Geist Sans, Geist Mono, and Doto downloaded from the Google Fonts repository with their OFL licenses.
- Components, typed fixtures, local demo overlays, constrained window dragging, keyboard movement, and responsive styles implemented. Visual/interaction verification was outstanding at this initial implementation checkpoint; the final acceptance review above records completion.
- First `pnpm dev:native` attempt failed because the sandbox denied the local Vite listener (`EPERM ::1:1420`); retrying outside the sandbox for desktop review.

Folder-convention documentation update:

- `pnpm check:docs`: passed on 2026-10-06 after updating the architecture reference and this plan's target paths.
- Reviewed the convention against the current source inventory: Home remains in `features/home` until migration; desktop hooks and geometry also await relocation. No application files changed in this documentation update, and no application behavior checks were run.

Planning change only:

- `pnpm check:docs`: passed on 2026-10-06; harness documentation checks passed.
- Plan review: scope, component responsibilities, motion timings, demo responses, drag recovery, responsive behavior, and future verification are specified.
- Application builds, tests, desktop launch, and behavior checks have not been run for this planning-only change. They remain implementation work.

## Handoff or outcome

The homescreen UI, dragging correction, folder migration, and acceptance review are complete. Final `pnpm verify` passed on 2026-10-06: documentation, both package TypeScript checks/builds, 10 native checks, Rust formatting/compilation, and 4 server tests. Rust commands discovered zero tests; no Rust behavior coverage is claimed. `git diff --check` passed.

No implementation work remains for the presentation-only homescreen. Backend functionality, persistence, and OS integrations remain outside scope. Automated native gestures/focus coverage and removal of the owner-maintained architecture reference’s historical migration note are recorded in the [technical-debt tracker](../tech-debt-tracker.md).
