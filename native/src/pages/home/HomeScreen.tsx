import { useCallback, useRef, useState } from "react";
import { MotionConfig } from "motion/react";
import { isTauri } from "@tauri-apps/api/core";
import { DesktopWindow } from "../../components/desktop/components/DesktopWindow";
import { Icon } from "../../components/ui/Icon";
import { SystemRail } from "../../components/desktop/components/SystemRail";
import { SystemIsland } from "../../components/desktop/components/SystemIsland";
import { MissionSwitcher } from "../../features/missions/components/MissionSwitcher";
import { MissionWindow } from "../../features/missions/components/MissionWindow";
import { TimelineWindow } from "../../features/attention/components/TimelineWindow";
import { HomeOverlays } from "./components/HomeOverlays";
import { missions } from "../../features/missions/fixtures/missions.fixtures";
import { useDesktopWindows } from "../../components/desktop/hooks/useDesktopWindows";
import { useMediaQuery } from "../../hooks/useMediaQuery";
import type { OverlayRequest } from "../../components/ui/overlay.types";
import type { MissionTab } from "../../features/missions/types/mission.types";
import "./styles/home.css";

export function HomeScreen() {
  const [selected, setSelected] = useState("pilot");
  const [tab, setTab] = useState<MissionTab>("Overview");
  const [instant, setInstant] = useState(false);
  const [overlay, setOverlay] = useState<OverlayRequest | null>(null);
  const [timelineVisible, setTimelineVisible] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const desktopCanvas = useRef<HTMLElement>(null);
  const timelineTrigger = useRef<HTMLButtonElement>(null);
  const windows = useDesktopWindows();
  const desktop = useMediaQuery("(min-width: 1180px)");
  const draggable = isTauri() || desktop;
  const mission = missions.find((m) => m.id === selected)!;
  const close = useCallback(() => setOverlay(null), []);
  const select = (id: string, immediate = false) => {
    setSelected(id);
    setTab("Overview");
    setInstant(immediate);
    setExpanded(false);
  };
  const selectTab = (next: MissionTab, immediate = false) => {
    setTab(next);
    setInstant(immediate);
  };
  const toggleTimeline = () => {
    if (desktop) setTimelineVisible((v) => !v);
    else setDrawerOpen((v) => !v);
  };
  const open = (request: OverlayRequest) => setOverlay(request);
  const showTimeline = desktop ? timelineVisible : drawerOpen;

  return (
    <MotionConfig reducedMotion="user" transition={{ ease: [0.2, 0.8, 0.2, 1], duration: 0.22 }}>
      <main ref={desktopCanvas} className="polar-desktop">
        <div className="desktop-art" aria-hidden="true">
          <span className="art-block" />
          <span className="art-orbit" />
          <span className="art-disc" />
          <span className="crosshair crosshair-top" />
          <span className="crosshair crosshair-bottom" />
        </div>
        <SystemIsland open={open} />
        <SystemRail
          open={open}
          home={() => {
            close();
            setTab("Overview");
            setInstant(true);
            setDrawerOpen(false);
          }}
        />
        <div className="desktop-layout">
          <MissionSwitcher selected={selected} select={select} open={open} />
          <div
            className={`desktop-workspace ${desktop && !timelineVisible ? "timeline-hidden" : ""}`}
          >
            <DesktopWindow
              id="mission"
              title={mission.name}
              header={
                <>
                  <span>{mission.name}</span>
                  <span className="breadcrumb-slash">/</span>
                  <span>{tab}</span>
                </>
              }
              actions={
                <button
                  className="icon-button"
                  aria-label="Mission window controls"
                  title="Window controls"
                  onClick={(e) =>
                    open({ kind: "window-menu", anchor: e.currentTarget, instant: e.detail === 0 })
                  }
                >
                  <Icon name="more" />
                </button>
              }
              className="mission-window"
              workspace={desktopCanvas}
              draggable={draggable}
              position={windows.mission}
              active={windows.active === "mission"}
              onFocus={() => windows.focus("mission")}
            >
              <MissionWindow
                mission={mission}
                tab={tab}
                selectTab={selectTab}
                open={open}
                instant={instant}
              />
            </DesktopWindow>
            {showTimeline && (
              <>
                <div
                  className={`timeline-backdrop ${desktop ? "desktop-only" : ""}`}
                  onClick={() => setDrawerOpen(false)}
                  aria-hidden="true"
                />
                <DesktopWindow
                  id="timeline"
                  title="Timeline"
                  header={<h2>Timeline</h2>}
                  actions={
                    <>
                      <span className="timeline-date">Wed, Nov 4</span>
                      <button
                        className="icon-button"
                        aria-label="Open sample calendar"
                        title="Calendar"
                        onClick={(e) =>
                          open({
                            kind: "calendar",
                            anchor: e.currentTarget,
                            instant: e.detail === 0,
                          })
                        }
                      >
                        <Icon name="calendar" size={18} />
                      </button>
                      {!desktop && (
                        <button
                          className="icon-button"
                          aria-label="Close timeline"
                          onClick={() => setDrawerOpen(false)}
                        >
                          <Icon name="close" size={18} />
                        </button>
                      )}
                    </>
                  }
                  className={`timeline-window ${!desktop ? "is-drawer" : ""}`}
                  workspace={desktopCanvas}
                  draggable={draggable}
                  position={windows.timeline}
                  active={windows.active === "timeline"}
                  onFocus={() => windows.focus("timeline")}
                  modal={!desktop}
                  onDismiss={() => setDrawerOpen(false)}
                  restoreFocusTo={timelineTrigger}
                >
                  <TimelineWindow
                    timeline={mission}
                    expanded={expanded}
                    toggleExpanded={() => setExpanded((v) => !v)}
                    open={open}
                  />
                </DesktopWindow>
              </>
            )}
          </div>
        </div>
        {(!desktop || !timelineVisible) && (
          <button
            ref={timelineTrigger}
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
