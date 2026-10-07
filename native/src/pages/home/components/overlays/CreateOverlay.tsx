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
export function CreateOverlay({ close }: Props) {
  return (
    <>
      <p className="overlay-muted">Start with an outcome. The plan follows.</p>
      <div className="creation-preview">
        <span>MISSION OUTCOME</span>
        <p>What do you want to make happen?</p>
        <span>SUCCESS CRITERIA</span>
        <p>What would tell you it worked?</p>
        <span>CONTEXT</span>
        <p>The people, constraints, and evidence that matter.</p>
      </div>
      <p className="demo-note">This is a UI preview. Mission creation is not connected yet.</p>
      <button className="dark-button" onClick={close}>
        Close preview
        <Icon name="check" size={18} />
      </button>
    </>
  );
}
