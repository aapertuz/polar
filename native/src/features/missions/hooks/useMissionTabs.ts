import { useCallback } from "react";
import { MISSION_TABS } from "@/features/missions/constants/mission.constants";
import type { MissionTab } from "@/features/missions/types/mission.types";
export function useMissionTabs(selectTab: (tab: MissionTab, instant?: boolean) => void) {
  const handleTabClick = (event: React.MouseEvent<HTMLButtonElement>) =>
    selectTab(MISSION_TABS[Number(event.currentTarget.dataset.tabIndex)], event.detail === 0);
  const handleTabKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLButtonElement>) => {
      const index = Number(event.currentTarget.dataset.tabIndex);
      let target = index;
      if (event.key === "ArrowRight") target = (index + 1) % MISSION_TABS.length;
      else if (event.key === "ArrowLeft")
        target = (index + MISSION_TABS.length - 1) % MISSION_TABS.length;
      else if (event.key === "Home") target = 0;
      else if (event.key === "End") target = MISSION_TABS.length - 1;
      else return;
      event.preventDefault();
      selectTab(MISSION_TABS[target], true);
      event.currentTarget.parentElement
        ?.querySelectorAll<HTMLButtonElement>("button")
        [target]?.focus();
    },
    [selectTab],
  );
  return { handleTabClick, handleTabKeyDown };
}
