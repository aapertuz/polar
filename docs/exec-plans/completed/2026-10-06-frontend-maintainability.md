# Frontend maintainability refactor

Status: Complete
Owner: Codex
Created: 2026-10-06

## Goal and acceptance criteria

Apply the user's six code-quality requirements throughout the current React frontend,
preserving the fixture-based experience, visual design, accessibility, and desktop behavior.
This session executes the existing plan.

Explicit requirements:

- All application-local TypeScript/TSX imports, re-exports, and source stylesheet imports
  under `native/src/` use `@/`, resolving to `native/src/`. External package imports retain
  their package names. Import groups follow one documented convention.
- Behavioral components/screens call one master hook that composes focused hooks for
  distinct responsibilities. State, effects, event handlers, and nontrivial derivation
  live outside render functions. Pure calculations belong in utilities, not fake hooks.
- Named defaults, mission/tab identifiers, responsive configuration, motion settings,
  and sample calendar/countdown/notification data have explicit owners. Components
  consume those values instead of embedding domain/configuration literals.
- Large render blocks become cohesive named components, including window header actions
  and each overlay body. Split by responsibility rather than a mechanical line threshold.
- Overlay selection uses an exhaustive typed object mapping kinds to component references,
  with title and surface metadata. No JSX-returning switch or immediately invoked render
  function. Mission tab selection also uses a typed component registry.
- JSX contains named handler references rather than inline event/ref callbacks. Filtering,
  lookup, sorting, slicing, calculations, and request construction occur outside JSX.
  Simple rendering conditions and `.map` callbacks that instantiate named components
  remain permitted; these are rendering, not interaction or domain logic.
- Durable frontend rules and automated checks cover enforceable regressions, run through
  existing verification, and include tests proving that violations fail.
- Existing behavior checks pass and relevant desktop smoke scenarios are exercised.

Scope: all existing `native/src/` components, hooks, utilities, fixtures, and associated
configuration/tests; frontend-specific documentation and checks. No backend feature,
native command, persistence, package upgrade, or visual redesign is requested.

## Context and audit

References: [product](../../PRODUCT.md), [architecture](../../../ARCHITECTURE.md),
[design](../../DESIGN.md), [verification](../../VERIFICATION.md),
[hooks](../../HOOKS.md), [local procedures](../../../.agents/skills/README.md).
No active execution plan existed at inspection. Git working tree was clean.
The target architecture is not authorization to build future product modules.

| Requirement | Confirmed evidence | Consequence |
| --- | --- | --- |
| Alias imports | `native/src/pages/home/HomeScreen.tsx:4–16`; relative source imports across features/shared UI; no Vite alias or TS paths | Deep paths obscure relationships and make moves costly |
| Separate logic | `HomeScreen.tsx` owns seven states, refs, responsive detection, selection/reset and overlays; `DesktopWindow.tsx` combines dragging, measuring, keyboard movement and modal focus; `MissionWindow.tsx` owns keyboard navigation and scroll effects; `Dialog.tsx`/`Popover.tsx` own lifecycle and positioning | Unrelated responsibilities and lifecycles are difficult to inspect and verify |
| Owned defaults/data | Home defaults `pilot`, `Overview`, `1180px`; calendar uses `30`, indices `3`/`19`, November 2026 and `pilot`; countdown uses `00`/`35`; switcher displays literal mission count `3`; timeline truncates at `4` | Repeated knowledge can drift; sample data is mixed with rendering |
| Cohesive components | `HomeScreen.tsx` 191 lines includes both window shells and their actions; `HomeOverlays.tsx` 280 lines contains eleven bodies; `DesktopWindow.tsx` 222 lines mixes behavior and presentation | Changes require reading several unrelated concerns |
| Registry composition | `HomeOverlays.tsx:50` switches across eleven full JSX bodies; `MissionWindow.tsx` nests tab selection ternaries | Selection, metadata and body implementation are coupled |
| Named handlers/derived models | Inline handlers throughout home, timeline, mission components, island/rail and shared surfaces; repeated search `filter`/`some`; owner lookup and activity slicing in timeline JSX; arithmetic in overview/progress rendering | Repeated request assembly and hidden logic make render trees harder to read |

Additional findings to address within this refactor:

- `missions.find(...)!` assumes every selected ID exists. Validate against available fixtures
  in the selection hook; invalid IDs keep the current selection (implementation proposal).
- Existing boundary tests skip all non-relative imports. Introducing `@/` without updating
  the checker would silently disable dependency-boundary coverage.
