import { missions } from "@/features/missions/fixtures/missions.fixtures";
import { MissionChoiceRow } from "@/pages/home/components/overlays/MissionChoiceRow";
import type { OverlayRequest } from "@/components/ui/overlay.types";
import type { Mission } from "@/features/missions/types/mission.types";
interface Props {
  request: OverlayRequest;
  mission: Mission;
  close: () => void;
  select: (id: string, instant?: boolean) => void;
  reset: () => void;
  timelineVisible: boolean;
  toggleTimeline: () => void;
  open: (request: OverlayRequest) => void;
  choose: (id: string) => void;
}
export function LauncherOverlay({ choose }: Props) {
  const handleChoose = (event: React.MouseEvent<HTMLButtonElement>) =>
    choose(event.currentTarget.dataset.missionId!);
  return (
    <>
      <p className="overlay-muted">Three missions. One place to stay oriented.</p>
      <div className="overlay-list">
        {missions.map((mission) => (
          <MissionChoiceRow
            key={mission.id}
            missionId={mission.id}
            title={mission.name}
            detail={`${mission.progress}% complete`}
            onChoose={handleChoose}
          />
        ))}
      </div>
    </>
  );
}
