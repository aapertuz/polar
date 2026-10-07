import { missions } from "@/features/missions/fixtures/missions.fixtures";
import { MissionChoiceRow } from "@/pages/home/components/overlays/MissionChoiceRow";
import { Icon } from "@/components/ui/Icon";
import { useLauncherOverlay } from "@/pages/home/hooks/useLauncherOverlay";
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
export function LauncherOverlay({ request, choose, open }: Props) {
  const { handleChoose, openSettings } = useLauncherOverlay(request, choose, open);
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
      <div className="window-menu">
        <button onClick={openSettings}>
          <Icon name="settings" size={18} />
          Settings
        </button>
      </div>
    </>
  );
}
