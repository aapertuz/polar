---
version: alpha
name: Polar
description: "Design system for Polar, a smart work operating system that orients teams around missions, context, decisions, and what matters next."
colors:
  canvas: "#E9E9E6"
  canvasSoft: "#F2F2EF"
  surface: "#F7F7F4"
  surfaceMuted: "#ECECE8"
  ink: "#111111"
  inkSoft: "#1A1A1A"
  window: "#0C0C0C"
  windowRaised: "#151515"
  windowMuted: "#1B1B1B"
  textOnLight: "#111111"
  textSecondaryOnLight: "#6F6F6A"
  textTertiaryOnLight: "#92928C"
  textOnDark: "#F4F4F0"
  textSecondaryOnDark: "#A6A6A0"
  textTertiaryOnDark: "#73736E"
  borderLight: "#D8D8D3"
  borderDark: "#2A2A2A"
  polarRed: "#F2382F"
  polarRedDeep: "#C92D26"
  polarRedWash: "rgba(242, 56, 47, 0.12)"
  success: "#88A95B"
  warning: "#C88A32"
  focus: "#6E9FD4"
typography:
  display:
    fontFamily: "Geist Mono, IBM Plex Mono, ui-monospace, monospace"
    fontSize: 40px
    fontWeight: 500
    lineHeight: 1.05
    letterSpacing: "-0.04em"
  title:
    fontFamily: "Geist Mono, IBM Plex Mono, ui-monospace, monospace"
    fontSize: 24px
    fontWeight: 500
    lineHeight: 1.15
    letterSpacing: "-0.025em"
  heading:
    fontFamily: "Geist Sans, Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: 16px
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Geist Sans, Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.45
  label:
    fontFamily: "Geist Mono, IBM Plex Mono, ui-monospace, monospace"
    fontSize: 12px
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: "0.01em"
  metadata:
    fontFamily: "Geist Mono, IBM Plex Mono, ui-monospace, monospace"
    fontSize: 11px
    fontWeight: 400
    lineHeight: 1.3
  countdown:
    fontFamily: "Doto, Geist Mono, ui-monospace, monospace"
    fontSize: 56px
    fontWeight: 700
    lineHeight: 0.95
    letterSpacing: "-0.03em"
rounded:
  xs: 4px
  sm: 6px
  md: 10px
  lg: 16px
  xl: 22px
  pill: 9999px
spacing:
  x1: 4px
  x2: 8px
  x3: 12px
  x4: 16px
  x5: 20px
  x6: 24px
  x8: 32px
  x10: 40px
  x12: 48px
  x16: 64px
components:
  missionWindow:
    background: "{colors.window}"
    textColor: "{colors.textOnDark}"
    rounded: "{rounded.xl}"
    borderColor: "{colors.borderDark}"
  timelinePanel:
    background: "{colors.surface}"
    textColor: "{colors.textOnLight}"
    rounded: "{rounded.lg}"
    borderColor: "{colors.borderLight}"
  insight:
    background: "{colors.polarRedWash}"
    accent: "{colors.polarRed}"
    rounded: "{rounded.lg}"
  primaryButton:
    background: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
  secondaryButtonDark:
    background: "{colors.windowRaised}"
    textColor: "{colors.textOnDark}"
    rounded: "{rounded.md}"
---

# Polar Design System

## Overview

Polar is a work operating system, not a conventional project management dashboard.

Its job is orientation: show the user where the work stands, what changed, what matters now, and what should happen next. The interface should feel like an operating environment that understands work rather than a database the user must maintain.

The core brand idea is:

> Orientation, not management.

The visual language combines quiet industrial minimalism, technical information displays, modern desktop operating system composition, and restrained editorial typography. It can feel adjacent to the spirit of Nothing OS, especially in its monochrome palette, dot matrix data displays, geometric primitives, and deliberate use of red, but it must not reproduce Nothing's proprietary fonts, icons, widgets, or exact layouts.

Polar should feel:

* Calm rather than busy.
* Precise rather than corporate.
* Intelligent rather than visibly "AI powered."
* Spatial rather than page based.
* Technical without looking like a developer tool.
* Premium without glassmorphism, decorative gradients, or luxury clichés.
* Opinionated without becoming visually loud.

### Product hierarchy

The visual hierarchy must reinforce the product model.

