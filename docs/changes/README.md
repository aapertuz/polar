# Optional change specs

Use a spec only when a large or ambiguous change needs explicit intent before
execution. Routine changes do not need one. Name it `YYYY-MM-DD-short-name.md`.
Keep this focused on outcomes; implementation steps belong in an execution plan.

```markdown
# Change title
Status: Draft

## Problem and intended outcome
Who is affected, current behavior, and desired behavior.

## Scope and non-goals
Boundaries, constraints, and compatibility requirements.

## Acceptance criteria
Observable examples, including important failure cases.

## Open questions and decisions
Resolve blocking questions before dependent implementation.

## Execution plan
Link to the active plan; update the link after it moves to completed.
```

Set status to Ready when blocking questions are resolved, and Complete when the
acceptance criteria are verified. Retain completed specs as history and move
lasting knowledge into the appropriate documentation.
