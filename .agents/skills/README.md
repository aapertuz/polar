# Repository skills

Add a skill only when a specialized procedure repeats and benefits from explicit
local instructions. General workflow belongs in [AGENTS.md](../../AGENTS.md);
commands and checks belong in [verification](../../docs/VERIFICATION.md).

Use `.agents/skills/<procedure-name>/SKILL.md`, with YAML frontmatter containing
`name` and `description`. The description should explain when to use the skill.
Document prerequisites, concrete steps, expected evidence, and recovery from known
failures. Keep supporting scripts beside the skill and link them explicitly.

Available local skills:

* [Contextual commits](contextual-commits/SKILL.md): group requested changes by
  intent and create Conventional Commits.

Add further skills after learning from repeated specialized work. Validate their
instructions against the current repository before relying on them.
