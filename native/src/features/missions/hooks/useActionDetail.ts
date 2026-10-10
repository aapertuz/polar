import { useState, type ChangeEvent, type MouseEvent } from "react";
import type { MissionActionUpdate } from "@polar/contracts";
import type { OverlayRequest } from "@/components/ui/overlay.types";
import { actionTiming } from "@/utils/actionTiming";
import { useCurrentTime } from "@/hooks/useCurrentTime";
import type { ActionPriority, Mission } from "@/features/missions/types/mission.types";

const PRIORITIES: ActionPriority[] = ["High", "Medium", "Low"];

export function useActionDetail(
  request: OverlayRequest,
  mission: Mission,
  updateAction?: (
    missionId: string,
    actionId: string,
    updates: MissionActionUpdate,
  ) => Promise<void> | undefined,
) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const now = useCurrentTime();
  const action = mission.actions?.find((item) => item.id === request.action?.id);
  const actionId = action?.id ?? request.action?.id;
  const title = action?.title ?? request.title ?? "Action";
  const detail = action?.detail ?? request.detail;
  const dueOn = action ? (action.dueOn ?? null) : (request.action?.dueOn ?? null);
  const priority =
    action?.priority ?? (request.action?.priority as ActionPriority | undefined) ?? "Medium";
  const completed = (action?.status ?? request.action?.status) === "completed";
  const assigneeIds = action?.assigneeIds ?? request.action?.assigneeIds ?? [];
  const contextSourceIds = action?.contextSourceIds ?? request.action?.contextSourceIds ?? [];
  const timing = dueOn ? actionTiming(dueOn, now) : "No deadline";
  const workspacePeople = mission.workspacePeople ?? [];
  const assignedPeople = workspacePeople.filter((person) => assigneeIds.includes(person.id ?? ""));
  const availablePeople = workspacePeople.filter((person) => person.id);
  const attachedResources = mission.evidence.filter(
    (resource) => resource.id && contextSourceIds.includes(resource.id),
  );
  const availableResources = mission.evidence.filter(
    (resource) =>
      resource.id && resource.currentState !== "removed" && !contextSourceIds.includes(resource.id),
  );
  const assignedNames = assignedPeople.map((person) =>
    person.id === mission.currentUserId ? "You" : person.name,
  );
  const memberLabel =
    assignedPeople.length === 0
      ? "Unassigned"
      : assignedNames.length > 2
        ? `${assignedNames[0]} +${assignedNames.length - 1}`
        : assignedNames.join(", ");

  const save = async (updates: MissionActionUpdate) => {
    if (!actionId || !updateAction || saving) return;
    setSaving(true);
    setError("");
    try {
      const result = updateAction(mission.id, actionId, updates);
      if (result) await result;
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure));
    } finally {
      setSaving(false);
    }
  };

  const handleDeadlineChange = (event: ChangeEvent<HTMLInputElement>) => {
    void save({ dueOn: event.currentTarget.value || null });
  };
  const handlePriorityChange = (event: ChangeEvent<HTMLSelectElement>) => {
    void save({ priority: event.currentTarget.value as ActionPriority });
  };
  const handleClearDeadline = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    void save({ dueOn: null });
  };
  const handleAssigneeChange = (personId: string) => (event: ChangeEvent<HTMLInputElement>) => {
    const next = event.currentTarget.checked
      ? [...assigneeIds, personId]
      : assigneeIds.filter((id) => id !== personId);
    void save({ assigneeIds: next });
  };
  const handleContextChange = (sourceId: string) => () => {
    void save({ contextSourceIds: [...contextSourceIds, sourceId] });
  };
  const handleContextRemove = (sourceId: string) => (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    void save({ contextSourceIds: contextSourceIds.filter((id) => id !== sourceId) });
  };
  const handleToggleCompletion = () => {
    void save({ status: completed ? "upcoming" : "completed" });
  };

  return {
    actionId,
    title,
    detail,
    dueOn,
    priority,
    priorities: PRIORITIES,
    completed,
    assigneeIds,
    contextSourceIds,
    timing,
    assignedPeople,
    availablePeople,
    attachedResources,
    availableResources,
    memberLabel,
    saving,
    error,
    canSave: Boolean(actionId && updateAction),
    handleDeadlineChange,
    handlePriorityChange,
    handleClearDeadline,
    handleAssigneeChange,
    handleContextChange,
    handleContextRemove,
    handleToggleCompletion,
  };
}
