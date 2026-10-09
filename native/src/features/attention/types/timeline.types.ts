export interface TimelineData {
  people: { name: string; initials: string }[];
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
