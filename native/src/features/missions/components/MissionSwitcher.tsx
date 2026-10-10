import type { Mission } from "@/features/missions/types/mission.types";
import type { WorkspaceSummary } from "@polar/contracts";
import { Icon } from "@/components/ui/Icon";
import { useMissionSwitcher } from "@/features/missions/hooks/useMissionSwitcher";
import { MissionCard } from "@/features/missions/components/MissionCard";

export function MissionSwitcher({
  missions,
  missionLoadFailed,
  selected,
  select,
  openQuickAi,
  workspaces,
  selectedWorkspaceId,
  selectWorkspace,
  openWorkspaceSettings,
  openWorkspaceCreate,
  canCreateMission,
}: {
  missions: Mission[];
  missionLoadFailed: boolean;
  selected: string;
  select: (id: string, instant?: boolean) => void;
  openQuickAi: (trigger?: HTMLElement) => void;
  workspaces: WorkspaceSummary[];
  selectedWorkspaceId: string | null;
  selectWorkspace: (id: string) => void;
  openWorkspaceSettings: () => void;
  openWorkspaceCreate: () => void;
  canCreateMission: boolean;
}) {
  const { handleAddMission, handleMissionClick, handleCompactSelect } = useMissionSwitcher(
    missions,
    selected,
    select,
    openQuickAi,
  );
  const handleWorkspaceSelect = (event: React.ChangeEvent<HTMLSelectElement>) => {
    if (event.currentTarget.value) selectWorkspace(event.currentTarget.value);
  };
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
          disabled={!canCreateMission}
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
      {missions.length === 0 && (
        <p className="empty-mission-list" role={missionLoadFailed ? "status" : undefined}>
          {missionLoadFailed ? "Missions couldn't load." : "No missions yet."}
        </p>
      )}
      <div className="workspace-controls">
        <label className="workspace-picker-label">
          <span className="orientation-point" />
          <span className="sr-only">Current workspace</span>
          <select
            aria-label="Current workspace"
            value={selectedWorkspaceId ?? ""}
            onChange={handleWorkspaceSelect}
          >
            {workspaces.length === 0 ? (
              <option value="">No workspace selected</option>
            ) : (
              workspaces.map((workspace) => (
                <option value={workspace.id} key={workspace.id}>
                  {workspace.name} · {workspace.privacy === "private" ? "Private" : "Shared"}
                </option>
              ))
            )}
          </select>
          <Icon name="chevron" size={14} />
        </label>
        <div className="workspace-control-actions">
          <button
            className="workspace-control-button"
            onClick={openWorkspaceCreate}
            title="Create workspace"
          >
            <Icon name="plus" size={14} />
            <span>Create workspace</span>
          </button>
          <button
            className="workspace-control-button"
            onClick={openWorkspaceSettings}
            title="Workspace settings"
          >
            <Icon name="settings" size={14} />
            <span>Workspace settings</span>
          </button>
        </div>
      </div>
    </aside>
  );
}
