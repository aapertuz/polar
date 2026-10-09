import { MissionEvidenceRow } from "@/features/missions/components/MissionEvidenceRow";
import type { OverlayRequest } from "@/components/ui/overlay.types";
import type { Mission } from "@/features/missions/types/mission.types";
import { useMissionContext } from "@/features/missions/hooks/useMissionContext";

export function MissionContext({
  mission,
  open,
}: {
  mission: Mission;
  open: (request: OverlayRequest) => void;
}) {
  const { handleEvidenceClick, workspaceSources, missionSources } = useMissionContext(
    mission,
    open,
  );
  return (
    <div className="context-view">
      <section>
        <h2>Mission brief</h2>
        <p>{mission.outcome}</p>
      </section>
      <section>
        <h2>Constraints</h2>
        <p>{mission.constraint}</p>
      </section>
      {mission.people.length > 0 && (
        <section>
          <h2>People</h2>
          <div className="context-people">
            {mission.people.map((person) => (
              <div key={person.name}>
                <span className="avatar">{person.initials}</span>
                <div>
                  <strong>{person.name}</strong>
                  <span>{person.role}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
      <section>
        <h2>Workspace sources</h2>
        {workspaceSources.length ? (
          <div className="evidence-list">
            {workspaceSources.map((item) => (
              <MissionEvidenceRow
                key={item.title}
                item={item}
                index={mission.evidence.indexOf(item)}
                onClick={handleEvidenceClick}
              />
            ))}
          </div>
        ) : (
          <p>No workspace sources were included in this mission's reasoning.</p>
        )}
      </section>
      <section>
        <h2>Mission attachments</h2>
        {missionSources.length ? (
          <div className="evidence-list">
            {missionSources.map((item) => (
              <MissionEvidenceRow
                key={item.id ?? item.title}
                item={item}
                index={mission.evidence.indexOf(item)}
                onClick={handleEvidenceClick}
              />
            ))}
          </div>
        ) : (
          <p>No mission-only attachments were used.</p>
        )}
      </section>
    </div>
  );
}
