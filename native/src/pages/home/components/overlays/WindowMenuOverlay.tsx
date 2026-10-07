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
export function WindowMenuOverlay({ close, reset, timelineVisible, toggleTimeline }: Props) {
  const handleReset = () => {
    reset();
    close();
  };
  const handleToggleTimeline = () => {
    toggleTimeline();
    close();
  };
  return (
    <div className="window-menu">
      <button onClick={handleReset}>
        <Icon name="reset" size={18} />
        Reset layout
      </button>
      <button onClick={handleToggleTimeline}>
        <Icon name="clock" size={18} />
        {timelineVisible ? "Hide timeline" : "Show timeline"}
      </button>
      <p className="demo-note">Drag the window header to arrange your workspace.</p>
    </div>
  );
}
