export type OverlayKind =
  | "search"
  | "launcher"
  | "documents"
  | "settings"
  | "notifications"
  | "people"
  | "proposal"
  | "calendar"
  | "detail"
  | "window-menu";
export type OverlayRequest = {
  kind: OverlayKind;
  title?: string;
  detail?: string;
  anchor?: HTMLElement;
  instant?: boolean;
};
