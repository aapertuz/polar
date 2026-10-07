import type { Mission } from "@/features/missions/types/mission.types";
import { Icon } from "@/components/ui/Icon";
import { useMissionSwitcher } from "@/features/missions/hooks/useMissionSwitcher";
import { MissionCard } from "@/features/missions/components/MissionCard";

export function MissionSwitcher({
  missions,
  selected,
  select,
  openQuickAi,
}: {
  missions: Mission[];
  selected: string;
  select: (id: string, instant?: boolean) => void;
  openQuickAi: (trigger?: HTMLElement) => void;
}) {
  const { handleAddMission, handleMissionClick, handleCompactSelect } = useMissionSwitcher(
    missions,
    selected,
    select,
    openQuickAi,
  );
  return (
    <aside className="mission-switcher" aria-label="Missions">
      <div className="switcher-heading">
        <h2>
          Missions <span>{missions.length}</span>
        </h2>
        <button
          className="icon-button"
          aria-label="New mission"
          title="New mission"
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
      {missions.length > 0 && (
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
      )}
      {missions.length === 0 && <p className="empty-mission-list">No missions yet.</p>}
      <div className="workspace-caption">
        <span className="orientation-point" /> PERSONAL WORKSPACE
      </div>
    </aside>
  );
}
