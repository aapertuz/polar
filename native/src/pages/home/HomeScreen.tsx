import { AnimatePresence, MotionConfig } from "motion/react";
import { Icon } from "@/components/ui/Icon";
import { SystemIsland } from "@/components/desktop/components/SystemIsland";
import { MissionSwitcher } from "@/features/missions/components/MissionSwitcher";
import { EmptyWorkspace } from "@/pages/home/components/EmptyWorkspace";
import { HomeMissionWindow } from "@/pages/home/components/HomeMissionWindow";
import { HomeTimelineWindow } from "@/pages/home/components/HomeTimelineWindow";
import { EmptyHomeOverlays } from "@/pages/home/components/EmptyHomeOverlays";
import { HomeOverlays } from "@/pages/home/components/HomeOverlays";
import { QuickAiSurface } from "@/features/quick-ai/components/QuickAiSurface";
import { useHomeScreen } from "@/pages/home/hooks/useHomeScreen";
import type { usePolarAccount } from "@/features/application-auth/hooks/usePolarAccount";
import { HOME_MOTION } from "@/pages/home/constants/home.constants";
import "@/pages/home/styles/home.css";
export function HomeScreen({ account }: { account: ReturnType<typeof usePolarAccount> }) {
  const model = useHomeScreen(account);
  const {
    selected,
    mission,
    missionLoadFailed,
    select,
    open,
    desktop,
    timelineVisible,
    showTimeline,
    desktopCanvas,
    closeDrawer,
    windows,
    toggleTimeline,
    overlay,
    close,
    quickAi,
    quickAiMission,
    openQuickAiCommand,
    openQuickAiNewMission,
    openWorkspaceSettingsFromQuickAi,
  } = model;
  return (
    <MotionConfig reducedMotion="user" transition={HOME_MOTION}>
      <main ref={desktopCanvas} className="polar-desktop">
        <div className="desktop-art" aria-hidden="true">
          <span className="art-block" />
          <span className="art-orbit" />
          <span className="art-disc" />
          <span className="crosshair crosshair-top" />
          <span className="crosshair crosshair-bottom" />
        </div>
        <SystemIsland
          open={open}
          openQuickAi={openQuickAiCommand}
          quickAiOpen={quickAi.session.opened}
          quickAiDisabled={!model.workspaceId}
        />
        <div className="desktop-layout">
          <MissionSwitcher
            missions={model.missions}
            missionLoadFailed={missionLoadFailed}
            selected={selected}
            select={select}
            openQuickAi={openQuickAiNewMission}
            workspaces={account.status.workspaces}
            selectedWorkspaceId={model.workspaceId}
            selectWorkspace={model.selectWorkspace}
            openWorkspaceSettings={model.openWorkspaceSettings}
            openWorkspaceCreate={model.openWorkspaceCreate}
            canCreateMission={Boolean(model.workspaceId)}
          />
          <div
            className={`desktop-workspace ${desktop && !timelineVisible ? "timeline-hidden" : ""}`}
          >
            {mission ? (
              <HomeMissionWindow model={model} />
            ) : (
              <EmptyWorkspace
                missionLoadFailed={missionLoadFailed}
                hasWorkspace={Boolean(model.workspaceId)}
                authenticated={account.status.authenticated}
                onRetry={model.refreshMissions}
                onCreateWorkspace={model.openWorkspaceCreate}
                onOpenSettings={model.openWorkspaceSettings}
              />
            )}
            {showTimeline && (
              <>
                <div
                  className={`timeline-backdrop ${desktop ? "desktop-only" : ""}`}
                  onClick={closeDrawer}
                  aria-hidden="true"
                />
                <HomeTimelineWindow model={model} />
              </>
            )}
          </div>
        </div>
        {(!desktop || !timelineVisible) && (
          <button
            ref={model.timelineTrigger}
            className="timeline-toggle"
            onClick={toggleTimeline}
            aria-expanded={showTimeline}
          >
            <Icon name="clock" size={18} />
            Timeline<span className="timeline-toggle-count">{mission?.upcoming.length ?? 0}</span>
          </button>
        )}
        <span className="desktop-footnote">POLAR — MAKE THE NEXT MOVE CLEAR.</span>
        {overlay &&
          (mission ? (
            <HomeOverlays
              key={`${overlay.kind}-${overlay.title ?? ""}`}
              request={overlay}
              mission={mission}
              close={close}
              select={select}
              reset={windows.reset}
              timelineVisible={showTimeline}
              toggleTimeline={toggleTimeline}
              open={open}
              updateAction={model.updateAction}
              account={account}
              workspaceSettings={model.workspaceSettings}
            />
          ) : (
            <EmptyHomeOverlays
              request={overlay}
              close={close}
              open={open}
              reset={windows.reset}
              timelineVisible={showTimeline}
              toggleTimeline={toggleTimeline}
              account={account}
              workspaceSettings={model.workspaceSettings}
            />
          ))}
        <AnimatePresence>
          {quickAi.visible && quickAi.session.opened && (
            <QuickAiSurface
              mission={quickAiMission}
              session={quickAi.session}
              model={quickAi}
              openWorkspaceSettings={openWorkspaceSettingsFromQuickAi}
            />
          )}
        </AnimatePresence>
      </main>
    </MotionConfig>
  );
}
