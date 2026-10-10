export type OverlayKind =
  | "search"
  | "launcher"
  | "workspace-settings"
  | "workspace-create"
  | "documents"
  | "settings"
  | "notifications"
  | "people"
  | "proposal"
  | "calendar"
  | "action"
  | "detail"
  | "window-menu";
export type OverlayRequest = {
  kind: OverlayKind;
  title?: string;
  detail?: string;
  anchor?: HTMLElement;
  instant?: boolean;
  action?: {
    id?: string;
    timing: string;
    priority?: string;
    owner: string;
    ownerInitials: string;
    dueOn?: string | null;
    status?: "upcoming" | "completed";
    assigneeIds?: string[];
    contextSourceIds?: string[];
  };
};
