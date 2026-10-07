import { Icon } from "../../ui/Icon";
import { PolarMark } from "../../ui/PolarMark";
import type { OverlayRequest } from "../../ui/overlay.types";

export function SystemIsland({ open }: { open: (request: OverlayRequest) => void }) {
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
        onClick={(e) =>
          open({ kind: "notifications", anchor: e.currentTarget, instant: e.detail === 0 })
        }
      >
        <Icon name="bell" size={18} />
        <span className="notification-count">1</span>
      </button>
      <button
        className="island-button"
        aria-label="Mission people"
        title="People"
        onClick={(e) => open({ kind: "people", anchor: e.currentTarget, instant: e.detail === 0 })}
      >
        <Icon name="people" size={18} />
        <span>2</span>
      </button>
      <button
        className="island-button"
        aria-label="Open launcher"
        title="Launcher"
        onClick={(e) =>
          open({ kind: "launcher", anchor: e.currentTarget, instant: e.detail === 0 })
        }
      >
        <Icon name="grid" size={18} />
      </button>
    </div>
  );
}
