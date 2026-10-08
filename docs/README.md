# Polar documentation

Start with [AGENTS.md](../AGENTS.md), then read only what the task needs.

## Owner-provided knowledge

Reserved paths: `product.md`, `architecture.md`, and `design.md` in this directory.
These files are intentionally absent until the owner adds them. If the owner
chooses other paths, update the map to point there instead of duplicating them.

## Workflow

- [Frontend conventions](FRONTEND.md)
- [Polar account authentication](AUTHENTICATION.md)
- [Local provider connections](PROVIDER-CONNECTIONS.md)
- [Planning policy and execution-plan template](PLANS.md)
- [Active plans](exec-plans/active/)
- [Completed plans](exec-plans/completed/)
- [Known gaps and technical debt](exec-plans/tech-debt-tracker.md)
- [Optional change specs and template](changes/README.md)
- [Verification and optional Git hook](VERIFICATION.md)
- [Repository skills](../.agents/skills/README.md)

Keep durable decisions near the relevant project documentation. Completed plans
record history; they do not override current documentation. Update affected docs
with code changes and remove stale instructions when encountered.

This setup adapts the small entry point, repository knowledge, execution plans,
and mechanical feedback described in
[OpenAI's Harness Engineering article](https://openai.com/index/harness-engineering/).
It deliberately grows with this application's actual needs.
