import { DesktopWindow } from "@/components/desktop/components/DesktopWindow";
import { TimelineWindow } from "@/features/attention/components/TimelineWindow";
import { EMPTY_TIMELINE } from "@/pages/home/constants/home.constants";
import { TimelineWindowActions } from "@/pages/home/components/TimelineWindowActions";
import type { HomeScreenModel } from "@/pages/home/hooks/useHomeScreen";
export function HomeTimelineWindow({ model }: { model: HomeScreenModel }) {
  const {
    mission,
    expanded,
    toggleExpanded,
    open,
    desktop,
    desktopCanvas,
    draggable,
    windows,
    focusTimeline,
    closeDrawer,
    timelineTrigger,
  } = model;
  return (
    <DesktopWindow
      id="timeline"
      title="Timeline"
      header={<h2>Timeline</h2>}
      actions={<TimelineWindowActions desktop={desktop} close={closeDrawer} open={open} />}
      className={`timeline-window ${!desktop ? "is-drawer" : ""}`}
      workspace={desktopCanvas}
      draggable={draggable}
      position={windows.timeline}
      active={windows.active === "timeline"}
      onFocus={focusTimeline}
      modal={!desktop}
      onDismiss={closeDrawer}
      restoreFocusTo={timelineTrigger}
    >
      <TimelineWindow
        timeline={mission ?? EMPTY_TIMELINE}
        expanded={expanded}
        toggleExpanded={toggleExpanded}
        open={open}
      />
    </DesktopWindow>
  );
}
