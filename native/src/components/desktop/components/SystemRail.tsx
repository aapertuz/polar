import { Icon } from "@/components/ui/Icon";
import { PolarMark } from "@/components/ui/PolarMark";
import type { OverlayRequest } from "@/components/ui/overlay.types";
import { useSystemRail } from "@/components/desktop/hooks/useSystemRail";

export function SystemRail({
  open,
  home,
}: {
  open: (request: OverlayRequest) => void;
  home: () => void;
}) {
  const { railItems: items, handleItemClick, home: goHome } = useSystemRail(open, home);
  return (
    <nav className="system-rail" aria-label="System navigation">
      <button className="rail-home" onClick={goHome} aria-label="Home" title="Home">
        <PolarMark size={27} />
      </button>
      {items.map((item, index) => (
        <button
          key={item.kind}
          className="rail-button"
          aria-label={item.label}
          title={item.label}
          data-item-index={index}
          onClick={handleItemClick}
        >
          <Icon name={item.icon} size={23} />
        </button>
      ))}
    </nav>
  );
}
