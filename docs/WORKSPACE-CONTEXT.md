# Workspace context

Workspace context is reusable background owned by one Polar workspace. It is
separate from a mission's goal, conversation, and attachments. Quick AI combines
the workspace brief and selected workspace excerpts with mission-only sources.
Adding a Quick AI attachment never publishes it to the workspace library.

## Manage the library

Open **Workspace context** from the launcher, including before creating a
mission, or from Quick AI's inherited-context line. The workspace owner can save
an 8,000-character plain-text brief, add notes up to 100,000 characters, and add
up to 50 active documents and notes. Document imports use the existing local
PDF, DOCX, Markdown, and text extraction limits. Original files remain on the
device; extracted text is synchronized to the authenticated workspace in Neon.
Workspace members can inspect synchronized text. The owner replaces or archives
sources; archive removes a source from future context while retaining historical
mission provenance.

Each brief save increments a workspace revision. Each source has an independent
revision and content hash. Mutations use expected revisions; stale edits return
a refresh conflict. Exact retries with the same expected revision and full
payload return the committed result; different content conflicts. Content is
never sent to AI through a workspace mutation.

## Mission reasoning and provenance

Every new mission message builds a fresh authorized snapshot. The server includes
the workspace brief, deterministic relevance-ranked workspace excerpts, the
mission goal and conversation, and bounded mission attachment excerpts. The
current allocation is 8,000 characters for the brief, 64,000 for workspace
excerpts, 128,000 for mission excerpts, and 60,000 for conversation. Excerpts
are capped at 4,000 characters. Unused scope allocation may be borrowed by the
other source scope. Selection ties resolve by scope, source ID, and excerpt
position.

The stored manifest records the workspace audience and revision, requesting
user, brief hash, source scope/ID/revision/hash, supplied excerpt IDs, and omitted
excerpt counts. Polar distinguishes supplied excerpts from citations returned by
the model. Citations must match the exact supplied scope, source revision, and
excerpt. Mission Context labels Workspace sources and Mission attachments
separately and records whether a workspace source has changed or been removed
since activation.

Any workspace brief or source mutation increments the shared workspace revision,
cancels pending reasoning, and supersedes pending proposals. Late results and
activation are checked against the current workspace revision while holding the
workspace context lock. Quick AI offers an explicit **Refresh plan** action to
create a new snapshot. Activated mission content and its historical provenance
remain unchanged.

## API and development

The authenticated API lives at `/api/app/workspace-context` with brief save and
source add/replace/archive routes beneath it. The verified selected workspace
header determines ownership. Active members can read; only owners can mutate.
The shared source tables are separate from `mission_source`.

Apply and test schema changes against development only:

```sh
pnpm --filter @polar/server db:generate
pnpm --filter @polar/server db:migrate
pnpm --filter @polar/server test:integration
```

The authenticated development integration suite uses disposable accounts and
cleans them up. Model-quality checks with a real ChatGPT account and interactive
desktop upload/restart/keyboard/window-size scenarios still require separate
verification; deterministic fixtures do not establish live model behavior.
