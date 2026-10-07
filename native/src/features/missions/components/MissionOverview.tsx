import { Icon } from "@/components/ui/Icon";
import { useMissionOverview } from "@/features/missions/hooks/useMissionOverview";
import type { OverlayRequest } from "@/components/ui/overlay.types";
import type { Mission } from "@/features/missions/types/mission.types";

export function MissionOverview({
  mission,
  open,
}: {
  mission: Mission;
  open: (request: OverlayRequest) => void;
}) {
  const { completed, checkpointProgress, handleApplyPlan } = useMissionOverview(mission, open);
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
        <button className="primary-button" onClick={handleApplyPlan}>
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
            <span style={{ width: `${checkpointProgress}%` }} />
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
