import { useEffect, useState, type ChangeEvent, type FormEvent, type MouseEvent } from "react";
import { invoke, isTauri } from "@tauri-apps/api/core";
import type { MissionActionUpdate } from "@polar/contracts";
import type { OverlayRequest } from "@/components/ui/overlay.types";
import { actionTiming } from "@/utils/actionTiming";
import { visibleActionCategory } from "@/utils/actionCategory";
import { useCurrentTime } from "@/hooks/useCurrentTime";
import type { ActionPriority, Mission } from "@/features/missions/types/mission.types";

const PRIORITIES: ActionPriority[] = ["High", "Medium", "Low"];

interface ActionMessage {
  id: string;
  role: string;
  content: string;
  conclusion: boolean;
  createdAt: string;
}
interface ActionEvidence {
  id: string;
  kind: string;
  content: string;
  referenceUrl: string | null;
  evaluation: string;
  evaluationReason: string | null;
  createdAt: string;
}
interface ActionActivity {
  messages: ActionMessage[];
  evidence: ActionEvidence[];
  canParticipate: boolean;
  completionCriteria: string;
  evidenceStatus: string;
  evidenceReason: string | null;
}

const emptyActivity: ActionActivity = {
  messages: [],
  evidence: [],
  canParticipate: false,
  completionCriteria: "",
  evidenceStatus: "awaiting_evidence",
  evidenceReason: null,
};

export function useActionDetail(
  request: OverlayRequest,
  mission: Mission,
  updateAction?: (
    missionId: string,
    actionId: string,
    updates: MissionActionUpdate,
  ) => Promise<void> | undefined,
  workspaceId?: string,
) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [activity, setActivity] = useState<ActionActivity>(emptyActivity);
  const [activityError, setActivityError] = useState("");
  const [messageText, setMessageText] = useState("");
  const [referenceUrl, setReferenceUrl] = useState("");
  const [conclusion, setConclusion] = useState(false);
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
  const canParticipate = Boolean(activity.canParticipate && actionId && workspaceId);
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

  useEffect(() => {
    if (!isTauri() || !workspaceId || !actionId) {
      setActivity(emptyActivity);
      return;
    }
    let current = true;
    void invoke<ActionActivity>("polar_action_activity", {
      workspaceId,
      missionId: mission.id,
      actionId,
    })
      .then((result) => {
        if (current) setActivity(result);
      })
      .catch((failure: unknown) => {
        if (current) setActivityError(failure instanceof Error ? failure.message : String(failure));
      });
    return () => {
      current = false;
    };
  }, [actionId, mission.id, workspaceId]);

  const refreshActivity = async () => {
    if (!workspaceId || !actionId) return;
    const result = await invoke<ActionActivity>("polar_action_activity", {
      workspaceId,
      missionId: mission.id,
      actionId,
    });
    setActivity(result);
  };
  const handleActivityFailure = (failure: unknown) => {
    const message = failure instanceof Error ? failure.message : String(failure);
    setActivityError(message);
    if (message.toLowerCase().includes("current members of this action"))
      setActivity((current) => ({ ...current, canParticipate: false }));
  };
  const evaluateSavedActivity = async () => {
    if (!workspaceId || !actionId) return;
    try {
      await invoke("polar_action_evaluate", { workspaceId, missionId: mission.id, actionId });
      await refreshActivity();
    } catch (failure) {
      const message = failure instanceof Error ? failure.message : String(failure);
      setActivityError(`Saved. Evaluation is waiting: ${message}`);
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
  const handleMessageChange = (event: ChangeEvent<HTMLTextAreaElement>) =>
    setMessageText(event.currentTarget.value);
  const handleReferenceChange = (event: ChangeEvent<HTMLInputElement>) =>
    setReferenceUrl(event.currentTarget.value);
  const handleConclusionChange = (event: ChangeEvent<HTMLInputElement>) =>
    setConclusion(event.currentTarget.checked);
  const handleSubmitMessage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canParticipate || !messageText.trim() || !actionId || !workspaceId) return;
    try {
      await invoke("polar_action_message", {
        workspaceId,
        missionId: mission.id,
        actionId,
        content: messageText,
        idempotencyKey: crypto.randomUUID(),
        conclusion,
      });
      setMessageText("");
      setConclusion(false);
      setActivityError("");
      await refreshActivity();
      await evaluateSavedActivity();
    } catch (failure) {
      handleActivityFailure(failure);
    }
  };
  const handleSubmitReference = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const url = referenceUrl.trim();
    if (!canParticipate || !url || !actionId || !workspaceId) return;
    try {
      await invoke("polar_action_evidence", {
        workspaceId,
        missionId: mission.id,
        actionId,
        kind: "reference",
        content: url,
        referenceUrl: url,
        idempotencyKey: crypto.randomUUID(),
      });
      setReferenceUrl("");
      setActivityError("");
      await refreshActivity();
      await evaluateSavedActivity();
    } catch (failure) {
      handleActivityFailure(failure);
    }
  };
  const handleImportEvidence = async () => {
    if (!canParticipate || !actionId || !workspaceId) return;
    try {
      const imported = await invoke<{
        sources: { fileName: string; extractedText: string }[];
        failures: { fileName: string; message: string }[];
      }>("polar_import_mission_context");
      for (const source of imported.sources) {
        await invoke("polar_action_evidence", {
          workspaceId,
          missionId: mission.id,
          actionId,
          kind: "document",
          content: `${source.fileName}\n\n${source.extractedText}`,
          referenceUrl: null,
          idempotencyKey: crypto.randomUUID(),
        });
      }
      setActivityError(
        imported.failures.map((failure) => `${failure.fileName}: ${failure.message}`).join("\n"),
      );
      await refreshActivity();
      if (imported.sources.length) await evaluateSavedActivity();
    } catch (failure) {
      handleActivityFailure(failure);
    }
  };

  return {
    actionId,
    title,
    detail,
    category: visibleActionCategory(action?.category ?? request.action?.category),
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
    canParticipate,
    activity,
    activityError,
    messageText,
    referenceUrl,
    conclusion,
    completionCriteria:
      activity.completionCriteria || action?.completionCriteria || action?.detail || detail || "",
    evidenceStatus: action?.evidenceStatus ?? activity.evidenceStatus,
    evidenceReason: action?.evidenceReason ?? activity.evidenceReason,
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
  };
}
