import type { Mission } from "@/features/missions/types/mission.types";
import type { MissionActionUpdate } from "@polar/contracts";
import { useCallback, useEffect, useRef, useState } from "react";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { useDesktopWindows } from "@/components/desktop/hooks/useDesktopWindows";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { DESKTOP_QUERY } from "@/pages/home/constants/home.constants";
import { useHomeTimeline } from "@/pages/home/hooks/useHomeTimeline";
import { useMissionSelection } from "@/pages/home/hooks/useMissionSelection";
import { useHomeOverlay } from "@/pages/home/hooks/useHomeOverlay";
import { useQuickAi } from "@/features/quick-ai/hooks/useQuickAi";
import { presentMission, presentProposal } from "@/features/missions/utils/missionPresentation";

export function useHomeScreen() {
  const desktopCanvas = useRef<HTMLElement>(null);
  const timelineTrigger = useRef<HTMLButtonElement>(null);
  const windows = useDesktopWindows();
  const desktop = useMediaQuery(DESKTOP_QUERY);
  const timeline = useHomeTimeline(desktop);
  const [missions, setMissions] = useState<Mission[]>([]);
  const [missionLoadFailed, setMissionLoadFailed] = useState(false);
  const [pendingSelection, setPendingSelection] = useState<string | null>(null);
  const selection = useMissionSelection(timeline.resetExpanded, missions);
  const overlay = useHomeOverlay();
  const quickAi = useQuickAi({ closeOverlays: overlay.close, initialIntent: "new-mission" });
  const refreshMissions = useCallback(async () => {
    if (!isTauri()) return;
    try {
      const rows = await invoke<Parameters<typeof presentMission>[0][]>("polar_missions");
      setMissions(rows.map(presentMission));
      setMissionLoadFailed(false);
    } catch {
      setMissions([]);
      setMissionLoadFailed(true);
    }
  }, []);
  const updateAction = useCallback(
    async (missionId: string, actionId: string, updates: MissionActionUpdate) => {
      await invoke("polar_mission_action_update", { missionId, actionId, updates });
      await refreshMissions();
    },
    [refreshMissions],
  );
  useEffect(() => {
    void refreshMissions();
  }, [refreshMissions]);
  useEffect(() => {
    if (pendingSelection && missions.some((mission) => mission.id === pendingSelection)) {
      selection.select(pendingSelection, true);
      setPendingSelection(null);
    }
  }, [missions, pendingSelection, selection]);

  const quickAiMission = selection.mission
    ? {
        id: selection.mission.id,
        name: selection.mission.name,
        evidence: selection.mission.evidence.map(({ title }) => ({ title })),
      }
    : null;
  const openQuickAiCommand = useCallback(
    (trigger?: HTMLElement) => quickAi.openQuickAi("command", trigger),
    [quickAi.openQuickAi],
  );
  const openQuickAiNewMission = useCallback(
    (trigger?: HTMLElement) => quickAi.openQuickAi("new-mission", trigger),
    [quickAi.openQuickAi],
  );
  const openWorkspaceContext = useCallback(
    (trigger?: HTMLElement) => {
      overlay.open({ kind: "workspace-context", anchor: trigger });
    },
    [overlay.open],
  );
  const focusMission = useCallback(() => windows.focus("mission"), [windows]);
  const focusTimeline = useCallback(() => windows.focus("timeline"), [windows]);
  const proposal = quickAi.chat.proposal;
  const reviewMission =
    quickAi.reviewing && proposal
      ? presentProposal(
          proposal.id,
          proposal.content,
          quickAi.chat.sources,
          proposal.contextManifest,
          proposal.citationReferences,
        )
      : null;
  const activateReviewedProposal = useCallback(async () => {
    const missionId = await quickAi.activate();
    if (!missionId) return;
    setPendingSelection(missionId);
    await refreshMissions().catch(() => {});
    windows.focus("mission");
  }, [quickAi.activate, refreshMissions, windows]);
  const regeneratePlan = useCallback(() => {
    void quickAi.regeneratePlan(reviewMission ? undefined : selection.mission?.id);
  }, [quickAi.regeneratePlan, reviewMission, selection.mission?.id]);
  const planGenerating =
    quickAi.chat.loading || ["queued", "claimed"].includes(quickAi.chat.request?.status ?? "");
  const focusHomeMission = reviewMission ?? selection.mission;
  return {
    missions,
    missionLoadFailed,
    ...selection,
    mission: focusHomeMission,
    reviewingProposal: Boolean(reviewMission),
    regeneratePlan,
    planGenerating,
    activateReviewedProposal,
    refreshMissions,
    updateAction,
    ...timeline,
    ...overlay,
    quickAi,
    quickAiMission,
    openQuickAiCommand,
    openQuickAiNewMission,
    openWorkspaceContext,
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
