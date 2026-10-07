import { useState } from "react";
import { missions } from "@/features/missions/fixtures/missions.fixtures";
import { HOME_DEFAULTS } from "@/pages/home/constants/home.constants";
import type { MissionTab } from "@/features/missions/types/mission.types";
export function useMissionSelection(resetExpanded: () => void) {
  const [selected, setSelected] = useState<string>(HOME_DEFAULTS.selected);
  const [tab, setTab] = useState<MissionTab>(HOME_DEFAULTS.tab);
  const [instant, setInstant] = useState(HOME_DEFAULTS.instant);
  const mission = missions.find((item) => item.id === selected) ?? missions[0];
  const select = (id: string, immediate = false) => {
    if (!missions.some((item) => item.id === id)) return;
    setSelected(id);
    setTab(HOME_DEFAULTS.tab);
    setInstant(immediate);
    resetExpanded();
  };
  const selectTab = (next: MissionTab, immediate = false) => {
    setTab(next);
    setInstant(immediate);
  };
  return { selected, tab, instant, mission, select, selectTab };
}
