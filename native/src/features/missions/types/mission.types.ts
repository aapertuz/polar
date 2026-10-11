export type MissionTab = "Overview" | "Plan" | "Context";
export type ActionPriority = "High" | "Medium" | "Low";
export type ActionStatus = "upcoming" | "completed";

export interface MissionPerson {
  id?: string;
  name: string;
  role: string;
  initials: string;
}

export interface MissionAction {
  id?: string;
  title: string;
  detail: string;
  category?: string;
  dueOn?: string | null;
  priority?: ActionPriority;
  status?: ActionStatus;
  dependencies?: string[];
  assigneeIds?: string[];
  contextSourceIds?: string[];
  completionCriteria?: string;
  evidenceStatus?:
    | "awaiting_evidence"
    | "awaiting_evaluation"
    | "insufficient"
    | "accepted"
    | "review";
  evidenceReason?: string | null;
}

export interface Mission {
  id: string;
  name: string;
  outcome: string;
  progress?: number;
  deadline?: string;
  deadlineAt?: string;
  units: { received: number; target: number; label: string };
  actionCount: number;
  successCriteria?: string[];
  risks?: string[];
  assumptions?: string[];
  assessment: string;
  progressStatus?: string;
  progressRevision?: number;
  recommendation: string;
  proposedChange: string;
  constraint: string;
  checkpoints: {
    name: string;
    detail: string;
    status: "Complete" | "In progress" | "Upcoming";
    date: string;
    dueOn?: string | null;
    actions?: {
      title: string;
      detail: string;
      dependsOn?: string[];
      dueOn?: string | null;
      date?: string;
    }[];
  }[];
  currentUserId?: string;
  people: MissionPerson[];
  workspacePeople?: MissionPerson[];
  evidence: {
    id?: string;
    title: string;
    source: string;
    date: string;
    scope?: "workspace" | "mission";
    revision?: number;
    contentHash?: string;
    cited?: boolean;
    currentState?: "current" | "changed" | "removed";
  }[];
  actions?: MissionAction[];
  upcoming: (MissionAction & {
    timing: string;
    owner: string;
  })[];
  activity: { title: string; timing: string; icon: "folder" | "file" | "plus"; detail: string }[];
}
