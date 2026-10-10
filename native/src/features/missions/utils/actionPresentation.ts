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
}

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
    assigneeIds: action.assigneeIds ?? (currentUserId ? [currentUserId] : []),
    contextSourceIds: action.contextSourceIds ?? [],
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
