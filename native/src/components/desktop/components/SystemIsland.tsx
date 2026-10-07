import { Icon } from "@/components/ui/Icon";
import { PolarMark } from "@/components/ui/PolarMark";
import type { OverlayRequest } from "@/components/ui/overlay.types";
import { useSystemIsland } from "@/components/desktop/hooks/useSystemIsland";

interface Props {
  open: (request: OverlayRequest) => void;
  openQuickAi: (trigger?: HTMLElement) => void;
  quickAiOpen: boolean;
}

export function SystemIsland({ open, openQuickAi, quickAiOpen }: Props) {
  const { handleQuickAi, openNotifications, openPeople, openLauncher } = useSystemIsland(
    open,
    openQuickAi,
  );
  return (
    <div
      className={`system-island ${quickAiOpen ? "quick-ai-island-open" : ""}`}
      aria-label="Polar system status"
    >
      <button
        className="island-mark-button"
        type="button"
        aria-label="Open Quick AI"
        aria-haspopup="dialog"
        aria-expanded={quickAiOpen}
        onClick={handleQuickAi}
      >
        <span className="island-mark" aria-hidden="true">
          <PolarMark size={19} />
        </span>
      </button>
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
        disabled={quickAiOpen}
      >
        <Icon name="bell" size={18} />
        <span className="notification-count">1</span>
      </button>
      <button
        className="island-button"
        aria-label="Mission people"
        title="People"
        onClick={openPeople}
        disabled={quickAiOpen}
      >
        <Icon name="people" size={18} />
        <span>2</span>
      </button>
      <button
        className="island-button"
        aria-label="Open launcher"
        title="Launcher"
        onClick={openLauncher}
        disabled={quickAiOpen}
      >
        <Icon name="grid" size={18} />
      </button>
    </div>
  );
}
