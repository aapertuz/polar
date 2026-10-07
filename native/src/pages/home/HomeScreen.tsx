import { MotionConfig } from "motion/react";
import { Icon } from "@/components/ui/Icon";
import { SystemIsland } from "@/components/desktop/components/SystemIsland";
import { MissionSwitcher } from "@/features/missions/components/MissionSwitcher";
import { HomeMissionWindow } from "@/pages/home/components/HomeMissionWindow";
import { HomeTimelineWindow } from "@/pages/home/components/HomeTimelineWindow";
import { HomeOverlays } from "@/pages/home/components/HomeOverlays";
import { useHomeScreen } from "@/pages/home/hooks/useHomeScreen";
import { HOME_MOTION } from "@/pages/home/constants/home.constants";
import "@/pages/home/styles/home.css";
export function HomeScreen() {
  const model = useHomeScreen();
  const {
    selected,
    mission,
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
        <SystemIsland open={open} />
        <div className="desktop-layout">
          <MissionSwitcher selected={selected} select={select} open={open} />
          <div
            className={`desktop-workspace ${desktop && !timelineVisible ? "timeline-hidden" : ""}`}
          >
            <HomeMissionWindow model={model} />
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
            Timeline<span className="timeline-toggle-count">{mission.upcoming.length}</span>
          </button>
        )}
        <span className="desktop-footnote">POLAR — MAKE THE NEXT MOVE CLEAR.</span>
        {overlay && (
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
          />
        )}
      </main>
    </MotionConfig>
  );
}
