# Evidence-based adaptive missions
Status: Active

## Problem and intended outcome

Mission actions currently have a direct completion toggle and no durable action
conversation. This can make the plan appear complete without evidence that the
mission outcome or action criteria were met. Polar should collect evidence and
conversation in the action, evaluate it, explain progress, and adapt the plan as
new information arrives.

## Scope and non-goals

This change covers evidence submission and evaluation, action conversations,
outcome-based assessment, adaptive planning, review of consequential changes,
background reasoning while Polar is running and authenticated, and timed
follow-ups. Written results use the action conversation; reference links and
PDF, DOCX, Markdown, and text documents use dedicated evidence submission
paths. There is no separate evidence text field. Originals stay local and links
are not fetched.
External integrations and external tool execution are excluded. Provider
inference stays local to the desktop and the server remains authoritative for
authorization and persisted state.

Participation and evidence submission require both current workspace membership
and membership in the specific action. This applies even to workspace owners and
mission owners. UI visibility is not an authorization boundary; the server must
recheck both conditions at submission time.

## Acceptance criteria

- Actions have durable completion criteria, conversation, evidence, evaluations,
  and explained progress state.
- Written results are shared in the conversation; evidence submission offers
  links and supported document attachments without a separate text field.
- Direct status updates cannot complete an action. Evidence is evaluated first;
  a clear human conclusion can count, but tentative discussion and Polar output
  cannot establish completion alone.
- Action participation and evidence submission require current workspace access
  and membership in that action, with regression coverage for owners who are not
  action members and members whose access is revoked.
- Reassessment evaluates mission outcomes and checkpoint conditions, selects a
  dependency-ready next action, and makes minimal explained plan changes.
- Routine changes apply automatically; structural, criteria, mission-deadline,
  and material intent changes wait for owner review.
- Stable action identities, assignments, completed work, evidence, conversation,
  and history survive replanning, archival, and restart.
- Background reasoning and timed follow-ups use persisted, recoverable server
  work while the desktop is running and authenticated; provider failures never
  establish completion.
- Mission surfaces show persisted assessments, activity, attention, and reasons.
- AI planning assigns every action a concise work-function category (for example
  Dev, Ops, or HR), visible in Timeline and Action Detail. Scheduling preserves
  categories; activation and reviewed regeneration persist them. Older actions
  have no visible category until reviewed regeneration classifies them. Categories
  are plain text up to 40 characters, without a fixed exhaustive taxonomy.
  Display category labels in uppercase pills in Timeline cards and Action Detail.
  Omit Uncategorized, missing, and blank categories; omit the entire Category
  row in Action Detail when there is no visible category.

## Open questions and decisions

Resolved by the active execution plan: clear human conclusions can count as
evidence; AI evaluates submissions; routine changes apply automatically;
consequential changes require review; follow-ups run on new input and schedule;
the defaults are a 24-hour unanswered-question follow-up, one day before an
incomplete deadline, and overdue, with at most one timed follow-up per action per
day. Legacy completions remain historical without fabricated evidence.

## Execution plan

[Active implementation plan](../exec-plans/active/2026-10-10-evidence-adaptive-missions.md).
