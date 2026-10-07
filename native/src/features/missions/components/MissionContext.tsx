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
  const { handleEvidenceClick } = useMissionContext(mission, open);
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
      <section>
        <h2>Evidence & context</h2>
        <div className="evidence-list">
          {mission.evidence.map((item, index) => (
            <MissionEvidenceRow
              key={item.title}
              item={item}
              index={index}
              onClick={handleEvidenceClick}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
