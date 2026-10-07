import { DEFAULT_MISSION_TAB } from "@/features/missions/constants/mission.constants";
export const HOME_DEFAULTS = {
  tab: DEFAULT_MISSION_TAB,
  instant: false,
  timelineVisible: true,
  drawerOpen: false,
  expanded: false,
};
export const DESKTOP_QUERY = "(min-width: 1180px)";
export const HOME_MOTION = { ease: [0.2, 0.8, 0.2, 1] as const, duration: 0.22 };

export const EMPTY_TIMELINE = { upcoming: [], activity: [] };
