import { Icon } from "@/components/ui/Icon";
import { useMissionCountdown } from "@/features/missions/hooks/useMissionCountdown";
import type { Mission } from "@/features/missions/types/mission.types";
export function MissionHero({ mission }: { mission: Mission }) {
  const countdown = useMissionCountdown(mission.deadlineAt);
  return (
    <div className="mission-hero">
      <div
        className="deadline-display"
        role="img"
        aria-label={
          countdown
            ? countdown.expired
              ? "Deadline reached"
              : `${countdown.days} days, ${countdown.hours} hours, ${countdown.minutes} minutes remaining`
            : "No deadline set"
        }
      >
        <div className="countdown-labels">
          <span>DAYS</span>
          <span>HOURS</span>
          <span>MINUTES</span>
        </div>
        <div className="countdown-digits" aria-hidden="true">
          <span>{countdown ? String(countdown.days).padStart(2, "0") : "—"}</span>
          <b>:</b>
          <span>{countdown ? String(countdown.hours).padStart(2, "0") : "—"}</span>
          <b>:</b>
          <span>{countdown ? String(countdown.minutes).padStart(2, "0") : "—"}</span>
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
          <time dateTime={mission.deadlineAt}>
            {countdown?.expired ? "Deadline reached · " : ""}
            {mission.deadline}
          </time>
        </span>
      </div>
    </div>
  );
}