- `homescreen-layout.test.ts` checks source text in specific files. Extraction will invalidate
  these checks even when behavior is preserved; replace structural assumptions with rendered
  assertions where practical, retaining useful CSS checks.
- `SystemRail.tsx` is currently unused but still contains the same patterns. Include it in
  the audit/refactor without adding it to the rendered homescreen.
- Sample calendar and notification are intentionally previews. Preserve their fixed date
  and F1 Pilot association; do not turn them into live calendar/notification functionality.

## Decisions and discoveries

- 2026-10-06: This is a behavior-preserving frontend refactor, not a redesign. Preserve
  CSS classes, markup semantics, portal behavior, overlay keys, focus restoration, motion
  policy, current fixture content and the `1180px` breakpoint.
- 2026-10-06: `@/` is the requested project convention; relative imports are not inherently
  invalid industry-wide. Configure both compiler and bundler rather than doing text replacement alone.
- 2026-10-06: Interpret separation of concerns as logic living in hooks (the user's wording
  says components “should have logic inside” but immediately requires abstraction into hooks).
  Stateless components do not need empty master hooks. Behavioral components do.
- 2026-10-06: Name meaningful values and default state objects at their owner. Ordinary
  `null`, `false`, zero indices and static UI copy need not become global constants. Initial
  states may use named default objects without inventing constants such as `FALSE`.
- 2026-10-06: Proposed prevention mechanism is a frontend-conventions document linked from
  AGENTS.md plus a deterministic AST check integrated into `pnpm check`. General conventions
  belong in documentation; a new specialized skill is unnecessary. Existing Git hooks already
  call check/verify. No additional global hook or permission flow is needed.
- Proposed paths, hook names, registry shape and invalid-ID handling below are implementation
  proposals, not additional product requirements. Resolve types against current code during execution.

## Steps and progress

- [x] Inspect affected source, callers, test/configuration setup and project references.
- [x] Record audit, acceptance criteria, preservation constraints and prevention proposal.
- [x] 1. Configure aliases and preserve dependency-boundary enforcement.
  - Modify `native/tsconfig.json` with `paths: { "@/*": ["./src/*"] }` and
    `native/vite.config.ts` with an absolute `@` alias derived from `import.meta.url`.
  - Convert local imports throughout `native/src/`, including side-effect imports and types.
    Keep tests' direct Node utility imports relative unless their runtime is explicitly configured.
  - Update `native/tests/frontend-boundaries.test.ts` to resolve both aliases and relative
    specifiers, including re-exports; reject page imports from features/shared code and
    cross-feature internal dependencies. Test the resolver against deliberately invalid imports.
  - Verify native TypeScript/build and boundary tests before further extraction.
- [x] 2. Establish owned constants and a home master hook.
  - Create `native/src/pages/home/constants/home.constants.ts` for home defaults/breakpoint;
    `native/src/features/missions/constants/mission.constants.ts` for mission identifiers/tabs;
    `native/src/pages/home/fixtures/home-preview.fixtures.ts` for calendar/notification data.
    Keep motion defaults with `native/src/components/ui/motionPolicy.ts` and desktop defaults
    with `native/src/components/desktop/constants/desktop.constants.ts`.
  - Create `pages/home/hooks/useHomeScreen.ts` composing `useMissionSelection`,
    `useHomeTimeline`, `useHomeOverlay`, existing `useDesktopWindows` and `useMediaQuery`.
    Selection owns mission/tab/instant transitions; timeline owns visibility/drawer/expansion;
    overlay owns open/close state. The master coordinates mission-change expansion reset.
  - Return a typed render model with mission, refs, window models and named handlers.
    Preserve stable close callbacks used by effect lifecycles.
  - Verify default selection, tab reset, expansion reset, keyboard immediate transitions,
    invalid selection behavior, desktop toggle versus compact drawer, reset-layout behavior.
- [x] 3. Extract home composition and window actions.
  - Create `pages/home/components/HomeMissionWindow.tsx`, `HomeTimelineWindow.tsx`,
    `MissionWindowActions.tsx` and `TimelineWindowActions.tsx`. Extract desktop artwork only
    if it improves screen readability. Keep home rendering as composition of these surfaces.
  - Actions consume named calendar/menu/close handlers from their master hooks, preserving
    `event.currentTarget` anchors and `event.detail === 0` keyboard activation policy.
  - Verify close/backdrop/Escape, focus-return ref, window focus IDs, hidden timeline trigger,
    unchanged date and shell classes at desktop and compact sizes.
