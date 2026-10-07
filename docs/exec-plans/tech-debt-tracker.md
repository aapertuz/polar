# Known gaps and technical debt

Record concrete gaps with impact and a next action; remove or link resolved items.

| Gap | Impact | Next action |
| --- | --- | --- |
| No automated UI gesture/focus coverage | Pure helper checks cannot establish native pointer tracking or focus behavior | Use the documented desktop smoke review; add an integration harness when real desktop flows grow |
| No desktop smoke-test automation | Native interactions require manual verification | Follow the homescreen smoke review in [Verification](../VERIFICATION.md); automate native scenarios when tooling is selected |
| Architecture contains an obsolete `features/home/` migration note | The completed UI migration is not reflected in the owner-maintained reference | Owner: remove the final historical note in “React folder organization”; current implementation uses `pages/home/` and domain feature folders |

The homescreen UI is verified manually and through focused geometry, motion-policy, and import-boundary checks. These follow-ups do not block its presentation-only scope.
