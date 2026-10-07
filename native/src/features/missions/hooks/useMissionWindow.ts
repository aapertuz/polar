import { useLayoutEffect, useRef } from "react";
import { useReducedMotion } from "motion/react";
import { useMissionTabs } from "@/features/missions/hooks/useMissionTabs";
import type { MissionTab } from "@/features/missions/types/mission.types";
export function useMissionWindow(
  missionId: string,
  selectTab: (tab: MissionTab, instant?: boolean) => void,
) {
  const scrollRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [missionId]);
  const tabs = useMissionTabs(selectTab);
  const reduced = useReducedMotion();
  return { scrollRef, reduced, ...tabs };
}
