import type { MissionActionUpdate } from "@polar/contracts";
import { CategoryPill } from "@/components/ui/CategoryPill";
import { Icon } from "@/components/ui/Icon";
import type { OverlayRequest } from "@/components/ui/overlay.types";
import { useActionDetail } from "@/features/missions/hooks/useActionDetail";
import type { Mission } from "@/features/missions/types/mission.types";

interface Props {
  request: OverlayRequest;
  mission: Mission;
  workspaceId?: string;
  updateAction?: (
    missionId: string,
    actionId: string,
    updates: MissionActionUpdate,
  ) => Promise<void>;
}

export function ActionDetail({ request, mission, updateAction, workspaceId }: Props) {
  const detail = useActionDetail(request, mission, updateAction, workspaceId);
  const {
    title,
    detail: description,
    category,
    dueOn,
    priority,
    priorities,
    completed,
    canParticipate,
    activity,
    activityError,
    messageText,
    referenceUrl,
    conclusion,
    completionCriteria,
    evidenceStatus,
    evidenceReason,
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
    handleMessageChange,
    handleReferenceChange,
    handleConclusionChange,
    handleSubmitMessage,
    handleSubmitReference,
    handleImportEvidence,
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
        {category && (
          <p className="action-category">
            <span>Category</span>
            <CategoryPill category={category} tone="dark" />
          </p>
        )}
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

      <section className="action-description" aria-label="Completion criteria">
        <h3>Completion criteria</h3>
        <p>{completionCriteria}</p>
      </section>

      <section className="action-activity" aria-label="Action conversation">
        <div className="action-resource-heading">
          <h3>Conversation and evidence</h3>
          <span className={`action-evidence-status status-${evidenceStatus}`}>
            {evidenceStatus.replace(/_/g, " ")}
          </span>
        </div>
        {evidenceReason && <p className="action-evidence-reason">{evidenceReason}</p>}
        {!canParticipate && (
          <p className="action-membership-notice">
            Only current members assigned to this action can add messages or evidence.
          </p>
        )}
        <ol className="action-message-list">
          {activity.messages.map((message) => (
            <li key={message.id} className={message.role === "assistant" ? "is-polar" : ""}>
              <span>
                {message.role === "assistant" ? "Polar" : "Action member"}
                {message.conclusion ? " · conclusion" : ""}
              </span>
              <p>{message.content}</p>
            </li>
          ))}
          {activity.evidence.map((item) => (
            <li key={item.id} className="is-evidence">
              <span>
                Evidence · {item.kind} · {item.evaluation}
              </span>
              <p>
                {item.referenceUrl ? (
                  <a href={item.referenceUrl} target="_blank" rel="noreferrer">
                    {item.referenceUrl}
                  </a>
                ) : (
                  item.content
                )}
              </p>
              {item.evaluationReason && <small>{item.evaluationReason}</small>}
            </li>
          ))}
        </ol>
        <form className="action-entry-form" onSubmit={handleSubmitMessage}>
          <label htmlFor="action-message">Message or written result</label>
          <textarea
            id="action-message"
            value={messageText}
            onChange={handleMessageChange}
            maxLength={8000}
            disabled={!canParticipate}
          />
          <label className="action-conclusion-check">
            <input
              type="checkbox"
              checked={conclusion}
              onChange={handleConclusionChange}
              disabled={!canParticipate}
            />{" "}
            This is a clear conclusion about the action
          </label>
          <button
            className="action-submit"
            type="submit"
            disabled={!canParticipate || !messageText.trim()}
          >
            Send message
          </button>
        </form>
        <form className="action-entry-form" onSubmit={handleSubmitReference}>
          <label htmlFor="action-reference">Reference link</label>
          <input
            id="action-reference"
            type="url"
            value={referenceUrl}
            onChange={handleReferenceChange}
            disabled={!canParticipate}
            required
            placeholder="https://"
          />
          <div className="action-evidence-actions">
            <button
              className="action-submit"
              type="submit"
              disabled={!canParticipate || !referenceUrl.trim()}
            >
              Submit link
            </button>
            <button
              className="action-submit secondary"
              type="button"
              disabled={!canParticipate}
              onClick={handleImportEvidence}
            >
              Attach document
            </button>
          </div>
        </form>
        {activityError && (
          <p className="action-save-error" role="alert">
            {activityError}
          </p>
        )}
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
        <p>
          {completed
            ? "Evidence accepted · action complete"
            : "Actions complete only after evidence is accepted."}
        </p>
      </footer>
    </div>
  );
}
