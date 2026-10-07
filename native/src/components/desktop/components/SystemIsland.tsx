import { Icon } from "@/components/ui/Icon";
import { PolarMark } from "@/components/ui/PolarMark";
import type { OverlayRequest } from "@/components/ui/overlay.types";
import { useSystemIsland } from "@/components/desktop/hooks/useSystemIsland";

export function SystemIsland({ open }: { open: (request: OverlayRequest) => void }) {
  const { openNotifications, openPeople, openLauncher } = useSystemIsland(open);
  return (
    <div className="system-island" aria-label="Polar system status">
      <span className="island-mark">
        <PolarMark size={19} />
      </span>
      <span className="sample-weather" aria-label="Sample weather: sunny, 28 degrees">
        <Icon name="sun" size={19} />
        28°
      </span>
      <span className="island-clock" aria-label="Sample time: 15:24">
        15:24
      </span>
      <button
        className="island-button notification-button"
        aria-label="Notifications, 1 needs attention"
        title="Notifications"
        onClick={openNotifications}
      >
        <Icon name="bell" size={18} />
        <span className="notification-count">1</span>
      </button>
      <button
        className="island-button"
        aria-label="Mission people"
        title="People"
        onClick={openPeople}
      >
        <Icon name="people" size={18} />
        <span>2</span>
      </button>
      <button
        className="island-button"
        aria-label="Open launcher"
        title="Launcher"
        onClick={openLauncher}
      >
        <Icon name="grid" size={18} />
      </button>
    </div>
  );
}
