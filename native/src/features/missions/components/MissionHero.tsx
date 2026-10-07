import { Icon } from "@/components/ui/Icon";
import { SAMPLE_COUNTDOWN } from "@/features/missions/constants/mission.constants";
import type { Mission } from "@/features/missions/types/mission.types";
export function MissionHero({ mission }: { mission: Mission }) {
  return (
    <div className="mission-hero">
      <div
        className="deadline-display"
        role="img"
        aria-label={`Sample countdown: ${mission.days} days, zero hours, ${SAMPLE_COUNTDOWN.minutes} minutes`}
      >
        <div className="countdown-labels">
          <span>DAYS</span>
          <span>HOURS</span>
          <span>MINUTES</span>
        </div>
        <div className="countdown-digits" aria-hidden="true">
          <span>{mission.days}</span>
          <b>:</b>
          <span>{SAMPLE_COUNTDOWN.hours}</span>
          <b>:</b>
          <span>{SAMPLE_COUNTDOWN.minutes}</span>
        </div>
      </div>
      <div className="mission-outcome">
        <p>{mission.outcome}</p>
      </div>
      <div className="mission-deadline">
        <Icon name="calendar" size={16} />
        <span className="mission-deadline-copy">
          <span>Deadline</span>
          <span aria-hidden="true">·</span>
          <time>{mission.deadline}</time>
        </span>
      </div>
    </div>
  );
}
