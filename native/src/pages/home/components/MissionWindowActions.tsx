import { Icon } from "@/components/ui/Icon";
import type { OverlayRequest } from "@/components/ui/overlay.types";
export function MissionWindowActions({
  open,
  reviewing,
  onActivate,
  onRefine,
  replacingPlan,
  applying,
  onRegenerate,
  generating,
}: {
  open: (request: OverlayRequest) => void;
  reviewing?: boolean;
  onActivate?: () => void;
  onRefine?: () => void;
  replacingPlan?: boolean;
  applying?: boolean;
  onRegenerate?: () => void;
  generating?: boolean;
}) {
  const openMenu = (event: React.MouseEvent<HTMLButtonElement>) =>
    open({ kind: "window-menu", anchor: event.currentTarget, instant: event.detail === 0 });
  return (
    <div className="mission-window-actions">
      {reviewing && (
        <>
          <span className="mission-draft-badge">DRAFT</span>
          <button className="mission-refine-button" type="button" onClick={onRefine}>
            Refine with Polar
          </button>
          <button
            className="mission-activate-button"
            type="button"
            onClick={onActivate}
            disabled={applying}
          >
            <Icon name="check" size={14} /> {replacingPlan ? "Apply plan" : "Activate mission"}
          </button>
        </>
      )}
      {onRegenerate && !reviewing && (
        <button
          type="button"
          className="mission-refine-button"
          onClick={onRegenerate}
          disabled={generating || applying}
        >
          {generating ? "Regenerating plan…" : "Regenerate plan"}
        </button>
      )}
      <button
        className="icon-button"
        aria-label="Mission window controls"
        title="Window controls"
        onClick={openMenu}
      >
        <Icon name="more" />
      </button>
    </div>
  );
}