1. **Mission** is the primary unit of work. It describes an outcome.
2. **Next** is what matters now in order to move the mission forward.
3. **Plan** is the evolving execution path.
4. **Context** is what Polar knows and uses to reason about the mission.
5. **Timeline** is the temporal stream of upcoming actions and recent events.

Do not make "tasks," "tickets," "issues," or "milestones" feel like the top level model. They can exist as implementation details inside a mission, but the product should not visually collapse back into Jira, Linear, Asana, or a kanban board.

### Spatial metaphor

Polar behaves like a desktop work environment.

The light canvas is the operating environment. A selected mission opens as a dark window inside it. Supporting system surfaces remain visible around that window.

The default desktop composition is:

* Left: mission switcher.
* Center: opened mission window.
* Right: timeline.
* Top center: compact system island.

The central dark window is important. It creates the sensation that the user has opened a mission rather than navigated to another project page.

### Desktop window interaction

Polar is an operating environment. Desktop work surfaces, including mission,
timeline, and action detail windows, must support moving and resizing.

* Drag a window by its title bar or empty chrome. Buttons, inputs, links, and
  reading content must retain their normal interaction.
* Resize from the edges and corners. Show a quiet grip at the lower right and
  use directional resize cursors. Keep minimum dimensions readable and cap
  window dimensions to the available workspace.
* Keep window chrome visible while its content scrolls. A smaller window must
  preserve access to every section through scrolling and responsive reflow.
* Allow partial offscreen placement while retaining a usable strip of the title
  bar. Recover the title bar and fit the window when the workspace becomes smaller.
* Provide keyboard controls for movement and resizing, with visible focus and
  precise adjustment. Pointer movement and resizing follow input directly,
  without springs, momentum, or decorative transitions.
* Work windows remain nonmodal so people can use the surrounding desktop.
  Clicking outside does not dismiss them. Close explicitly, or press Escape
  while the window has focus, and return focus to the opening control.

Reserve modal dialogs for decisions that must be resolved before continuing.
Transient menus and popovers follow their own dismissal behavior. On narrow
layouts, fit the window to the viewport and keep its content reachable.

### AI behavior as design

AI should appear through useful changes in the interface, not through constant AI branding.

Prefer:

> A critical dependency is falling behind. At the current pace, the next phase will finish 3 days late.

> **You should start the next batch today using the confirmed inputs already available.**

`Apply to plan`

Avoid:

> AI Insight

> Our AI has analyzed your project and recommends...

The intelligence should feel embedded in the operating system.

## Colors

Polar uses an almost monochrome system with one scarce, meaningful red accent.

### Canvas

**Canvas** `{colors.canvas}` is the desktop substrate. It should feel warm neutral rather than pure white.

**Canvas Soft** `{colors.canvasSoft}` and **Surface** `{colors.surface}` are used for secondary panels, timeline surfaces, and light cards.

Do not fill the screen with nested shades of gray. Most views should read as three clear layers:

1. Light operating environment.
2. Dark active mission window.
3. Light supporting surfaces.

### Dark surfaces

**Window** `{colors.window}` is the primary mission surface.

Dark surfaces should be near black, not charcoal blue. Use subtle value differences between `{colors.window}`, `{colors.windowRaised}`, and `{colors.windowMuted}` to create hierarchy.

Avoid gradients as a default technique. Depth should come from surface contrast, spacing, borders, and restrained shadow.

### Polar red

**Polar Red** `{colors.polarRed}` is the orientation color.

Use it for:

* The Polar orientation point.
* A current or selected marker.
* Urgent mission attention.
* The most important anomaly.
* Tiny state indicators.
* A single visual focal point in a composition.

Do not use it for:

* Large decorative backgrounds.
* Multiple competing buttons.
* Ordinary metadata.
* Every notification.
* Long passages of text.

Scarcity is part of the brand.

On light backgrounds, use `{colors.polarRedDeep}` when red text needs stronger contrast.

### Status color

Green and amber are functional only. They must be muted and less visually dominant than Polar Red.

Never turn Polar into a traffic light dashboard with red, yellow, and green everywhere.

### Contrast

Normal text must meet WCAG AA contrast of at least 4.5:1. Large text must meet at least 3:1.

Never communicate status by color alone. Pair color with wording, iconography, shape, or position.

## Typography

Polar uses typography to separate human meaning from system state.

### Display and mission titles

Use `{typography.display}` for mission names and major workspace titles.

Mission titles should feel direct and object like:

`Launch Pilot`

not:

`Launch Pilot Project Dashboard`

