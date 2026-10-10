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
import type { usePolarAccount } from "@/features/application-auth/hooks/usePolarAccount";
import { useWorkspaceSettings } from "@/features/workspaces/hooks/useWorkspaceSettings";
import { clearQuickAiSnapshots } from "@/features/quick-ai/hooks/useQuickAi";
import { clearWorkspaceContextDrafts } from "@/features/workspace-context/hooks/useWorkspaceContext";

type AccountModel = ReturnType<typeof usePolarAccount>;

export function useHomeScreen(account: AccountModel) {
  const desktopCanvas = useRef<HTMLElement>(null);
  const timelineTrigger = useRef<HTMLButtonElement>(null);
  const windows = useDesktopWindows();
  const desktop = useMediaQuery(DESKTOP_QUERY);
  const timeline = useHomeTimeline(desktop);
  const [missions, setMissions] = useState<Mission[]>([]);
  const [missionsWorkspaceId, setMissionsWorkspaceId] = useState<string | null>(null);
  const [missionLoadFailed, setMissionLoadFailed] = useState(false);
  const [pendingSelection, setPendingSelection] = useState<string | null>(null);
  const workspaceId = account.status.selectedWorkspaceId;
  const accountId = account.status.userId;
  const scopeKey = accountId && workspaceId ? `${accountId}:${workspaceId}` : null;
  const visibleMissions = missionsWorkspaceId === scopeKey ? missions : [];
  const workspaceSettings = useWorkspaceSettings(account);
  const selection = useMissionSelection(timeline.resetExpanded, visibleMissions, scopeKey);
  const overlay = useHomeOverlay();
  const activeWorkspace = useRef(scopeKey);
  activeWorkspace.current = scopeKey;
  const quickAi = useQuickAi({
    closeOverlays: overlay.close,
    initialIntent: "new-mission",
    workspaceId,
    accountId,
  });
  const previousAccount = useRef<{ authenticated: boolean; id: string | null }>({
    authenticated: false,
    id: null,
  });
  const previousWorkspaces = useRef<{ accountId: string | null; ids: string[] }>({
    accountId: null,
    ids: [],
  });
  useEffect(() => {
    const previous = previousAccount.current;
    if (
      previous.authenticated &&
      previous.id &&
      (!account.status.authenticated || previous.id !== accountId)
    ) {
      clearQuickAiSnapshots(previous.id);
      clearWorkspaceContextDrafts(previous.id);
    }
    previousAccount.current = { authenticated: account.status.authenticated, id: accountId };
  }, [account.status.authenticated, accountId]);
  useEffect(() => {
    const previous = previousWorkspaces.current;
    const currentIds = account.status.workspaces.map((workspace) => workspace.id);
    if (previous.accountId === accountId && accountId) {
      for (const workspaceId of previous.ids) {
        if (!currentIds.includes(workspaceId)) {
          clearQuickAiSnapshots(accountId, workspaceId);
          clearWorkspaceContextDrafts(accountId, workspaceId);
        }
      }
    }
    previousWorkspaces.current = { accountId, ids: currentIds };
  }, [account.status.workspaces, accountId]);
  const refreshMissions = useCallback(async () => {
    const originWorkspaceId = workspaceId;
    const originScope = scopeKey;
    if (!originWorkspaceId) {
      setMissions([]);
      setMissionsWorkspaceId(originScope);
      setMissionLoadFailed(false);
      return;
    }
    if (!isTauri()) return;
    try {
      const rows = await invoke<Parameters<typeof presentMission>[0][]>("polar_missions", {
        workspaceId: originWorkspaceId,
      });
      if (activeWorkspace.current !== originScope) return;
      setMissions(rows.map(presentMission));
      setMissionsWorkspaceId(originScope);
      setMissionLoadFailed(false);
    } catch {
      if (activeWorkspace.current === originScope) {
        setMissions([]);
        setMissionsWorkspaceId(originScope);
        setMissionLoadFailed(true);
      }
    }
  }, [scopeKey, workspaceId]);
  const updateAction = useCallback(
    async (missionId: string, actionId: string, updates: MissionActionUpdate) => {
      const originWorkspaceId = workspaceId;
      const originScope = scopeKey;
      if (!originWorkspaceId || !originScope) return;
      await invoke("polar_mission_action_update", {
        workspaceId: originWorkspaceId,
        missionId,
        actionId,
        updates,
      });
      if (activeWorkspace.current === originScope) await refreshMissions();
    },
    [refreshMissions, scopeKey, workspaceId],
  );
  useEffect(() => {
    void refreshMissions();
  }, [refreshMissions]);
  useEffect(() => {
    setMissions([]);
    setMissionsWorkspaceId(null);
    setMissionLoadFailed(false);
    setPendingSelection(null);
    overlay.close();
    windows.reset();
    timeline.closeDrawer();
    timeline.resetExpanded();
  }, [overlay.close, timeline.closeDrawer, timeline.resetExpanded, windows.reset, scopeKey]);
  useEffect(() => {
    if (pendingSelection && visibleMissions.some((mission) => mission.id === pendingSelection)) {
      selection.select(pendingSelection, true);
      setPendingSelection(null);
    }
  }, [pendingSelection, selection, visibleMissions]);

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
  const openWorkspaceSettingsFromQuickAi = useCallback(
    (trigger?: HTMLElement) => {
      overlay.open({ kind: "workspace-settings", anchor: trigger });
    },
    [overlay.open],
  );
  const focusMission = useCallback(() => windows.focus("mission"), [windows]);
  const focusTimeline = useCallback(() => windows.focus("timeline"), [windows]);
  const proposal = quickAi.chat.proposal;
  const reviewMission =
    quickAi.visible && quickAi.reviewing && proposal
      ? presentProposal(
          proposal.id,
          proposal.content,
          quickAi.chat.sources,
          proposal.contextManifest,
          proposal.citationReferences,
        )
      : null;
  const activateReviewedProposal = useCallback(async () => {
    const originScope = scopeKey;
    if (!workspaceId || !originScope) return;
    const missionId = await quickAi.activate();
    if (!missionId) return;
    if (activeWorkspace.current !== originScope) return;
    setPendingSelection(missionId);
    await refreshMissions().catch(() => {});
    if (activeWorkspace.current === originScope) windows.focus("mission");
  }, [quickAi.activate, refreshMissions, scopeKey, windows, workspaceId]);
  const regeneratePlan = useCallback(() => {
    void quickAi.regeneratePlan(reviewMission ? undefined : selection.mission?.id);
  }, [quickAi.regeneratePlan, reviewMission, selection.mission?.id]);
  const planGenerating =
    quickAi.visible &&
    (quickAi.chat.loading || ["queued", "claimed"].includes(quickAi.chat.request?.status ?? ""));
  const focusHomeMission = reviewMission ?? selection.mission;
  const openWorkspaceSettings = useCallback(
    () => overlay.open({ kind: "workspace-settings" }),
    [overlay.open],
  );
  const openWorkspaceCreate = useCallback(
    () => overlay.open({ kind: "workspace-create" }),
    [overlay.open],
  );
  const selectWorkspace = useCallback(
    (id: string) => {
      void workspaceSettings.selectWorkspace(id);
      overlay.close();
    },
    [overlay.close, workspaceSettings.selectWorkspace],
  );
  return {
    missions: visibleMissions,
    missionLoadFailed: missionsWorkspaceId === workspaceId && missionLoadFailed,
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
    openWorkspaceSettingsFromQuickAi,
    openWorkspaceSettings,
    openWorkspaceCreate,
    selectWorkspace,
    workspaceSettings,
    account,
    workspaceId,
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
