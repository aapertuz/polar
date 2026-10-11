use super::types::{ProviderError, Result};
use chrono::{DateTime, Local, NaiveDate};
use serde::Deserialize;
use serde_json::{json, Value};
use std::collections::{HashMap, HashSet};

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Schedule {
    checkpoints: Vec<ScheduledCheckpoint>,
    next_action_title: String,
    recommendation: String,
    assessment: String,
    scheduling_assumption: Option<String>,
    conflict: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct ScheduledCheckpoint {
    checkpoint_index: usize,
    due_on: String,
    actions: Vec<ScheduledAction>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct ScheduledAction {
    action_index: usize,
    due_on: String,
    priority: String,
    fixed_deadline: bool,
}

pub fn clock() -> Value {
    let now = Local::now();
    json!({ "now": now.to_rfc3339(), "timeZone": now.format("%:z").to_string(), "localDate": now.format("%Y-%m-%d").to_string() })
}

pub fn needs_schedule(output: &Value) -> Result<bool> {
    let questions = output["questions"]
        .as_array()
        .ok_or_else(invalid_schedule)?;
    if !questions.is_empty() || output["proposal"].is_null() {
        return Ok(false);
    }
    if !output["proposal"].is_object() {
        return Err(invalid_schedule());
    }
    Ok(true)
}

pub fn request(model: &str, plan: &Value, clock: &Value) -> Value {
    json!({
        "model": model,
        "instructions": include_str!("mission-scheduling-guidelines.txt"),
        "input": [{ "role": "user", "content": json!({ "plan": plan, "planningClock": clock }).to_string() }],
        "text": { "format": { "type": "json_schema", "name": "polar_mission_schedule", "strict": true, "schema": schema() } },
        "store": false,
        "stream": true,
    })
}

fn schema() -> Value {
    let date = json!({ "type": "string", "pattern": "^[0-9]{4}-[0-9]{2}-[0-9]{2}$" });
    let nullable_text = json!({ "anyOf": [{ "type": "string" }, { "type": "null" }] });
    json!({
        "type": "object", "additionalProperties": false,
        "properties": {
            "checkpoints": { "type": "array", "items": {
                "type": "object", "additionalProperties": false,
                "properties": {
                    "checkpointIndex": { "type": "integer", "minimum": 0 }, "dueOn": date,
                    "actions": { "type": "array", "items": {
                        "type": "object", "additionalProperties": false,
                        "properties": { "actionIndex": { "type": "integer", "minimum": 0 }, "dueOn": date, "priority": { "type": "string", "enum": ["High", "Medium", "Low"] }, "fixedDeadline": { "type": "boolean" } },
                        "required": ["actionIndex", "dueOn", "priority", "fixedDeadline"]
                    } }
                },
                "required": ["checkpointIndex", "dueOn", "actions"]
            } },
            "nextActionTitle": { "type": "string" }, "recommendation": { "type": "string" }, "assessment": { "type": "string" },
            "schedulingAssumption": nullable_text, "conflict": nullable_text
        },
        "required": ["checkpoints", "nextActionTitle", "recommendation", "assessment", "schedulingAssumption", "conflict"]
    })
}

fn invalid_schedule() -> ProviderError {
    ProviderError::new(
        "invalid_schedule",
        "ChatGPT returned an inconsistent schedule. Retry or refine the plan's deadlines and dependencies.",
    )
}

fn date(value: &str) -> Result<NaiveDate> {
    let parsed = NaiveDate::parse_from_str(value, "%Y-%m-%d").map_err(|_| invalid_schedule())?;
    if parsed.format("%Y-%m-%d").to_string() != value {
        return Err(invalid_schedule());
    }
    Ok(parsed)
}

fn bounded_text(value: &str, characters: usize, words: usize) -> bool {
    !value.trim().is_empty()
        && value.chars().count() <= characters
        && value.split_whitespace().count() <= words
}

// Apply only indexed timing/order fields. Original details, intent and citations
// never round-trip through the second model's output.
pub fn apply(mut output: Value, patch: Value, clock: &Value) -> Result<Value> {
    let schedule: Schedule = serde_json::from_value(patch).map_err(|_| invalid_schedule())?;
    if schedule.conflict.is_some() {
        return Err(ProviderError::new(
            "schedule_conflict",
            "The plan's timing and prerequisites conflict. Refine the deadlines or dependencies and retry.",
        ));
    }
    if !bounded_text(&schedule.recommendation, 180, 25)
        || !bounded_text(&schedule.assessment, 260, 40)
    {
        return Err(invalid_schedule());
    }
    let now = DateTime::parse_from_rfc3339(clock["now"].as_str().ok_or_else(invalid_schedule)?)
        .map_err(|_| invalid_schedule())?;
    let today = now.date_naive();
    let plan = output["proposal"]
        .as_object_mut()
        .ok_or_else(invalid_schedule)?;
    let mission_deadline = plan
        .get("deadlineAt")
        .ok_or_else(invalid_schedule)?
        .as_str()
        .map(|deadline| {
            DateTime::parse_from_rfc3339(deadline)
                .map(|deadline| deadline.with_timezone(now.offset()).date_naive())
                .map_err(|_| invalid_schedule())
        })
        .transpose()?;
    let original = plan
        .get("checkpoints")
        .and_then(Value::as_array)
        .ok_or_else(invalid_schedule)?;
    if original.is_empty() || original.len() != schedule.checkpoints.len() {
        return Err(invalid_schedule());
    }
    let mut seen_checkpoints = HashSet::new();
    let mut ordered_checkpoints = Vec::new();
    let mut previous_deadline = None;
    let mut action_dates = HashMap::new();
    let mut ready_title = None;
    let mut inferred = false;
    for scheduled in schedule.checkpoints {
        let mut checkpoint = original
            .get(scheduled.checkpoint_index)
            .ok_or_else(invalid_schedule)?
            .clone();
        if !seen_checkpoints.insert(scheduled.checkpoint_index) {
            return Err(invalid_schedule());
        }
        let deadline = date(&scheduled.due_on)?;
        if previous_deadline.is_some_and(|previous| previous > deadline)
            || mission_deadline.is_some_and(|mission| deadline > mission)
        {
            return Err(invalid_schedule());
        }
        previous_deadline = Some(deadline);
        if checkpoint["dueOn"]
            .as_str()
            .is_some_and(|due| due != scheduled.due_on)
        {
            return Err(invalid_schedule());
        }
        // A new checkpoint date is a proposal even when copied from narrative
        // context; explicit commitments remain visible in the preserved detail.
        inferred |= checkpoint["dueOn"].is_null();
        let actions = checkpoint["actions"]
            .as_array()
            .ok_or_else(invalid_schedule)?;
        if actions.len() != scheduled.actions.len() {
            return Err(invalid_schedule());
        }
        let mut seen_actions = HashSet::new();
        let mut ordered_actions = Vec::new();
        let mut previous_date = None;
        for scheduled_action in scheduled.actions {
            let mut action = actions
                .get(scheduled_action.action_index)
                .ok_or_else(invalid_schedule)?
                .clone();
            if !seen_actions.insert(scheduled_action.action_index)
                || !["High", "Medium", "Low"].contains(&scheduled_action.priority.as_str())
            {
                return Err(invalid_schedule());
            }
            let due = date(&scheduled_action.due_on)?;
            let existing_due = action["dueOn"].as_str().map(str::to_string);
            if due > deadline
                || previous_date.is_some_and(|previous| previous > due)
                || (scheduled_action.fixed_deadline
                    && existing_due
                        .as_deref()
                        .is_some_and(|existing| existing != scheduled_action.due_on))
                || (due < today
                    && existing_due.as_deref() != Some(scheduled_action.due_on.as_str()))
            {
                return Err(invalid_schedule());
            }
            inferred |= !scheduled_action.fixed_deadline;
            previous_date = Some(due);
            let title = action["title"]
                .as_str()
                .ok_or_else(invalid_schedule)?
                .to_string();
            let dependencies = action["dependsOn"]
                .as_array()
                .ok_or_else(invalid_schedule)?;
            for dependency in dependencies {
                let title = dependency.as_str().ok_or_else(invalid_schedule)?;
                if !action_dates
                    .get(title)
                    .is_some_and(|prerequisite| *prerequisite <= due)
                {
                    return Err(invalid_schedule());
                }
            }
            if dependencies.is_empty() && ready_title.is_none() {
                ready_title = Some(title.clone());
            }
            if action_dates.insert(title, due).is_some() {
                return Err(invalid_schedule());
            }
            if let Some(previous) = existing_due {
                if previous != scheduled_action.due_on {
                    let detail = action["detail"].as_str().ok_or_else(invalid_schedule)?;
                    action["detail"] = json!(detail.replace(&previous, &scheduled_action.due_on));
                }
            }
            action["dueOn"] = json!(scheduled_action.due_on);
            action["priority"] = json!(scheduled_action.priority);
            ordered_actions.push(action);
        }
        checkpoint["dueOn"] = json!(scheduled.due_on);
        checkpoint["actions"] = json!(ordered_actions);
        ordered_checkpoints.push(checkpoint);
    }
    if ready_title.as_deref() != Some(schedule.next_action_title.as_str()) {
        return Err(invalid_schedule());
    }
    let mut assumptions = plan
        .get("assumptions")
        .and_then(Value::as_array)
        .ok_or_else(invalid_schedule)?
        .clone();
    if let Some(assumption) = schedule.scheduling_assumption {
        if !bounded_text(&assumption, 500, usize::MAX) {
            return Err(invalid_schedule());
        }
        if !assumptions.contains(&json!(assumption)) {
            assumptions.push(json!(assumption));
        }
    } else if inferred {
        assumptions.push(json!("Checkpoint deadlines and newly scheduled action dates are proposed timing for review, unless the plan already states an agreed date."));
    }
    if assumptions.len() > 20 {
        return Err(invalid_schedule());
    }
    plan.insert("checkpoints".into(), json!(ordered_checkpoints));
    plan.insert("recommendation".into(), json!(schedule.recommendation));
    plan.insert("assessment".into(), json!(schedule.assessment));
    plan.insert("assumptions".into(), json!(assumptions));
    plan.insert("scheduledAt".into(), json!(now.to_rfc3339()));
    Ok(output)
}

#[cfg(test)]
pub(super) mod tests {
    use super::*;

    pub fn test_clock() -> Value {
        json!({ "now": "2026-10-09T23:30:00-06:00", "timeZone": "-06:00", "localDate": "2026-10-09" })
    }

    pub fn candidate() -> Value {
        json!({
            "reply": "Review the plan.", "questions": [],
            "citations": [{ "scope": "mission", "sourceId": "source", "revision": 1, "excerptId": "excerpt" }],
            "proposal": {
                "name": "Release portal", "outcome": "Make the portal available.",
                "successCriteria": ["Customers can sign in."], "constraints": ["Keep rollback available."],
                "deadlineAt": "2026-10-15T05:00:00Z", "assessment": "Original assessment", "recommendation": "Original recommendation",
                "checkpoints": [
                    { "name": "Portal released", "detail": "Customers can sign in; keep rollback available.", "actions": [
                        { "title": "Enable access", "detail": "Enable access after the checks pass.", "category": "Ops", "priority": "High", "dueOn": "2026-10-13", "dependsOn": ["Run smoke checks"] }
                    ] },
                    { "name": "Release verified", "detail": "Smoke checks and rollback pass.", "actions": [
                        { "title": "Run smoke checks", "detail": "Check the login path and record the results.", "category": "Dev", "priority": "Medium", "dueOn": null, "dependsOn": ["Prepare rollback"] },
                        { "title": "Prepare rollback", "detail": "Keep the previous version available.", "category": "Ops", "priority": "Low", "dueOn": null, "dependsOn": [] }
                    ] }
                ],
                "risks": ["Customers may find issues."], "assumptions": ["The prior version remains available."]
            }
        })
    }

    pub fn patch() -> Value {
        json!({
            "checkpoints": [
                { "checkpointIndex": 1, "dueOn": "2026-10-11", "actions": [
                    { "actionIndex": 1, "dueOn": "2026-10-09", "priority": "High", "fixedDeadline": false },
                    { "actionIndex": 0, "dueOn": "2026-10-10", "priority": "High", "fixedDeadline": false }
                ] },
                { "checkpointIndex": 0, "dueOn": "2026-10-14", "actions": [
                    { "actionIndex": 0, "dueOn": "2026-10-13", "priority": "Medium", "fixedDeadline": true }
                ] }
            ],
            "nextActionTitle": "Prepare rollback", "recommendation": "Prepare rollback today before checking the release.",
            "assessment": "The rollback path protects customers if the release has problems.",
            "schedulingAssumption": "Checkpoint deadlines and new action dates are proposed for review.", "conflict": null
        })
    }

    #[test]
    fn schedules_without_losing_plan_substance_or_citations() {
        let original = candidate();
        let output = apply(original.clone(), patch(), &test_clock()).unwrap();
        for key in [
            "name",
            "outcome",
            "successCriteria",
            "constraints",
            "deadlineAt",
            "risks",
        ] {
            assert_eq!(output["proposal"][key], original["proposal"][key]);
        }
        assert_eq!(output["reply"], original["reply"]);
        assert_eq!(output["citations"], original["citations"]);
        let checkpoints = &output["proposal"]["checkpoints"];
        assert_eq!(checkpoints[0]["name"], "Release verified");
        assert_eq!(
            checkpoints[0]["detail"],
            original["proposal"]["checkpoints"][1]["detail"]
        );
        assert_eq!(checkpoints[0]["dueOn"], "2026-10-11");
        assert_eq!(checkpoints[0]["actions"][0]["title"], "Prepare rollback");
        assert_eq!(checkpoints[0]["actions"][0]["dueOn"], "2026-10-09");
        assert_eq!(
            checkpoints[0]["actions"][1]["detail"],
            original["proposal"]["checkpoints"][1]["actions"][0]["detail"]
        );
        assert_eq!(
            checkpoints[0]["actions"][1]["dependsOn"],
            json!(["Prepare rollback"])
        );
        assert_eq!(output["proposal"]["scheduledAt"], test_clock()["now"]);
        assert_eq!(
            output["proposal"]["assumptions"][0],
            original["proposal"]["assumptions"][0]
        );
        assert_eq!(
            output["proposal"]["assumptions"].as_array().unwrap().len(),
            2
        );
    }

    #[test]
    fn requires_complete_unique_patch_coverage_and_preserves_existing_dates() {
        let paths: &[(&str, Value)] = &[
            ("/checkpoints/0/checkpointIndex", json!(0)),
            ("/checkpoints/0/checkpointIndex", json!(9)),
            ("/checkpoints/0/actions/0/actionIndex", json!(0)),
            ("/checkpoints/0/actions/0/actionIndex", json!(9)),
            ("/checkpoints/0/actions", json!([])),
            ("/checkpoints", json!([])),
            ("/checkpoints/1/actions/0/dueOn", json!("2026-10-12")),
            ("/checkpoints/0/actions/0/priority", json!("Urgent")),
            ("/nextActionTitle", json!("Enable access")),
        ];
        for (path, replacement) in paths {
            let mut invalid = patch();
            *invalid.pointer_mut(path).unwrap() = replacement.clone();
            assert!(
                apply(candidate(), invalid, &test_clock()).is_err(),
                "{path}"
            );
        }
        let mut malformed = candidate();
        malformed["proposal"]
            .as_object_mut()
            .unwrap()
            .remove("assumptions");
        assert!(apply(malformed, patch(), &test_clock()).is_err());
    }

    #[test]
    fn rejects_impossible_calendar_dates_bounds_and_backward_dependencies() {
        for due in [
            "2026-02-30",
            "2026-10-08",
            "2026-10-12",
            "2026-1-9",
            "Today",
        ] {
            let mut invalid = patch();
            invalid["checkpoints"][0]["actions"][0]["dueOn"] = json!(due);
            assert!(apply(candidate(), invalid, &test_clock()).is_err(), "{due}");
        }
        let mut invalid = patch();
        invalid["checkpoints"][1]["dueOn"] = json!("2026-10-15");
        // The mission's UTC Oct 15 deadline is local Oct 14.
        assert!(apply(candidate(), invalid, &test_clock()).is_err());
        let mut invalid = patch();
        invalid["checkpoints"][0]["dueOn"] = json!("2026-10-14");
        invalid["checkpoints"][1]["dueOn"] = json!("2026-10-13");
        assert!(apply(candidate(), invalid, &test_clock()).is_err());
        let mut invalid = patch();
        invalid["checkpoints"][0]["actions"]
            .as_array_mut()
            .unwrap()
            .reverse();
        assert!(apply(candidate(), invalid, &test_clock()).is_err());
    }

    #[test]
    fn permits_same_day_prerequisites_and_retains_past_explicit_commitments() {
        let mut same_day = patch();
        same_day["checkpoints"][0]["actions"][1]["dueOn"] = json!("2026-10-09");
        assert!(apply(candidate(), same_day, &test_clock()).is_ok());
        let mut original = candidate();
        original["proposal"]["checkpoints"][1]["actions"][1]["dueOn"] = json!("2026-10-08");
        let mut overdue = patch();
        overdue["checkpoints"][0]["actions"][0]["dueOn"] = json!("2026-10-08");
        assert!(apply(original, overdue, &test_clock()).is_ok());
    }

    #[test]
    fn improves_proposed_timing_and_updates_only_the_proposed_date_in_detail() {
        let mut original = candidate();
        original["proposal"]["checkpoints"][1]["actions"][0]["dueOn"] = json!("2026-10-11");
        original["proposal"]["checkpoints"][1]["actions"][0]["detail"] = json!(
            "- Complete smoke checks by 2026-10-11.\n- Keep the agreed release date of 2026-10-13."
        );
        let output = apply(original, patch(), &test_clock()).unwrap();
        assert_eq!(
            output["proposal"]["checkpoints"][0]["actions"][1]["dueOn"],
            "2026-10-10"
        );
        assert_eq!(
            output["proposal"]["checkpoints"][0]["actions"][1]["detail"],
            "- Complete smoke checks by 2026-10-10.\n- Keep the agreed release date of 2026-10-13."
        );
    }

    #[test]
    fn conflict_and_invalid_recommendations_cannot_publish_a_schedule() {
        let mut conflict = patch();
        conflict["conflict"] = json!("The external approval arrives after the launch deadline.");
        assert_eq!(
            apply(candidate(), conflict, &test_clock())
                .unwrap_err()
                .code,
            "schedule_conflict"
        );
        let mut too_long = patch();
        too_long["recommendation"] = json!("x".repeat(181));
        assert!(apply(candidate(), too_long, &test_clock()).is_err());
        let mut original = candidate();
        original["proposal"]["assumptions"] = json!(vec!["Existing assumption"; 20]);
        assert!(apply(original, patch(), &test_clock()).is_err());
    }
}
