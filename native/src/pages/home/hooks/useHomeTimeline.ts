import { useCallback, useState } from "react";
import { HOME_DEFAULTS } from "@/pages/home/constants/home.constants";
export function useHomeTimeline(desktop: boolean) {
  const [timelineVisible, setTimelineVisible] = useState(HOME_DEFAULTS.timelineVisible);
  const [drawerOpen, setDrawerOpen] = useState(HOME_DEFAULTS.drawerOpen);
  const [expanded, setExpanded] = useState(HOME_DEFAULTS.expanded);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);
  const resetExpanded = () => setExpanded(false);
  const toggleExpanded = () => setExpanded((value) => !value);
  const toggleTimeline = () => {
    if (desktop) setTimelineVisible((value) => !value);
    else setDrawerOpen((value) => !value);
  };
  return {
    timelineVisible,
    expanded,
    showTimeline: desktop ? timelineVisible : drawerOpen,
    closeDrawer,
    resetExpanded,
    toggleExpanded,
    toggleTimeline,
  };
}