Use large type sparingly. The page should not resemble a marketing site.

### Body copy

Use `{typography.body}` for explanations, contextual guidance, and readable content.

Body copy should be natural and conversational, but concise. Do not force all interface text into monospace.

### System labels and metadata

Use `{typography.label}` and `{typography.metadata}` for:

* Dates.
* Small labels.
* Breadcrumbs.
* Counters.
* System state.
* Timeline metadata.
* Compact navigation.

Monospace is a system voice, not the only voice.

### Countdown

Countdowns use `{typography.countdown}` or a visually equivalent dot matrix treatment.

The deadline pattern should read:

`DD : HH : MM`

with small labels above:

`DAYS     HOURS     MINUTES`

The countdown is a glanceable orientation device, not decoration.

Use dot matrix numerals only for high value temporal or system information. Never use them for paragraphs, ordinary buttons, or every metric.

### Weight discipline

Most screens should use no more than three obvious weight levels:

* Regular for normal content.
* Medium for titles and controls.
* Semibold for one key recommendation or emphasis.

Avoid heavy bold typography across the whole interface.

## Layout

### Desktop composition

At widths above 1280px, prefer a three zone layout:

* System and missions: 280px to 340px.
* Mission window: flexible, normally 760px to 980px.
* Timeline: 280px to 340px.

The mission window owns the visual center of gravity.

The side panels support it and should never become equally heavy.

### Mission switcher

The mission switcher is vertically aligned on the left.

Only the active mission should use the dark selected treatment. Inactive missions stay light and quiet.

Mission cards should contain only orientation data:

* Mission name.
* One sentence outcome.
* Deadline or horizon.
* Compact progress state if useful.

Do not turn mission cards into miniature dashboards.

### Mission window

The opened mission is a dark floating window with `{rounded.xl}` corners.

Recommended internal padding:

* 32px on compact desktop.
* 40px on normal desktop.
* 48px when the window is wider than 900px.

The mission window chrome already identifies the selected mission. Its content header should normally stack these items in one centered column:

* A centered deadline countdown when time is strategically important.
* One sentence outcome below the countdown.
* A calendar icon, deadline date, and the label `Deadline` below the outcome.

Avoid repeating the mission title or adding a row of volume and checkpoint facts below the outcome. Keep useful progress information in the overview instead.

Below the header, use a small set of primary views:

`Overview   Plan   Context`

Do not add tabs casually. A tab must represent a durable mental model, not a convenient grouping.

### Overview

Overview is not a dashboard of all available metrics.

It answers:

1. What is happening?
2. Is anything off track?
3. What should I do about it?
4. What is the current mission state?

Prefer one strong contextual insight over six summary cards.

### Timeline

The right timeline is the canonical temporal view.

It combines:

* Up next.
* Later.
* Waiting states when relevant.
* Recent activity.

The timeline may contain human actions, AI actions, and external events. Distinguish them subtly through icon or metadata, not through separate visual universes.

Because the timeline already owns upcoming actions, do not duplicate the same action list in the center mission window.

### Density

Polar is minimal, but not empty for the sake of looking premium.

Use whitespace to separate concepts, not to inflate simple information.

A well designed Polar screen should normally expose only one or two strong focal points.

### Grid and alignment

Use an 8px visual rhythm built on the 4px base token.

Prefer strong shared edges. Text, dividers, metrics, and controls should align to a visible underlying grid.

Decorative crosshairs or geometric forms may intentionally break the content grid, but functional UI should not.

### Responsive behavior

Polar is desktop first.

Below 1180px:

* Collapse the right timeline into an on demand panel.
* Preserve the mission window as the primary surface.

Below 900px:

* Collapse mission cards into a compact switcher.
* Keep system navigation accessible without permanently consuming width.

On narrow mobile layouts:

* Use one primary column.
* Mission context comes first.
* Timeline becomes a dedicated view.
* Never shrink the three column desktop composition until it becomes unreadable.

## Elevation & Depth

Depth must feel physical and restrained.

### Mission window

The mission window may use a broad soft shadow because it is conceptually an opened window.

Recommended starting point:

`0 24px 60px rgba(0, 0, 0, 0.18)`

The shadow should never appear as a glow.

### Light panels

Timeline and mission cards should use either:

* A subtle 1px border.
* A very soft shallow shadow.
* Surface contrast.

Usually not all three.

### Texture

Fine grain may appear in:

