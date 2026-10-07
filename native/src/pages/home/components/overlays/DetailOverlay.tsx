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
export function DetailOverlay({ mission, request }: Props) {
  return (
    <>
      <p className="detail-copy">{request.detail}</p>
      <p className="demo-note">Sample mission context · {mission.name}</p>
    </>
  );
}
