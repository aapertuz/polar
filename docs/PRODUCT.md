# Polar

> Polar is a desktop work OS that keeps a team oriented by turning missions into adaptive execution plans and continuously surfacing what needs attention next.

## Product Overview

Teams do not primarily lack task trackers. They lack orientation.

Work is spread across conversations, code, documents, email, calendars, and other tools. Plans become stale as reality changes. People spend time maintaining boards, updating statuses, and reconstructing context instead of moving outcomes forward.

Polar exists to continuously answer:

> **Given what we are trying to achieve and what is true right now, what should happen next?**

Polar should understand the goal, maintain the execution model, react to new evidence, and bring the right action or decision to the user when attention is needed.

## Core Job

> **Know what to do next.**

When a team is trying to move an important goal forward, Polar should keep it oriented by understanding current reality, maintaining the plan, and surfacing the most important next action.

## Target Users

Polar is initially for founders and small, high agency teams whose work crosses product, engineering, sales, operations, and other functions.

The initial users:

* Own outcomes rather than isolated tickets.
* Work across several tools and information sources.
* Operate where priorities and constraints change frequently.
* Do not want maintaining a project board to become a separate job.
* Need to know what deserves attention without repeatedly checking another app.

Polar is not initially designed for organizations whose primary need is detailed resource planning, compliance workflows, time tracking, or rigid process enforcement.

## Core Product Model

### Mission

A persistent outcome the team is trying to achieve.

A mission captures the desired outcome, why it matters, success criteria, constraints, ownership, relevant context, and timing when applicable.

### Execution Plan

Polar's current interpretation of how to achieve a mission.

It may include checkpoints, actions, priorities, dependencies, risks, assumptions, and next actions. It is expected to change as reality changes.

### Checkpoint

A meaningful change in the state of a mission.

Checkpoints represent progress toward the outcome. They are not containers for arbitrary groups of actions.

### Action

A concrete action that can move a mission forward.

Actions are execution objects, not the foundation of the product. They may be created, reordered, combined, replaced, or removed as the plan changes.

> **The mission is persistent. The plan is adaptive. Actions are disposable.**

### Event

Something that happened and may change the state of a mission.

An event may come from a person, Polar, or eventually an external source.

### Evidence

A fact or artifact that demonstrates a change in reality.

Evidence is stronger than a manually selected status. It can prove that an action happened, a condition became true, or a checkpoint was reached.

### Decision

A meaningful choice that affects how a mission should proceed.

Important decisions preserve what was decided, why, and the context that made the decision reasonable at the time.

### Next Action

The action, decision, or intervention that currently deserves attention most.

## Core Product Loop

**Mission → Context → Plan → Action → Event or Evidence → Reassessment → Replan → Next Action**

This loop is the product.

As reality changes, Polar may:

* Complete or invalidate existing work.
* Add or remove actions.
* Change priorities.
* Identify a blocker or risk.
* Update a checkpoint.
* Create a reminder.
* Surface a decision that requires human judgment.
* Decide that no intervention is necessary.

## Product Principles

### Outcomes over work units

Polar is organized around what the team is trying to achieve, not around epics, stories, tickets, or queues. Actions exist only to support an outcome.

### Reality over the plan

The plan must adapt to reality. Polar should never preserve work simply because it was previously planned.

### Meaning over status updates

People should provide information that changes understanding, not administrative updates software can infer.

A user should be able to say:

> The attendee list arrived.

Polar should determine what that changes instead of asking the user to update several statuses manually.

### Evidence over "Done"

A sent proposal, merged change, uploaded file, confirmed meeting, received reply, or achieved result is stronger than a manually selected status.

### Orientation over management

Polar should help people understand where they are, what changed, what matters, and what should happen next. It should not turn users into maintainers of the tool.

### Proactive, but calm

Polar should come to the user when attention matters instead of requiring repeated board checks.

Activity is not automatically important. Polar should interrupt only when there is a useful reason, such as a changed priority, blocker, risk, required decision, missed expectation, or meaningful new result.

### Explain important changes

When Polar changes a plan or surfaces a recommendation, the user should be able to understand why. Recommendations should connect to evidence, constraints, decisions, and timing.

### Preserve human agency

Polar can manage reversible execution details aggressively, but consequential decisions remain visible to humans.

### Work stays where work happens

Polar is a coordination and orientation layer, not a replacement for every specialized tool.

Code can remain in GitHub. Communication can remain in email. Documents can remain in their document systems. Polar should understand enough of that reality to keep missions current.

## Primary Experience

### Main App

The desktop app is where users create missions, inspect execution plans, understand context, review decisions, see evidence, and explore why Polar is recommending something.

The main app is for depth.

### Ambient Surface

The macOS notch companion is how Polar lives with the user during the day.

It surfaces small, timely pieces of information when attention is useful:

* What changed.
* What now needs attention.
* A decision that is waiting.
* A risk that became important.
* A reminder tied to an active mission.

The notch is not a miniature project dashboard. It is an attention interface.

## Initial Validation Scope

The first version exists to test one thesis:

> **Can a team coordinate around outcomes without manually maintaining actions and status as the primary representation of work?**

