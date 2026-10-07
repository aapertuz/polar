import { motion } from "motion/react";
import { MOTION_TIMINGS } from "@/components/ui/motionPolicy";
import type { MissionTab } from "@/features/missions/types/mission.types";
export function MissionTabButton({
  tab,
  index,
  selected,
  instant,
  reduced,
  onClick,
  onKeyDown,
}: {
  tab: MissionTab;
  index: number;
  selected: boolean;
  instant: boolean;
  reduced: boolean;
  onClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
  onKeyDown: (event: React.KeyboardEvent<HTMLButtonElement>) => void;
}) {
  return (
    <button
      data-tab-index={index}
      id={`tab-${tab}`}
      aria-controls="mission-panel"
      role="tab"
      aria-selected={selected}
      tabIndex={selected ? 0 : -1}
      onClick={onClick}
      onKeyDown={onKeyDown}
      className={selected ? "active" : ""}
    >
      {selected && (
        <motion.span
          className="tab-indicator"
          layoutId="mission-tab"
          transition={{ duration: instant || reduced ? 0 : MOTION_TIMINGS.tabIndicator }}
        />
      )}
      <span>{tab}</span>
    </button>
  );
}
