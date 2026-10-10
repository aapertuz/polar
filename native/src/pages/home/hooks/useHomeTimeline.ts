import { useCallback, useState } from "react";
import { HOME_DEFAULTS } from "@/pages/home/constants/home.constants";
export function useHomeTimeline(desktop: boolean) {
  const [timelineVisible, setTimelineVisible] = useState(HOME_DEFAULTS.timelineVisible);
  const [drawerOpen, setDrawerOpen] = useState(HOME_DEFAULTS.drawerOpen);
  const [expanded, setExpanded] = useState(HOME_DEFAULTS.expanded);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);
  const resetExpanded = useCallback(() => setExpanded(false), []);
  const toggleExpanded = useCallback(() => setExpanded((value) => !value), []);
  const toggleTimeline = useCallback(() => {
    if (desktop) setTimelineVisible((value) => !value);
    else setDrawerOpen((value) => !value);
  }, [desktop]);
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
