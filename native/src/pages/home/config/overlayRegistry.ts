import type { ComponentType } from "react";
import type { OverlayKind } from "@/components/ui/overlay.types";
import type { OverlayBodyProps } from "@/pages/home/components/HomeOverlays";
import { SAMPLE_CALENDAR } from "@/pages/home/fixtures/home-preview.fixtures";
import { SearchOverlay } from "@/pages/home/components/overlays/SearchOverlay";
import { LauncherOverlay } from "@/pages/home/components/overlays/LauncherOverlay";
import { DocumentsOverlay } from "@/pages/home/components/overlays/DocumentsOverlay";
import { SettingsOverlay } from "@/pages/home/components/overlays/SettingsOverlay";
import { NotificationsOverlay } from "@/pages/home/components/overlays/NotificationsOverlay";
import { PeopleOverlay } from "@/pages/home/components/overlays/PeopleOverlay";
import { CreateOverlay } from "@/pages/home/components/overlays/CreateOverlay";
import { ProposalOverlay } from "@/pages/home/components/overlays/ProposalOverlay";
import { CalendarOverlay } from "@/pages/home/components/overlays/CalendarOverlay";
import { DetailOverlay } from "@/pages/home/components/overlays/DetailOverlay";
import { WindowMenuOverlay } from "@/pages/home/components/overlays/WindowMenuOverlay";
export interface OverlayDefinition {
  Component: ComponentType<OverlayBodyProps>;
  title: string;
  surface: "dialog" | "popover";
}
export const overlayRegistry: Record<OverlayKind, OverlayDefinition> = {
  search: { Component: SearchOverlay, title: "Find a mission", surface: "dialog" },
  launcher: { Component: LauncherOverlay, title: "Your workspace", surface: "popover" },
  documents: { Component: DocumentsOverlay, title: "Mission documents", surface: "popover" },
  settings: { Component: SettingsOverlay, title: "Appearance", surface: "popover" },
  notifications: {
    Component: NotificationsOverlay,
    title: "Needs your attention",
    surface: "popover",
  },
  people: { Component: PeopleOverlay, title: "Mission people", surface: "popover" },
  create: { Component: CreateOverlay, title: "Create a mission", surface: "dialog" },
  proposal: { Component: ProposalOverlay, title: "Preview plan adjustment", surface: "dialog" },
  calendar: { Component: CalendarOverlay, title: SAMPLE_CALENDAR.title, surface: "popover" },
  detail: { Component: DetailOverlay, title: "Details", surface: "popover" },
  "window-menu": { Component: WindowMenuOverlay, title: "Window controls", surface: "popover" },
};
