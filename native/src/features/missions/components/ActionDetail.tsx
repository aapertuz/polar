import type { MissionActionUpdate } from "@polar/contracts";
import { Icon } from "@/components/ui/Icon";
import type { OverlayRequest } from "@/components/ui/overlay.types";
import { useActionDetail } from "@/features/missions/hooks/useActionDetail";
import type { Mission } from "@/features/missions/types/mission.types";

interface Props {
  request: OverlayRequest;
  mission: Mission;
  updateAction?: (
    missionId: string,
    actionId: string,
    updates: MissionActionUpdate,
  ) => Promise<void>;
}

export function ActionDetail({ request, mission, updateAction }: Props) {
  const detail = useActionDetail(request, mission, updateAction);
  const {
    title,
    detail: description,
    dueOn,
    priority,
    priorities,
    completed,
    assigneeIds,
    timing,
    assignedPeople,
    availablePeople,
    attachedResources,
    availableResources,
    memberLabel,
    saving,
    error,
    canSave,
    handleDeadlineChange,
    handlePriorityChange,
    handleClearDeadline,
    handleAssigneeChange,
    handleContextChange,
    handleContextRemove,
    handleToggleCompletion,
  } = detail;

  return (
    <div className="action-detail">
      <div className="action-detail-heading">
        <p className="action-breadcrumb">
          <span>{mission.name}</span>
          <span aria-hidden="true">/</span>
          <span>Action</span>
        </p>
      </div>
      <h2 className={`action-detail-title ${completed ? "is-complete" : ""}`}>{title}</h2>
      <div className="action-metadata" aria-label="Action properties">
        <div className="action-deadline-field">
          <label className="action-property action-deadline-control">
            <Icon name="calendar" size={20} />
            <span>{timing}</span>
            <Icon name="chevron" size={14} />
            <input
              type="date"
              aria-label="Action deadline"
              value={dueOn ?? ""}
              disabled={saving || !canSave}
              onChange={handleDeadlineChange}
            />
          </label>
          {dueOn && (
            <button
              className="action-clear-deadline icon-button"
              aria-label="Clear action deadline"
              title="Clear deadline"
              disabled={saving || !canSave}
              onClick={handleClearDeadline}
            >
              <Icon name="close" size={14} />
            </button>
          )}
        </div>

        <label
          className={`action-property action-priority-control ${priority === "High" ? "action-high-priority" : ""}`}
        >
          <Icon name="flag" size={20} />
          <select
            aria-label="Action priority"
            value={priority}
            disabled={saving || !canSave}
            onChange={handlePriorityChange}
          >
            {priorities.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
          <Icon name="chevron" size={14} />
        </label>

        <details className="action-picker action-member-picker">
          <summary className="action-property" aria-label={`Members: ${memberLabel}`}>
            <span className="action-member-avatar" aria-hidden="true">
              {assignedPeople[0]?.initials ?? "—"}
            </span>
            <span>{memberLabel}</span>
            <Icon name="chevron" size={14} />
          </summary>
          <div className="action-picker-panel">
            <p className="action-picker-title">Assign members</p>
            {availablePeople.length ? (
              availablePeople.map((person) => (
                <label className="action-picker-option" key={person.id}>
                  <input
                    type="checkbox"
                    checked={assigneeIds.includes(person.id ?? "")}
                    disabled={saving || !canSave}
                    onChange={handleAssigneeChange(person.id!)}
                  />
                  <span className="action-member-avatar" aria-hidden="true">
                    {person.initials}
                  </span>
                  <span>{person.id === mission.currentUserId ? "You" : person.name}</span>
                </label>
              ))
            ) : (
              <p className="action-picker-empty">No workspace members are available.</p>
            )}
          </div>
        </details>
      </div>

      <section className="action-description" aria-label="Description">
        <h3>Description</h3>
        <p>{description || "No description added."}</p>
      </section>

      <section className="action-resources" aria-label="Action context">
        <div className="action-resource-heading">
          <h3>
            Context <span className="action-resource-count">{attachedResources.length}</span>
          </h3>
          {availableResources.length ? (
            <details className="action-picker action-context-picker">
              <summary className="icon-button" aria-label="Add context" title="Add context">
                <Icon name="plus" size={22} />
              </summary>
              <div className="action-picker-panel">
                <p className="action-picker-title">Add mission context</p>
                {availableResources.map((resource) => (
                  <label className="action-picker-option" key={resource.id}>
                    <input
                      type="checkbox"
                      checked={false}
                      disabled={saving || !canSave}
                      onChange={handleContextChange(resource.id!)}
                    />
                    <span>{resource.title}</span>
                  </label>
                ))}
              </div>
            </details>
          ) : (
            <button
              className="icon-button action-add-context"
              aria-label="No additional mission context available"
              title="All available mission context is attached"
              disabled
            >
              <Icon name="plus" size={22} />
            </button>
          )}
        </div>
        {attachedResources.length ? (
          <>
            <p className="action-resource-scope">Mission context</p>
            <ul className="action-resource-list">
              {attachedResources.map((resource) => (
                <li key={resource.id ?? resource.title}>
                  <span className="action-resource-icon">
                    <Icon name="file" size={22} />
                  </span>
                  <div>
                    <span className="action-resource-title">{resource.title}</span>
                    <span className="action-resource-meta">
                      {resource.source} · {resource.date}
                    </span>
                  </div>
                  <button
                    className="action-resource-remove icon-button"
                    aria-label={`Remove ${resource.title} from this action`}
                    title="Remove from this action"
                    disabled={saving || !canSave}
                    onClick={handleContextRemove(resource.id!)}
                  >
                    <Icon name="close" size={15} />
                  </button>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="action-resource-empty">No context has been added to this action.</p>
        )}
      </section>

      {error && (
        <p className="action-save-error" role="alert">
          {error}
        </p>
      )}
      {saving && (
        <p className="action-save-status" role="status">
          Saving changes…
        </p>
      )}

      <footer className="action-detail-footer">
        <button
          className={`action-complete ${completed ? "is-complete" : ""}`}
          disabled={saving || !canSave}
          aria-pressed={completed}
          onClick={handleToggleCompletion}
        >
          <span className="action-complete-circle" aria-hidden="true">
            {completed && <Icon name="check" size={15} />}
          </span>
          {completed ? "Mark as active" : "Mark complete"}
        </button>
      </footer>
    </div>
  );
}
