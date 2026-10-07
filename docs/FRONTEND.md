# Frontend conventions

These conventions apply to application source under `native/src/`. The default homescreen preserves the desktop composition with an empty mission switcher, centered canvas message and empty timeline and Quick AI open initially. Fixture-based content has no runtime demo entry point. Keep sample data out of the mounted default state.

## Imports

Use `@/` for every application local TypeScript, TSX, re-export, and stylesheet import. The alias points to `native/src/`. Keep external package names unchanged. Group imports in this order: external packages, application aliases, then type-only aliases where they are distinct. The compiler and Vite both resolve the alias. Tests that execute directly in Node can use relative paths when they do not import through Vite.

## Behavior and ownership

Keep related state, effects, event handlers, and nontrivial derived values together in a focused hook. A behavioral screen or component can compose those hooks through one master hook that returns the model needed to render. Keep pure calculations in ordinary utilities. Do not add empty hooks or split hooks merely to satisfy a naming rule. Keep effect callbacks stable when their identity controls subscriptions or focus restoration.

Give shared defaults, identifiers, responsive thresholds, motion values, and sample data a clear owner. Use fixture values for preview content and preserve their fixed dates and mission associations. Derive counts from fixtures when the count describes the fixtures. Do not create constants for ordinary booleans, null values, indices, or static labels without a real owner.

## Rendering and components

JSX should describe the interface. Pass named event handlers and ref callbacks by reference; put event work, filtering, lookup, sorting, slicing, calculations, and request construction in hooks or named functions. Simple conditional rendering and maps that instantiate named components are fine. Extract components around cohesive responsibilities, including meaningful window actions and overlay bodies. Avoid line-count driven splits and generic component frameworks.

Use exhaustive typed registries of component references when selecting among overlay or tab bodies. Store relevant metadata beside the component reference. Keep registries near the screen or feature that owns the selection. Do not invoke component functions directly or use a rendering switch/conditional tower when a registry communicates the choices more clearly.

## Keep it practical

Prefer the smallest useful abstraction. Reuse matching markup and behavior; leave near-duplicates separate when their semantics differ. Avoid mechanical memoization, reducer/context layers, and general frameworks without a demonstrated need. Preserve existing CSS classes, semantic markup, keyboard behavior, focus return, portal lifecycle, window interactions, and reduced-motion behavior during refactors.

## Automated checks

`pnpm check:frontend` uses the TypeScript AST to enforce local source aliases, named JSX event and ref handlers, no direct lifecycle/state hooks in component files, one master hook per behavioral component, and registry selection instead of JSX-returning switches or IIFEs. It follows imported hook aliases. `pnpm test:frontend-check` tests prohibited and allowed examples. The native boundary tests also resolve `@/` and relative imports, including side-effect imports and re-exports. The checks can catch syntax patterns; review responsibility boundaries and abstraction quality with the design and code review.