* Large background fields.
* Abstract brand geometry.
* Hero imagery.
* Empty space surrounding the mission window.

Do not put visible noise behind body text, controls, or dense lists.

Texture is atmospheric, not structural.

### Decorative geometry

Large circles, partial circles, monochrome blocks, and thin crosshair lines may live behind functional surfaces.

Rules:

* They must never reduce readability.
* They must not imply interaction.
* They should be partially cropped.
* They should remain subordinate to the selected mission.
* One red geometric form is usually enough.

Avoid illustration for its own sake.

## Shapes

### General geometry

Polar mixes two shape families:

1. Precise circles, rings, points, and lines for orientation and system state.
2. Soft rectangular windows for work surfaces.

This contrast is intentional.

### Corner radii

Use:

* `{rounded.xs}` for tiny internal details.
* `{rounded.sm}` for chips and compact controls.
* `{rounded.md}` for buttons and inputs.
* `{rounded.lg}` for cards and timeline panels.
* `{rounded.xl}` for primary windows.
* `{rounded.pill}` only for system islands and controls that are semantically pill shaped.

Do not make every container a pill.

### Polar symbol

The Polar symbol is an incomplete circular ring with rounded ends and an orientation point near the upper right diagonal.

Critical rules:

* The ring must be visibly open.
* Both open ends must be circular and soft.
* The opening must sit off the vertical axis, approximately toward 1 to 2 o'clock.
* The red orientation point should relate to that opening and preserve the diagonal direction.
* The point must not sit exactly at 12 o'clock.
* The mark must not read as the universal power symbol.
* The mark should remain legible at 16px.
* Prefer flat geometry in product UI. Richer material treatment may be used only for app store or launch artwork.

The symbol may replace the `O` in the POLAR wordmark.

### Iconography

Icons are simple, geometric, and low detail.

Default:

* 16px to 20px optical size.
* 1.5px to 1.75px stroke.
* Rounded line caps when appropriate.
* Monochrome unless status requires an accent.

Do not mix filled cartoon icons with thin system icons.

## Components

### System island

The system island sits near the top center and acts like OS chrome.

It may contain:

* Current time.
* Polar state.
* Notifications.
* People or collaboration state.
* Compact global actions.

It should feel persistent and lightweight.

Use a near black compact bar with near square corners, high contrast white icons, and very limited red. Keep its size, contents, and top center placement lightweight and consistent with the surrounding cards.

Do not turn the island into a full navigation bar.

### Mission card

Active mission:

* Dark surface.
* White title.
* Red orientation marker.
* Compact progress ring or state.
* Minimal metadata.

Inactive mission:

* Light surface.
* Black title.
* Muted metadata.
* Thin neutral progress ring.

Hover should slightly strengthen border or surface contrast, not create large movement.

### Mission header

Mission header structure:

1. Small breadcrumb or state.
2. Mission title.
3. One sentence outcome.
4. High value system facts.
5. Optional deadline countdown.

Avoid rows of generic KPIs.

If the countdown already communicates time remaining, do not redundantly emphasize "16 days remaining" in multiple nearby places unless the smaller value serves a distinct scanning use case.

### Tabs

Primary mission tabs should normally be:

`Overview`

`Plan`

`Context`

The selected tab may invert to a light surface inside the dark mission window.

Tab labels are nouns or clear modes. Avoid jargon.

### Contextual insight

A contextual insight is Polar's primary intelligent intervention pattern.

It should normally be one compact red tinted box with no generic title.

Example:

> A critical dependency is falling behind. At the current pace, the next phase will finish 3 days late.
>
> **You should start the next batch today using the confirmed inputs already available.**
>
> `Apply to plan`

Rules:

* Lead with the concrete recommendation in larger, bold text.
* Follow with the observed situation and consequence as supporting context.
* Make the action concrete.
* Offer one obvious action when Polar can modify the plan.
* Do not add "AI Insight," "Suggestion," or "Needs attention" unless a label is genuinely necessary.
* Do not expose model terminology.
* Do not show several competing AI cards at once.

The component should feel like the system noticed something, not like a chatbot interrupted the user.

### Plan

Plan represents the evolving route from current state to mission outcome.

Prefer:

* Stages.
* Dependencies.
* Decisions.
* Checkpoints.
* Expected outcomes.
* Owners when relevant.
* Dates when they constrain execution.

Avoid presenting Plan as a giant undifferentiated backlog.

### Context

