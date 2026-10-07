import type { Mission } from "@/features/missions/types/mission.types";
export function useMissionSwitcher(
  missions: Mission[],
  selected: string,
  select: (id: string, instant?: boolean) => void,
  openQuickAi: (trigger?: HTMLElement) => void,
) {
  const handleAddMission = (event: React.MouseEvent<HTMLButtonElement>) =>
    openQuickAi(event.currentTarget);
  const handleMissionClick = (event: React.MouseEvent<HTMLButtonElement>) =>
    select(event.currentTarget.dataset.missionId!, event.detail === 0);
  const handleCompactSelect = (event: React.ChangeEvent<HTMLSelectElement>) =>
    select(event.target.value, true);
  return { missions, selected, handleAddMission, handleMissionClick, handleCompactSelect };
}
