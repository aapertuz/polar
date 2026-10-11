export interface ActionPresentationInput {
  id?: string;
  title: string;
  detail: string;
  priority: string;
  status: string;
  dependencies?: string[];
  dueOn?: string | null;
  assigneeIds?: string[];
  contextSourceIds?: string[];
  completionCriteria?: string;
  evidenceStatus?: ActionEvidenceStatus;
  evidenceReason?: string | null;
}

export type ActionEvidenceStatus =
  | "awaiting_evidence"
  | "awaiting_evaluation"
  | "insufficient"
  | "accepted"
  | "review";

export interface PresentedMissionAction {
  id?: string;
  title: string;
  detail: string;
  priority: "High" | "Medium" | "Low" | undefined;
  status: "upcoming" | "completed";
  dependencies: string[];
  dueOn: string | null;
  assigneeIds: string[];
  contextSourceIds: string[];
  completionCriteria: string;
  evidenceStatus: ActionEvidenceStatus;
  evidenceReason: string | null;
}

export function presentActions(
  actions: ActionPresentationInput[],
  currentUserId?: string,
): PresentedMissionAction[] {
  return actions.map((action) => ({
    id: action.id,
    title: action.title,
    detail: action.detail,
    priority: presentPriority(action.priority),
    status: action.status === "completed" ? "completed" : "upcoming",
    dependencies: action.dependencies ?? [],
    dueOn: action.dueOn ?? null,
    assigneeIds:
      action.assigneeIds?.length || action.status !== "completed" || !currentUserId
        ? (action.assigneeIds ?? [])
        : [currentUserId],
    contextSourceIds: action.contextSourceIds ?? [],
    completionCriteria: action.completionCriteria ?? action.detail,
    evidenceStatus:
      action.evidenceStatus ?? (action.status === "completed" ? "accepted" : "awaiting_evidence"),
    evidenceReason: action.evidenceReason ?? null,
  }));
}

export function upcomingActions(actions: PresentedMissionAction[]): PresentedMissionAction[] {
  return actions.filter((action) => action.status === "upcoming");
}

function presentPriority(priority: string): PresentedMissionAction["priority"] {
  switch (priority.toLowerCase()) {
    case "high":
      return "High";
    case "medium":
      return "Medium";
    case "low":
      return "Low";
    default:
      return undefined;
  }
}
