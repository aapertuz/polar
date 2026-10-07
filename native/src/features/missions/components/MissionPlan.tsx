import { Icon } from "@/components/ui/Icon";
import type { Mission } from "@/features/missions/types/mission.types";

export function MissionPlan({ mission }: { mission: Mission }) {
  return (
    <div className="plan-view">
      <div className="section-intro">
        <h2>The route to {mission.name}</h2>
        <p>Meaningful checkpoints, from where we are to the outcome.</p>
      </div>
      <ol className="checkpoint-list">
        {mission.checkpoints.map((checkpoint, index) => (
          <li
            key={checkpoint.name}
            className={
              checkpoint.status === "Complete"
                ? "complete"
                : checkpoint.status === "In progress"
                  ? "current"
                  : ""
            }
          >
            <span className="checkpoint-marker" aria-hidden="true">
              {checkpoint.status === "Complete" ? (
                <Icon name="check" size={14} />
              ) : (
                String(index + 1).padStart(2, "0")
              )}
            </span>
            <div>
              <h3>{checkpoint.name}</h3>
              <p>{checkpoint.detail}</p>
              <span className="checkpoint-status">{checkpoint.status}</span>
            </div>
            <time>{checkpoint.date}</time>
          </li>
        ))}
      </ol>
      <p className="dependency-note">
        <Icon name="arrow" size={16} />
        Later checkpoints build on the evidence collected in the current phase.
      </p>
    </div>
  );
}
