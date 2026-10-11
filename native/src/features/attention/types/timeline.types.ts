export interface TimelinePerson {
  id?: string;
  name: string;
  role: string;
  initials: string;
}

export interface TimelineAction {
  id?: string;
  title: string;
  detail: string;
  category?: string;
  dueOn?: string | null;
  priority?: "High" | "Medium" | "Low";
  status?: "upcoming" | "completed";
  dependencies?: string[];
  assigneeIds?: string[];
  contextSourceIds?: string[];
  timing: string;
  owner: string;
}

export interface TimelineData {
  currentUserId?: string;
  people: TimelinePerson[];
  workspacePeople?: TimelinePerson[];
  upcoming: TimelineAction[];
  activity: { title: string; timing: string; icon: "folder" | "file" | "plus"; detail: string }[];
}
