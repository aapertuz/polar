import { Icon } from "@/components/ui/Icon";
import { PlanDetail } from "@/features/missions/components/PlanDetail";
import type { Mission } from "@/features/missions/types/mission.types";
import type { OverlayRequest } from "@/components/ui/overlay.types";
import { useMissionPlan } from "@/features/missions/hooks/useMissionPlan";

export function MissionPlan({
  mission,
  open,
}: {
  mission: Mission;
  open: (request: OverlayRequest) => void;
}) {
  const { handleOpenAction } = useMissionPlan(mission, open);
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
              <h3>
                Checkpoint {index + 1}:{" "}
                {checkpoint.name.replace(/^checkpoint\s+\d+\s*[:—–-]\s*/i, "")}
              </h3>
              <PlanDetail detail={checkpoint.detail} />
              <span className="checkpoint-status">{checkpoint.status}</span>
              {checkpoint.actions && checkpoint.actions.length > 0 && (
                <div className="checkpoint-work">
                  <p className="checkpoint-actions-label">Actions for this checkpoint</p>
                  <ol className="checkpoint-actions">
                    {checkpoint.actions.map((action, actionIndex) => (
                      <li key={action.title}>
                        <h4>
                          <span className="action-number">
                            Action {index + 1}.{actionIndex + 1}
                          </span>
                          {action.title}
                        </h4>
                        {action.date && (
                          <time dateTime={action.dueOn ?? undefined}>
                            Complete by {action.date}
                          </time>
                        )}
                        <PlanDetail detail={action.detail} />
                        <button
                          className="plan-action-open"
                          onClick={handleOpenAction(action.title)}
                        >
                          Open action conversation
                        </button>
                        {action.dependsOn?.length ? (
                          <div className="action-dependencies">
                            <span>Depends on</span>
                            <ul>
                              {action.dependsOn.map((dependency) => (
                                <li key={dependency}>{dependency}</li>
                              ))}
                            </ul>
                          </div>
                        ) : null}
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </div>
            {checkpoint.date && (
              <time dateTime={checkpoint.dueOn ?? undefined}>Due {checkpoint.date}</time>
            )}
          </li>
        ))}
      </ol>
      {mission.risks?.length ? (
        <section className="plan-qualifiers">
          <h3>Risks</h3>
          <ul>
            {mission.risks.map((risk) => (
              <li key={risk}>{risk}</li>
            ))}
          </ul>
        </section>
      ) : null}
      {mission.assumptions?.length ? (
        <section className="plan-qualifiers">
          <h3>Assumptions</h3>
          <ul>
            {mission.assumptions.map((assumption) => (
              <li key={assumption}>{assumption}</li>
            ))}
          </ul>
        </section>
      ) : null}
      <p className="dependency-note">
        <Icon name="arrow" size={16} />
        Later checkpoints build on the evidence collected in the current phase.
      </p>
    </div>
  );
}
