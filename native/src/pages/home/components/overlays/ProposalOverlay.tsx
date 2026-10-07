import { Icon } from "@/components/ui/Icon";
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
export function ProposalOverlay({ mission, close }: Props) {
  return (
    <>
      <p className="overlay-muted">{mission.name} · proposed adjustment</p>
      <div className="proposal-section">
        <span>CURRENT ASSESSMENT</span>
        <p>{mission.assessment}</p>
      </div>
      <div className="proposal-section proposed">
        <span>PROPOSED APPROACH</span>
        <p>{mission.proposedChange}</p>
      </div>
      <p className="demo-note">Preview only. This does not change the execution plan.</p>
      <button className="dark-button" onClick={close}>
        Close preview
        <Icon name="check" size={18} />
      </button>
    </>
  );
}
