import { Icon } from "@/components/ui/Icon";
import type { OverlayRequest } from "@/components/ui/overlay.types";
export function MissionWindowActions({ open }: { open: (request: OverlayRequest) => void }) {
  const openMenu = (event: React.MouseEvent<HTMLButtonElement>) =>
    open({ kind: "window-menu", anchor: event.currentTarget, instant: event.detail === 0 });
  return (
    <button
      className="icon-button"
      aria-label="Mission window controls"
      title="Window controls"
      onClick={openMenu}
    >
      <Icon name="more" />
    </button>
  );
}
