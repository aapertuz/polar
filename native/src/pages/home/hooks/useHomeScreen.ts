import { useRef } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { useDesktopWindows } from "@/components/desktop/hooks/useDesktopWindows";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { DESKTOP_QUERY } from "@/pages/home/constants/home.constants";
import { useHomeTimeline } from "@/pages/home/hooks/useHomeTimeline";
import { useMissionSelection } from "@/pages/home/hooks/useMissionSelection";
import { useHomeOverlay } from "@/pages/home/hooks/useHomeOverlay";
export function useHomeScreen() {
  const desktopCanvas = useRef<HTMLElement>(null);
  const timelineTrigger = useRef<HTMLButtonElement>(null);
  const windows = useDesktopWindows();
  const desktop = useMediaQuery(DESKTOP_QUERY);
  const timeline = useHomeTimeline(desktop);
  const selection = useMissionSelection(timeline.resetExpanded);
  const overlay = useHomeOverlay();
  const focusMission = () => windows.focus("mission");
  const focusTimeline = () => windows.focus("timeline");
  return {
    ...selection,
    ...timeline,
    ...overlay,
    desktopCanvas,
    timelineTrigger,
    windows,
    desktop,
    draggable: isTauri() || desktop,
    focusMission,
    focusTimeline,
  };
}
export type HomeScreenModel = ReturnType<typeof useHomeScreen>;
