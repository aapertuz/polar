import { completedCheckpoints } from "@/features/missions/utils/missionProgress";
import type { Mission } from "@/features/missions/types/mission.types";
import type { OverlayRequest } from "@/components/ui/overlay.types";
export function useMissionOverview(mission: Mission, open: (request: OverlayRequest) => void) {
  const completed = completedCheckpoints(mission);
  const checkpointProgress = (completed / mission.checkpoints.length) * 100;
  const handleApplyPlan = (event: React.MouseEvent<HTMLButtonElement>) =>
    open({ kind: "proposal", anchor: event.currentTarget, instant: event.detail === 0 });
  return { completed, checkpointProgress, handleApplyPlan };
}