Context explains what Polar knows and what it is using.

Possible content:

* Mission brief.
* Decisions.
* Constraints.
* Relevant files.
* People.
* Customer or stakeholder information.
* Recent conversations.
* Assumptions.
* Open questions.

Context should increase trust in the system's reasoning without exposing chain of thought.

Prefer provenance and concise facts over long AI generated summaries.

### Timeline item

A timeline item contains:

* State marker.
* Concise action or event.
* Time.
* Optional owner.
* Optional priority only when priority changes behavior.

Use connected vertical rules to express continuity.

The current or urgent item may use Polar Red.

Completed history should visually recede.

### Buttons

Primary action on light surface:

* Near black fill or, when inside a dark window, light fill.
* High contrast label.
* `{rounded.md}`.
* 40px to 44px height.

Secondary action:

* Transparent or raised dark surface.
* Thin border.
* No unnecessary shadow.

Red is not the default primary button color. Red is more powerful when reserved for orientation and attention.

### Inputs

Inputs should be quiet and integrated.

Default:

* 40px to 44px height.
* Thin border.
* `{rounded.md}`.
* Clear focus ring.
* Placeholder with sufficient contrast.

Do not use oversized search fields as decoration.

### Progress

Progress should be contextual rather than omnipresent.

Use compact rings for mission switchers when a useful completion model exists.

Do not invent a percentage when progress is not meaningfully quantifiable.

Prefer concrete state such as:

`18 / 24 complete`

over:

`75% complete`

when the concrete count is more informative.

### Empty states

Empty states should explain the next meaningful action.

Avoid generic illustrations.

Good:

> No context has been added yet.
> Add the event brief so Polar can build the first plan.

Bad:

> Nothing here yet! 🚀

### Loading

Use local skeletons or subtle activity indicators.

Never block the whole mission window for a small background operation.

For AI work, communicate the operation in product language:

`Updating plan`

not:

`Thinking...`

## Do's and Don'ts

### Do

* Do preserve the hierarchy: mission, next, plan, context, timeline.
* Do make the active mission feel like an opened window.
* Do use Polar Red sparingly.
* Do let one intelligent insight dominate when something needs attention.
* Do use explicit, natural language for consequences and recommendations.
* Do use visual references and existing Polar screens before inventing a new pattern.
* Do reuse existing components before adding variants.
* Do preserve large areas of calm negative space.
* Do align interface elements to a clear grid.
* Do make system state glanceable.
* Do make AI actions reversible when they modify a plan.
* Do design keyboard focus states for every interactive control.
* Do preserve at least 44px touch targets for controls used on mobile.
* Do respect `prefers-reduced-motion`.
* Do keep text contrast at WCAG AA or better.

### Don't

* Don't design Polar as another kanban board.
* Don't use Jira vocabulary as the visual center of the product.
* Don't duplicate the timeline action list inside the mission overview.
* Don't create dashboards made of many equal cards.
* Don't add a card simply because content needs a container.
* Don't add gradients, neon glows, glassmorphism, or colorful ambient lighting.
* Don't use red as a generic CTA color.
* Don't add decorative charts when a sentence is clearer.
* Don't turn every metric into a progress bar.
* Don't use more than one visually dominant alert at a time.
* Don't use monospace for long reading content.
* Don't use dot matrix typography everywhere.
* Don't over round controls.
* Don't add icons to every label.
* Don't use emoji inside core product UI.
* Don't announce AI unnecessarily.
* Don't show model names in ordinary workflow UI.
* Don't expose hidden reasoning or chain of thought.
* Don't copy Nothing OS assets, proprietary typefaces, glyphs, or exact compositions.
* Don't change the established visual language to make one screen look more exciting.

## Motion & Interaction

Motion reinforces the OS metaphor.

### Durations

* Hover and micro state: 100ms to 140ms.
* Button and tab state: 140ms to 180ms.
* Panel reveal: 180ms to 240ms.
* Mission window transition: 220ms to 300ms.

Prefer easing close to:

`cubic-bezier(0.2, 0.8, 0.2, 1)`

### Principles

* Movement should explain state change.
* Mission switching may use a subtle window content transition, not a page slide.
* Timeline updates may fade and reposition locally.
* The Polar orientation point may pulse once for meaningful new attention.
* Avoid looping decorative animations.
* Avoid springy motion for serious workflow actions.
* Disable nonessential motion when reduced motion is requested.

## Accessibility

