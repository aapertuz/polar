import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useLayoutEffect, useRef } from "react";
import { Icon } from "../../../components/ui/Icon";
import { ProgressRing } from "../../../components/ui/ProgressRing";
import { AnimatedContent } from "../../../components/ui/AnimatedContent";
import { completedCheckpoints } from "../utils/missionProgress";
import { MissionOverview } from "./MissionOverview";
import { MissionPlan } from "./MissionPlan";
import { MissionContext } from "./MissionContext";
import type { OverlayRequest } from "../../../components/ui/overlay.types";
import type { Mission, MissionTab } from "../types/mission.types";

const tabs: MissionTab[] = ["Overview", "Plan", "Context"];
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
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [mission.id]);
  const reduced = useReducedMotion();
  return (
    <div className="mission-scroll" ref={scrollRef}>
      <div className="mission-hero">
        <div>
          <span className="mission-eyebrow">
            MISSION / {mission.id === "pilot" ? "001" : mission.id === "sales" ? "002" : "003"}
          </span>
          <h1>{mission.name}</h1>
          <p>{mission.outcome}</p>
        </div>
        <div
          className="deadline-display"
          role="img"
          aria-label={`Sample countdown: ${mission.days} days, zero hours, 35 minutes`}
        >
          <div className="countdown-labels">
            <span>DAYS</span>
            <span>HOURS</span>
            <span>MINUTES</span>
          </div>
          <div className="countdown-digits" aria-hidden="true">
            <span>{mission.days}</span>
            <b>:</b>
            <span>00</span>
            <b>:</b>
            <span>35</span>
          </div>
        </div>
      </div>
      <div className="mission-facts">
        <div>
          <Icon name="calendar" size={29} />
          <span>
            <strong>{mission.deadline}</strong>
            <span>Mission deadline</span>
          </span>
        </div>
        <div>
          <Icon name="people" size={30} />
          <span>
            <strong>
              {mission.units.received} / {mission.units.target}
            </strong>
            <span>{mission.units.label}</span>
          </span>
        </div>
        <div>
          <ProgressRing
            value={(completedCheckpoints(mission) / mission.checkpoints.length) * 100}
            size={42}
            label={false}
          />
          <span>
            <strong>
              {completedCheckpoints(mission)} / {mission.checkpoints.length}
            </strong>
            <span>key checkpoints</span>
          </span>
        </div>
      </div>
      <div className="mission-tabs" role="tablist" aria-label="Mission views">
        {tabs.map((item, index) => (
          <button
            key={item}
            ref={(node) => {
              tabRefs.current[index] = node;
            }}
            id={`tab-${item}`}
            aria-controls="mission-panel"
            role="tab"
            aria-selected={tab === item}
            tabIndex={tab === item ? 0 : -1}
            onClick={(e) => selectTab(item, e.detail === 0)}
            onKeyDown={(e) => {
              let target = index;
              if (e.key === "ArrowRight") target = (index + 1) % 3;
              else if (e.key === "ArrowLeft") target = (index + 2) % 3;
              else if (e.key === "Home") target = 0;
              else if (e.key === "End") target = 2;
              else return;
              e.preventDefault();
              selectTab(tabs[target], true);
              tabRefs.current[target]?.focus();
            }}
            className={tab === item ? "active" : ""}
          >
            {tab === item && (
              <motion.span
                className="tab-indicator"
                layoutId="mission-tab"
                transition={{ duration: instant || reduced ? 0 : 0.16 }}
              />
            )}
            <span>{item}</span>
          </button>
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
            {tab === "Overview" ? (
              <MissionOverview mission={mission} open={open} />
            ) : tab === "Plan" ? (
              <MissionPlan mission={mission} />
            ) : (
              <MissionContext mission={mission} open={open} />
            )}
          </AnimatedContent>
        </AnimatePresence>
      </div>
    </div>
  );
}
