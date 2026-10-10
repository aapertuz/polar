import { useState } from "react";

import { HOME_DEFAULTS } from "@/pages/home/constants/home.constants";
import type { Mission, MissionTab } from "@/features/missions/types/mission.types";
export function useMissionSelection(
  resetExpanded: () => void,
  missions: Mission[],
  scopeKey: string | null,
) {
  const [selection, setSelection] = useState<{ scopeKey: string | null; id: string | null }>({
    scopeKey,
    id: null,
  });
  const [tab, setTab] = useState<MissionTab>(HOME_DEFAULTS.tab);
  const [instant, setInstant] = useState(HOME_DEFAULTS.instant);
  const selected =
    selection.scopeKey === scopeKey &&
    selection.id &&
    missions.some((item) => item.id === selection.id)
      ? selection.id
      : (missions[0]?.id ?? "");
  const mission = missions.find((item) => item.id === selected) ?? missions[0] ?? null;
  const select = (id: string, immediate = false) => {
    if (!missions.some((item) => item.id === id)) return;
    setSelection({ scopeKey, id });
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
