export type MissionTab = "Overview" | "Plan" | "Context";
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
  people: { name: string; role: string; initials: string }[];
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
  upcoming: {
    title: string;
    timing: string;
    dueOn?: string | null;
    priority?: "High" | "Medium";
    owner: string;
    detail: string;
  }[];
  activity: { title: string; timing: string; icon: "folder" | "file" | "plus"; detail: string }[];
}