- [x] 4. Replace overlay monolith with typed component registries.
  - Create eleven bodies under `pages/home/components/overlays/`: `SearchOverlay`,
    `LauncherOverlay`, `DocumentsOverlay`, `SettingsOverlay`, `NotificationsOverlay`,
    `PeopleOverlay`, `CreateOverlay`, `ProposalOverlay`, `CalendarOverlay`, `DetailOverlay`,
    `WindowMenuOverlay` (each `.tsx`).
  - Create `pages/home/config/overlayRegistry.ts` with an exhaustive
    `Record<OverlayKind, OverlayDefinition>` storing component references, title and surface
    (`dialog` or `popover`). Do not call components as functions or construct every body eagerly.
    Keep page-owned registry out of shared UI to preserve dependency direction.
  - `useHomeOverlays` resolves the selected definition and common selection/close sequencing;
    `useSearchOverlay` owns query, named change handler and a single filtered mission list;
    `useCalendarOverlay` derives day models from preview fixtures. Other behavioral bodies
    compose focused event hooks; purely static bodies receive props.
  - Extract reusable mission-choice/evidence rows where markup and semantics actually match.
    Avoid a generic overlay framework or sharing near-duplicates with different behavior.
  - Verify all eleven kinds resolve; search empty/case-insensitive results and query reset;
    choose closes after selection with original instant flag; documents open anchored details;
    menu performs action then close; calendar keeps sample today/deadline; dialog/popover
    choice and custom title precedence remain unchanged. Compile-time coverage rejects missing kinds.
- [x] 5. Separate remaining feature and shared component behavior.
  - `useMissionWindow` composes `useMissionTabs` and mission-scroll reset; extract mission hero
    and tab button components. Use a typed mission tab component registry. Compute navigation
    from tab count rather than duplicated `3`/`2` literals.
  - Add master hooks for behavioral mission overview/context/switcher and timeline components;
    move progress calculations, owner lookup, visible activity derivation and overlay handlers
    into focused hooks/utilities. Extract mission cards, evidence and timeline rows so item
    handlers are named without hook calls inside loops. Derive mission count from fixtures.
  - `useDesktopWindow` composes focused bounds/resize, drag, keyboard move and modal-focus
    hooks under `components/desktop/hooks/`. Preserve current MotionValue ownership and cleanup.
  - `useDialog` and `usePopover` compose focused focus/dismissal/positioning hooks under
    `components/ui/hooks/`; `useAnimatedContent`, `useSystemIsland`, `useSystemRail` and
    `useProgressRing` own their existing behavioral/derived models where needed.
  - Keep utilities independent of React; do not overuse memoization or add reducer/context
    state solely to satisfy the abstraction policy.
  - Verify tabs ArrowLeft/Right/Home/End and roving focus, scroll reset, truncated/expanded
    activity, motion/inert exit state, resize recovery, keyboard move cancellation, bounds,
    focus traps, outside/Escape dismissal and listener cleanup/remount behavior.
- [x] 6. Add durable conventions and enforceable regression checks.
  - Create `docs/FRONTEND.md` documenting aliases/import order, ownership/defaults, focused
    hooks/master composition, render-only JSX, component extraction, typed registries and
    KISS/DRY exceptions. Add a concise link in `AGENTS.md` and `docs/README.md`.
    Do not modify PRODUCT.md, ARCHITECTURE.md or DESIGN.md.
  - Create `scripts/check-frontend.mjs` using the installed TypeScript AST API; resolve it
    through the native package's module context rather than an undeclared root dependency.
    Add `scripts/check-frontend.test.mjs` with passing/failing synthetic fixtures.
  - Enforce local source aliases; reject inline JSX event/ref callbacks and JSX-returning
    switch/IIFE rendering; reject direct state/effect/ref lifecycle hooks in component files
    and multiple custom-hook calls inside a behavioral component. Make diagnostics name file,
    location, violated convention and corrective action. Follow imported aliases when checking hooks.
  - Verify dependency boundary detection also handles `@/`; avoid regex-only parsing of TSX.
    Review constant ownership and component cohesion manually: static checks cannot prove
    single responsibility, meaningful names, good abstraction or scalability.
  - Add `check:frontend` and a checker-test command to root scripts and integrate both into
    `pnpm check` (therefore `pnpm verify` and existing Git hooks). Update docs/VERIFICATION.md
    and docs/HOOKS.md to describe actual guarantees. Check hook setup without replacing it.
  - Prove each prohibited pattern fails and permitted simple rendering maps/conditions pass;
    prove hook aliases, side-effect imports and re-exports cannot bypass checks. No arbitrary
    file-length error or blanket ban on all literals.
