import type { Mission } from "@/features/missions/types/mission.types";

export function MissionOverview({ mission }: { mission: Mission }) {
  const completed = mission.checkpoints.filter(
    (checkpoint) => checkpoint.status === "Complete",
  ).length;
  return (
    <div className="overview">
      <div className="contextual-insight">
        <span className="insight-symbol" aria-hidden="true">
          !
        </span>
        <div className="insight-copy">
          <strong>{mission.recommendation}</strong>
          <p>{mission.assessment}</p>
        </div>
      </div>
      <div className="summary-strip">
        <div>
          <strong>
            {completed} / {mission.checkpoints.length}
          </strong>
          <span>checkpoints</span>
        </div>
        <div>
          <strong>{mission.actionCount}</strong>
          <span>supporting actions</span>
        </div>
        <div>
          <strong>{mission.evidence.length}</strong>
          <span>context sources</span>
        </div>
      </div>
      {mission.checkpoints.length > 0 && (
        <section className="mission-success-criteria">
          <h2>Success looks like</h2>
          <ul>
            {(mission.successCriteria ?? []).map((criterion) => (
              <li key={criterion}>{criterion}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
