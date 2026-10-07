import { Icon } from "@/components/ui/Icon";
import { SAMPLE_CALENDAR } from "@/pages/home/fixtures/home-preview.fixtures";
import type { OverlayRequest } from "@/components/ui/overlay.types";
export function TimelineWindowActions({
  desktop,
  close,
  open,
}: {
  desktop: boolean;
  close: () => void;
  open: (request: OverlayRequest) => void;
}) {
  const openCalendar = (event: React.MouseEvent<HTMLButtonElement>) =>
    open({ kind: "calendar", anchor: event.currentTarget, instant: event.detail === 0 });
  return (
    <>
      <span className="timeline-date">{SAMPLE_CALENDAR.date}</span>
      <button
        className="icon-button"
        aria-label="Open sample calendar"
        title="Calendar"
        onClick={openCalendar}
      >
        <Icon name="calendar" size={18} />
      </button>
      {!desktop && (
        <button className="icon-button" aria-label="Close timeline" onClick={close}>
          <Icon name="close" size={18} />
        </button>
      )}
    </>
  );
}