- [x] 7. Verify the complete refactor and close the plan.
  - Repair source-text layout assertions affected by extraction; prefer rendered semantic
    assertions. If DOM/hook testing needs new tooling, add the smallest suitable test-only
    dependency through pnpm and update the lockfile. This is a proposal, not a preset dependency.
  - Run targeted behavior tests, checker tests, `pnpm check:docs`, and `pnpm verify`.
  - Run `pnpm dev:native` and the homescreen smoke review in docs/VERIFICATION.md, including
    all specified sizes, all overlays, keyboard focus, dragging/resizing and reduced-motion
    policy. Report any manual scenario that could not be exercised. Packaging is unchanged.
  - Review each acceptance criterion, update this plan after each task, and move it to
    completed only after implementation and required verification succeed.

## Verification

Implementation verification on 2026-10-06:

- `pnpm format`: passed; formatted supported source and config files.
- `pnpm --filter @polar/native test`: passed, 15/15. Coverage includes import boundaries,
  layout/CSS assertions, motion policy, overlay registry coverage and window geometry.
- `pnpm check:frontend`: passed for 86 frontend source files.
- `pnpm test:frontend-check`: passed, 9/9 synthetic regression fixtures (prohibited patterns
  fail and allowed rendering patterns pass).
- `pnpm --filter @polar/native check`: passed.
- `pnpm check:docs`: passed.
- `pnpm verify`: passed end to end, including format check, lint, docs/frontend checks,
  checker tests, native/server TypeScript checks and builds, native tests (15/15), Rust
  formatting/check, Rust test command, and server tests (4/4). Rust test command discovered
  zero tests; it verifies compilation/harness execution, not Rust behavior coverage.
- `git diff --check`: passed.
- Browser preview interaction review was performed on the existing localhost:1420 Vite
  session: mission selection/tab changes, popover and dialog Escape/focus return, calendar
  preview, timeline visibility, pointer drag, keyboard move/cancel and layout reset were
  observed. This is browser preview evidence only, not the required Tauri smoke review.
- `pnpm dev:native`: attempted; could not start because port 1420 is already occupied by
  Node PID 21798 (`lsof -nP -iTCP:1420 -sTCP:LISTEN`). That pre-existing process was left
  untouched. The user subsequently confirmed they completed the desktop smoke review
  successfully; this user-performed verification is accepted for the documented smoke
  scenarios, including sizes, overlays, keyboard focus, window movement/resizing and reduced
  motion. The agent's direct Tauri launch attempt remains blocked by the existing listener.

## Handoff or outcome

All acceptance criteria are complete. The plan is ready to archive in `completed/`.

### Execution log

- Step 1: configured compiler/bundler aliases and converted source imports. Boundary parsing uses TypeScript AST and covers aliases, relative imports, side effects and re-exports. Native build passed; boundary tests passed (2/2).
- Step 2: added owned defaults/preview fixtures and focused home selection, timeline and overlay hooks. Invalid mission IDs preserve selection; mission/tab state and timeline state are coordinated by `useHomeScreen`.
- Step 3: extracted home window shells and named action components; browser preview confirmed selection, tab update, dismissal/focus restoration and window visibility behavior.
- Step 4: extracted all eleven overlay bodies and added an exhaustive typed registry with component-reference coverage; calendar remains tied to the sample preview date.
- Step 5: moved feature, shared UI and desktop behavior into master/focused hooks; added named mission/timeline/overlay item components. Composed desktop model from bounds, drag, movement and modal-focus hooks. Native geometry/motion tests pass.
- Step 6: added `docs/FRONTEND.md`, links from `AGENTS.md` and `docs/README.md`, AST convention checker and nine checker regression tests; integrated checks into `pnpm check`/`pnpm verify` and updated verification/hook docs.
- Step 7: targeted tests, `pnpm check:docs`, `git diff --check` and full `pnpm verify` passed. The agent could not launch Tauri because port 1420 was occupied; the user then confirmed successful completion of the required desktop smoke review. All acceptance criteria are verified and this plan is complete.
- Workflow: user requested direct execution in this checkout with no sub-agents; use this plan as the progress ledger, preserve uncommitted changes, and perform final self-review.
