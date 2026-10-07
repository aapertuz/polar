import { Icon } from "@/components/ui/Icon";
import { useMissionSwitcher } from "@/features/missions/hooks/useMissionSwitcher";
import { MissionCard } from "@/features/missions/components/MissionCard";
import type { OverlayRequest } from "@/components/ui/overlay.types";

export function MissionSwitcher({
  selected,
  select,
  open,
}: {
  selected: string;
  select: (id: string, instant?: boolean) => void;
  open: (request: OverlayRequest) => void;
}) {
  const { missions, handleAddMission, handleMissionClick, handleCompactSelect } =
    useMissionSwitcher(selected, select, open);
  return (
    <aside className="mission-switcher" aria-label="Missions">
      <div className="switcher-heading">
        <h2>
          Missions <span>{missions.length}</span>
        </h2>
        <button
          className="icon-button"
          aria-label="Add mission"
          title="Add mission"
          onClick={handleAddMission}
        >
          <Icon name="plus" />
        </button>
      </div>
      <div className="mission-cards">
        {missions.map((mission) => (
          <MissionCard
            key={mission.id}
            mission={mission}
            selected={selected === mission.id}
            onClick={handleMissionClick}
          />
        ))}
      </div>
      <label className="compact-switcher">
        <span className="sr-only">Active mission</span>
        <select value={selected} onChange={handleCompactSelect}>
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
