import { Icon } from "../../../components/ui/Icon";
import { ProgressRing } from "../../../components/ui/ProgressRing";
import { missions } from "../fixtures/missions.fixtures";
import type { OverlayRequest } from "../../../components/ui/overlay.types";

export function MissionSwitcher({
  selected,
  select,
  open,
}: {
  selected: string;
  select: (id: string, instant?: boolean) => void;
  open: (request: OverlayRequest) => void;
}) {
  return (
    <aside className="mission-switcher" aria-label="Missions">
      <div className="switcher-heading">
        <h2>
          Missions <span>3</span>
        </h2>
        <button
          className="icon-button"
          aria-label="Add mission"
          title="Add mission"
          onClick={(e) =>
            open({ kind: "create", anchor: e.currentTarget, instant: e.detail === 0 })
          }
        >
          <Icon name="plus" />
        </button>
      </div>
      <div className="mission-cards">
        {missions.map((mission) => (
          <button
            key={mission.id}
            className={`mission-card ${selected === mission.id ? "selected" : ""}`}
            aria-pressed={selected === mission.id}
            onClick={(e) => select(mission.id, e.detail === 0)}
          >
            <span className="mission-marker" />
            <span className="mission-card-copy">
              <strong>{mission.name}</strong>
              <span>{mission.outcome}</span>
            </span>
            <ProgressRing value={mission.progress} />
            <span className="mission-card-date">
              <Icon name="calendar" size={16} />
              {mission.deadline}
              <span>·</span>
              {mission.days} days left
            </span>
          </button>
        ))}
      </div>
      <label className="compact-switcher">
        <span className="sr-only">Active mission</span>
        <select value={selected} onChange={(e) => select(e.target.value, true)}>
          {missions.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
        <Icon name="chevron" size={16} />
      </label>
      <div className="workspace-caption">
        <span className="orientation-point" /> PERSONAL WORKSPACE
      </div>
    </aside>
  );
}