The initial product should support this loop end to end.

### 1. Define a Mission

A user describes an outcome and provides enough context for Polar to understand what success means.

### 2. Generate an Execution Plan

Polar creates a useful initial plan containing only what helps execution:

* Current assessment.
* Checkpoints.
* Actions.
* Priorities.
* Dependencies when relevant.
* Risks and assumptions.
* Recommended next actions.

### 3. Observe a Change in Reality

For the first version, users may provide events or evidence manually.

### 4. Reassess and Replan

Polar determines what the new information means and may complete, create, remove, or reprioritize work while updating risks, checkpoints, and next actions.

### 5. Surface What Matters

Polar proactively tells the user when the new state requires attention.

The main app provides context. The notch provides the timely intervention.

## Initial Non Goals

The first version does not need:

* Kanban boards.
* Sprints.
* Epics or user stories.
* Story points.
* Backlog grooming.
* Time tracking.
* Gantt charts.
* Complex custom workflows.
* Enterprise resource planning.
* A built in CRM.
* A general purpose document editor.
* A replacement for team chat.
* Multiple autonomous agents.
* Autonomous external communication.
* Broad external integrations.
* Fully automatic observation of all work.

One external integration may later be added to validate automatic observation, but integrations are not required to prove the initial product loop.

## AI Behavior Boundaries

Within an active mission, Polar may reason freely about reversible planning details. It may propose or eventually perform actions such as:

* Create an action.
* Remove an obsolete action.
* Reorder priorities.
* Update a risk.
* Associate evidence with an action or checkpoint.
* Recommend a reminder.
* Recalculate what deserves attention next.

Polar should require explicit human involvement before actions that materially alter intent or create meaningful external consequences, including:

* Changing the mission outcome.
* Materially changing success criteria.
* Sending external communication as the user.
* Making commitments to another person or organization.
* Spending money.
* Performing irreversible actions.

Every meaningful AI initiated change should be explainable and reversible when possible.

## Experience Principles

### The home screen answers "What needs my attention?"

The default experience should not be a board or a list of everything the team could do.

### Show the reason, not just the recommendation

A next action without context feels arbitrary. Polar should expose the causal connection.

### Prefer state changes over activity streams

Users should not need to read every event. Polar should summarize activity into meaningful changes in mission state.

### Keep complexity behind the interface

The system may reason about many actions, events, risks, dependencies, and sources. The user should see only the structure needed to make a decision or take action.

### Make correction easy

Users should be able to correct Polar, reject a recommendation, reverse a plan change, or provide missing context.

## Success Criteria

The initial product is successful if real use shows that:

* A user can describe a real outcome and receive a plan useful enough to act on.
* When reality changes, Polar updates the plan materially correctly without requiring manual board maintenance.
* Polar identifies useful next actions rather than merely displaying actions.
* Users understand why important priorities or recommendations changed.
* The ambient experience surfaces important changes without becoming a noisy notification channel.
* Real missions can be run with less manual status maintenance than in a traditional project management system.

Useful signals include:

* Recommended next actions accepted, edited, ignored, or reversed.
* AI generated plan changes that users revert.
* Manual corrections after replanning.
* Amount of manual maintenance of actions and statuses still required.
* Important mission changes discovered through Polar without opening a project board.

## Product Boundary

Polar is not trying to become a more configurable Jira.

Polar is not primarily a work item database, ticket tracker, sprint planner, reporting system, or generic AI assistant.

The product should resist features whose main purpose is to recreate manual work management rituals that Polar can infer, automate, or eliminate.

## Domain Language

| Term | Meaning |
| --- | --- |
| Mission | Persistent desired outcome |
| Execution Plan | Current adaptive approach for achieving a mission |
| Checkpoint | Meaningful state change toward the mission outcome |
| Action | Temporary executable action |
| Event | Something that happened and may affect mission state |
| Evidence | Fact or artifact that supports a change in understood reality |
| Decision | Meaningful choice and its reasoning |
| Risk | Condition that could materially harm mission progress |
| Assumption | Belief the current plan depends on |
| Next Action | What deserves attention most right now |

## Documentation Boundaries

This file describes stable product truth: what Polar is, who it is for, the problem it solves, its core model, principles, and major product boundaries.

Keep other concerns elsewhere:

* `AGENTS.md` explains how an agent should navigate and work in the repository.
* `architecture.md` describes system design, components, data flow, infrastructure, and technical boundaries.
* `design.md` describes interaction and visual design principles.
* `design-system.md`, if present, defines concrete visual tokens, components, states, and reusable UI rules.
* Feature specifications define the behavior and requirements of a particular feature.
* Execution plans describe temporary implementation work and should evolve or be archived as work progresses.

Do not turn `product.md` into a roadmap, backlog, architecture document, or collection of feature specific implementation details.

## When to Update This File

Update `product.md` when one of these changes materially:

* The problem Polar exists to solve.
* The primary user or core job.
* The product model or meaning of its core concepts.
* The product principles.
* Major scope boundaries.
* What the initial product is trying to validate.

Do not update it for ordinary feature work, implementation progress, temporary priorities, or design details that belong in more specific documentation.
