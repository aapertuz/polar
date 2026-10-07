import { Icon } from "../../../components/ui/Icon";
import { completedCheckpoints } from "../utils/missionProgress";
import type { OverlayRequest } from "../../../components/ui/overlay.types";
import type { Mission } from "../types/mission.types";

export function MissionOverview({
  mission,
  open,
}: {
  mission: Mission;
  open: (request: OverlayRequest) => void;
}) {
  const completed = completedCheckpoints(mission);
  return (
    <div className="overview">
      <div className="contextual-insight">
        <span className="insight-symbol" aria-hidden="true">
          !
        </span>
        <div className="insight-copy">
          <p>{mission.assessment}</p>
          <strong>{mission.recommendation}</strong>
        </div>
        <button
          className="primary-button"
          onClick={(e) =>
            open({ kind: "proposal", anchor: e.currentTarget, instant: e.detail === 0 })
          }
        >
          <Icon name="arrow" size={18} />
          Apply to plan
        </button>
      </div>
      <div className="summary-strip">
        <div>
          <strong>{mission.progress}%</strong>
          <span>overall progress</span>
          <div className="metric-track">
            <span style={{ width: `${mission.progress}%` }} />
          </div>
        </div>
        <div>
          <strong>
            {completed} / {mission.checkpoints.length}
          </strong>
          <span>checkpoints</span>
          <div className="metric-track">
            <span style={{ width: `${(completed / mission.checkpoints.length) * 100}%` }} />
          </div>
        </div>
        <div>
          <strong>{mission.actionCount}</strong>
          <span>supporting actions</span>
          <div className="summary-caption">In the execution plan</div>
        </div>
      </div>
    </div>
  );
}
