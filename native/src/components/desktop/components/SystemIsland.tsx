import { Icon } from "@/components/ui/Icon";
import { PolarMark } from "@/components/ui/PolarMark";
import type { OverlayRequest } from "@/components/ui/overlay.types";
import { useSystemIsland } from "@/components/desktop/hooks/useSystemIsland";

interface Props {
  open: (request: OverlayRequest) => void;
  openQuickAi: (trigger?: HTMLElement) => void;
  quickAiOpen: boolean;
  demo?: boolean;
}

export function SystemIsland({ open, openQuickAi, quickAiOpen, demo = false }: Props) {
  const { time, handleQuickAi, openNotifications, openPeople, openLauncher } = useSystemIsland(
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
      <button
        className="island-button"
        aria-label="Mission people"
        title="People"
        onClick={openPeople}
        disabled={quickAiOpen}
      >
        <Icon name="people" size={18} />
        <span>{demo ? 2 : 0}</span>
      </button>
      <span className="island-clock" aria-label={`Current time: ${time}`}>
        {time}
      </span>
      <button
        className="island-button notification-button"
        aria-label={demo ? "Sample notifications, 1 needs attention" : "Notifications, none"}
        title="Notifications"
        onClick={openNotifications}
        disabled={quickAiOpen}
      >
        <Icon name="bell" size={18} />
        {demo && <span className="notification-count">1</span>}
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
