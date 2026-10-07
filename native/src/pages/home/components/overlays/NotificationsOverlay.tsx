import { Icon } from "@/components/ui/Icon";
import type { OverlayRequest } from "@/components/ui/overlay.types";
import type { Mission } from "@/features/missions/types/mission.types";
import { SAMPLE_NOTIFICATION } from "@/pages/home/fixtures/home-preview.fixtures";
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
export function NotificationsOverlay({ choose }: Props) {
  const handleChoose = () => choose(SAMPLE_NOTIFICATION.missionId);
  return (
    <>
      <div className="notification-preview">
        <span className="orientation-point" />
        <div>
          <h3>{SAMPLE_NOTIFICATION.title}</h3>
          <p className="overlay-muted">{SAMPLE_NOTIFICATION.detail}</p>
        </div>
      </div>
      <button className="dark-button" onClick={handleChoose}>
        {SAMPLE_NOTIFICATION.action}
        <Icon name="arrow" size={18} />
      </button>
    </>
  );
}
