import type { Mission } from "@/features/missions/types/mission.types";
import { useCallback, useRef } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { useDesktopWindows } from "@/components/desktop/hooks/useDesktopWindows";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { DESKTOP_QUERY } from "@/pages/home/constants/home.constants";
import { useHomeTimeline } from "@/pages/home/hooks/useHomeTimeline";
import { useMissionSelection } from "@/pages/home/hooks/useMissionSelection";
import { useHomeOverlay } from "@/pages/home/hooks/useHomeOverlay";
import { useQuickAi } from "@/features/quick-ai/hooks/useQuickAi";
const missions: Mission[] = [];
export function useHomeScreen() {
  const desktopCanvas = useRef<HTMLElement>(null);
  const timelineTrigger = useRef<HTMLButtonElement>(null);
  const windows = useDesktopWindows();
  const desktop = useMediaQuery(DESKTOP_QUERY);
  const timeline = useHomeTimeline(desktop);
  const selection = useMissionSelection(timeline.resetExpanded, missions);
  const overlay = useHomeOverlay();
  const quickAiMission = selection.mission
    ? {
        id: selection.mission.id,
        name: selection.mission.name,
        evidence: selection.mission.evidence.map(({ title }) => ({ title })),
      }
    : null;
  const quickAi = useQuickAi({
    mission: quickAiMission,
    closeOverlays: overlay.close,
    initialIntent: "new-mission",
  });
  const openQuickAiCommand = useCallback(
    (trigger?: HTMLElement) => quickAi.openQuickAi("command", trigger),
    [quickAi.openQuickAi],
  );
  const openQuickAiNewMission = useCallback(
    (trigger?: HTMLElement) => quickAi.openQuickAi("new-mission", trigger),
    [quickAi.openQuickAi],
  );
  const focusMission = () => windows.focus("mission");
  const focusTimeline = () => windows.focus("timeline");
  return {
    missions,
    ...selection,
    ...timeline,
    ...overlay,
    quickAi,
    quickAiMission,
    openQuickAiCommand,
    openQuickAiNewMission,
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
