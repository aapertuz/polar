import { Icon } from "../../../components/ui/Icon";
import type { OverlayRequest } from "../../../components/ui/overlay.types";
import type { Mission } from "../types/mission.types";

export function MissionContext({
  mission,
  open,
}: {
  mission: Mission;
  open: (request: OverlayRequest) => void;
}) {
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
          {mission.evidence.map((item) => (
            <button
              key={item.title}
              onClick={(e) =>
                open({
                  kind: "detail",
                  title: item.title,
                  detail: `${item.source} · ${item.date}. This sample artifact provides context for ${mission.name}.`,
                  anchor: e.currentTarget,
                  instant: e.detail === 0,
                })
              }
            >
              <Icon name="file" size={18} />
              <span>
                <strong>{item.title}</strong>
                <span>
                  {item.source} · {item.date}
                </span>
              </span>
              <Icon name="arrow" size={16} />
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
