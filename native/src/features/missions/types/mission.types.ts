export type MissionTab = "Overview" | "Plan" | "Context";
export interface Mission {
  id: string;
  name: string;
  outcome: string;
  progress: number;
  deadline: string;
  deadlineAt?: string;
  units: { received: number; target: number; label: string };
  actionCount: number;
  assessment: string;
  recommendation: string;
  proposedChange: string;
  constraint: string;
  checkpoints: {
    name: string;
    detail: string;
    status: "Complete" | "In progress" | "Upcoming";
    date: string;
  }[];
  people: { name: string; role: string; initials: string }[];
  evidence: { title: string; source: string; date: string }[];
  upcoming: {
    title: string;
    timing: string;
    priority?: "High" | "Medium";
    owner: string;
    detail: string;
  }[];
  activity: { title: string; timing: string; icon: "folder" | "file" | "plus"; detail: string }[];
}
