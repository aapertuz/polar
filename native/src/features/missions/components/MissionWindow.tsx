import { AnimatePresence } from "motion/react";
import type { ReactNode } from "react";
import { AnimatedContent } from "@/components/ui/AnimatedContent";
import { MISSION_TABS } from "@/features/missions/constants/mission.constants";
import { useMissionWindow } from "@/features/missions/hooks/useMissionWindow";
import { MissionOverview } from "@/features/missions/components/MissionOverview";
import { MissionPlan } from "@/features/missions/components/MissionPlan";
import { MissionContext } from "@/features/missions/components/MissionContext";
import { MissionHero } from "@/features/missions/components/MissionHero";
import { MissionTabButton } from "@/features/missions/components/MissionTabButton";
import type { OverlayRequest } from "@/components/ui/overlay.types";
import type { Mission, MissionTab } from "@/features/missions/types/mission.types";

const tabs = MISSION_TABS;
function MissionPlanTab({
  mission,
}: {
  mission: Mission;
  open: (request: OverlayRequest) => void;
}) {
  return <MissionPlan mission={mission} />;
}
const tabComponents: Record<
  MissionTab,
  (props: { mission: Mission; open: (request: OverlayRequest) => void }) => ReactNode
> = {
  Overview: MissionOverview,
  Plan: MissionPlanTab,
  Context: MissionContext,
};
export function MissionWindow({
  mission,
  tab,
  selectTab,
  open,
  instant,
}: {
  mission: Mission;
  tab: MissionTab;
  selectTab: (tab: MissionTab, instant?: boolean) => void;
  open: (request: OverlayRequest) => void;
  instant: boolean;
}) {
  const { scrollRef, reduced, handleTabClick, handleTabKeyDown } = useMissionWindow(
    mission.id,
    selectTab,
  );
  const SelectedTab = tabComponents[tab];
  return (
    <div className="mission-scroll" ref={scrollRef}>
      <MissionHero mission={mission} />
      <div className="mission-tabs" role="tablist" aria-label="Mission views">
        {tabs.map((item, index) => (
          <MissionTabButton
            key={item}
            tab={item}
            index={index}
            selected={tab === item}
            instant={instant}
            reduced={!!reduced}
            onClick={handleTabClick}
            onKeyDown={handleTabKeyDown}
          />
        ))}
      </div>
      <div
        id="mission-panel"
        role="tabpanel"
        aria-labelledby={`tab-${tab}`}
        tabIndex={0}
        className="mission-panel"
      >
        <AnimatePresence initial={false} mode="wait">
          <AnimatedContent key={`${mission.id}-${tab}`} instant={instant}>
            <SelectedTab mission={mission} open={open} />
          </AnimatedContent>
        </AnimatePresence>
      </div>
    </div>
  );
}
