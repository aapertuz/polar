# Execution plans

Small clear change: inspect, implement, verify. No saved artifact required.
Medium change: a short plan in the conversation or native Plan Mode is enough.
Complex, risky, or multi-session change: create
`docs/exec-plans/active/YYYY-MM-DD-short-name.md` using the template below.
Large ambiguous change: first use the [optional change spec](changes/README.md).

Keep the plan self-contained enough for another session to resume. Record exact
paths, acceptance criteria, decisions, and useful verification evidence. Update it
as work progresses, not just at the end. On completion, move it to `completed/`,
repair incoming relative links, and put unresolved debt in the
[debt tracker](exec-plans/tech-debt-tracker.md). Keep associated specs in `changes/`
with status Complete and a link to the completed plan. No mandatory approval gate
is introduced by this workflow; follow the user's authorization and scope.

## Template

```markdown
# Change title

Status: Active
Owner: person or current agent
Created: YYYY-MM-DD

## Goal and acceptance criteria
Describe observable success and what is outside scope.

## Context
Relevant files, constraints, current behavior, and optional spec path.

## Steps and progress
- [ ] Inspect and establish the baseline.
- [ ] Implement the smallest coherent change.
- [ ] Verify acceptance criteria and update documentation.

## Decisions and discoveries
Date, decision, reason; include deviations from the original approach.

## Verification
Commands/scenarios, actual outcomes, and any checks still outstanding.

## Handoff or outcome
Next action while active; final behavior and remaining gaps when complete.
```