Accessibility is part of the visual system, not a finishing pass.

* Maintain WCAG AA contrast.
* Preserve visible keyboard focus.
* Do not use color alone for state.
* Use semantic controls.
* Ensure timeline state is understandable to screen readers.
* Provide accessible labels for icon only buttons.
* Keep body text at 14px minimum on desktop and 16px when reading density permits on small screens.
* Do not encode urgency only through animation.
* Countdown information must have an accessible text equivalent.
* Noise and grain must never reduce text readability.
* Avoid ultra low contrast metadata that disappears on common laptop displays.

## Agent Application Rules

This document is the visual source of truth for Polar.

Before changing UI:

1. Read this file.
2. Inspect the existing screen and relevant components.
3. Reuse existing Polar patterns before creating new ones.
4. Identify the primary user question the screen must answer.
5. Remove duplicated information before adding new information.

When implementing:

* Use the token values in this file instead of inventing near duplicate colors, spacing, radii, or typography.
* Prefer existing primitives and semantic variants.
* Preserve the OS spatial metaphor.
* Treat visual references as evidence of the intended language, not as permission to copy unrelated details.
* When a requirement is ambiguous, choose the quieter, simpler composition.
* If a new pattern is necessary, make it feel inevitable within this system rather than visually novel.
* Keep AI interventions contextual and actionable.
* Avoid generic AI generated dashboard patterns.

When reviewing a UI change, ask:

1. Does the user know which mission is active?
2. Can the user tell what matters now?
3. Is upcoming work visible in only one canonical place?
4. Does Polar explain risk or drift in natural language?
5. Is the next action obvious without scanning a dashboard?
6. Does the screen still feel like an operating environment rather than a project database?
7. Is red still scarce?
8. Did the change introduce a new visual primitive that could have reused an existing one?
9. Does the interface remain understandable without color?
10. Would this screen still feel recognizably Polar with all decorative geometry removed?

## Design Maintenance

Update this file when a design decision becomes durable and reusable.

Good reasons to update DESIGN.md:

* A new component pattern is used in more than one place.
* A new semantic color or state is introduced.
* Typography or spacing rules change.
* Product hierarchy changes.
* Repeated design review feedback reveals a missing rule.
* A new visual reference changes the system rather than one screen.
* Accessibility requirements change.
* A component repeatedly requires the same exception.

Do not update this file for:

* One off content.
* Temporary experiments.
* Feature specific copy.
* A single screen workaround.
* Implementation details that belong in architecture documentation.

When the implementation intentionally diverges from this document, update the document in the same change or explicitly record the exception. Do not allow silent design drift.

## Relationship to Agent Instructions

Keep `AGENTS.md` or equivalent project instructions concise. It should point agents to this file when they work on UI rather than duplicating the full design system.

Recommended project instruction:

> For any user interface or visual change, read `DESIGN.md` before editing. Reuse existing Polar components and tokens. If the task introduces a durable new design rule, update `DESIGN.md` in the same change.

This keeps persistent agent context small while retaining a detailed, versioned design source of truth.

## References

This document follows the current Google Labs `DESIGN.md` alpha format: machine readable tokens in YAML front matter plus human readable design rationale.

Its agent usage model also reflects current guidance from OpenAI, Anthropic, and GitHub: keep always loaded instructions concise, give agents persistent project context, use concrete references, prefer clear and specific rules over vague adjectives, and move deeper reference material into dedicated source of truth documents.

Primary references:

* Google Labs Code, `design.md`: https://github.com/google-labs-code/design.md
* Google Labs Code, DESIGN.md philosophy: https://github.com/google-labs-code/design.md/blob/main/PHILOSOPHY.md
* OpenAI, Harness engineering: https://openai.com/index/harness-engineering/
* OpenAI Academy, Design context and iteration with Codex: https://academy.openai.com/en/public/clubs/champions-ecqup/videos/design-context-and-iteration-with-codex-2026-07-09
* OpenAI, How OpenAI uses Codex: https://openai.com/business/guides-and-resources/how-openai-uses-codex/
* Anthropic, Claude Code best practices: https://www.anthropic.com/engineering/claude-code-best-practices
* Anthropic Claude Code documentation: https://code.claude.com/docs/
* GitHub Copilot, custom instructions guidance: https://docs.github.com/en/copilot/how-tos/copilot-in-your-ide/customize-copilot/configure-custom-instructions/add-repository-instructions-in-your-ide
