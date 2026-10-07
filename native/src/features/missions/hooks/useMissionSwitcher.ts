import { missions } from "@/features/missions/fixtures/missions.fixtures";
import type { OverlayRequest } from "@/components/ui/overlay.types";
export function useMissionSwitcher(
  selected: string,
  select: (id: string, instant?: boolean) => void,
  open: (request: OverlayRequest) => void,
) {
  const handleAddMission = (event: React.MouseEvent<HTMLButtonElement>) =>
    open({ kind: "create", anchor: event.currentTarget, instant: event.detail === 0 });
  const handleMissionClick = (event: React.MouseEvent<HTMLButtonElement>) =>
    select(event.currentTarget.dataset.missionId!, event.detail === 0);
  const handleCompactSelect = (event: React.ChangeEvent<HTMLSelectElement>) =>
    select(event.target.value, true);
  return { missions, selected, handleAddMission, handleMissionClick, handleCompactSelect };
}
