import { Icon } from "@/components/ui/Icon";
import { ProgressRing } from "@/components/ui/ProgressRing";
import type { Mission } from "@/features/missions/types/mission.types";
export function MissionCard({
  mission,
  selected,
  onClick,
}: {
  mission: Mission;
  selected: boolean;
  onClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
}) {
  return (
    <button
      className={`mission-card ${selected ? "selected" : ""}`}
      aria-pressed={selected}
      data-mission-id={mission.id}
      onClick={onClick}
    >
      <span className="mission-marker" />
      <span className="mission-card-copy">
        <strong>{mission.name}</strong>
        <span>{mission.outcome}</span>
      </span>
      <ProgressRing value={mission.progress} />
      <span className="mission-card-date">
        <Icon name="calendar" size={16} />
        {mission.deadline}
        <span>·</span>
        {mission.days} days left
      </span>
    </button>
  );
}
