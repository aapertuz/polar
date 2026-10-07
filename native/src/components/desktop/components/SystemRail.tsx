import { Icon, type IconName } from "../../ui/Icon";
import { PolarMark } from "../../ui/PolarMark";
import type { OverlayRequest } from "../../ui/overlay.types";

export function SystemRail({
  open,
  home,
}: {
  open: (request: OverlayRequest) => void;
  home: () => void;
}) {
  const items: { icon: IconName; kind: OverlayRequest["kind"]; label: string }[] = [
    { icon: "search", kind: "search", label: "Search missions" },
    { icon: "grid", kind: "launcher", label: "Open launcher" },
    { icon: "file", kind: "documents", label: "Mission documents" },
    { icon: "settings", kind: "settings", label: "Appearance preview" },
  ];
  return (
    <nav className="system-rail" aria-label="System navigation">
      <button className="rail-home" onClick={home} aria-label="Home" title="Home">
        <PolarMark size={27} />
      </button>
      {items.map((item) => (
        <button
          key={item.kind}
          className="rail-button"
          aria-label={item.label}
          title={item.label}
          onClick={(event) =>
            open({ kind: item.kind, anchor: event.currentTarget, instant: event.detail === 0 })
          }
        >
          <Icon name={item.icon} size={23} />
        </button>
      ))}
    </nav>
  );
}
