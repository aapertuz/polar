import { Icon } from "@/components/ui/Icon";
import { useTimelineWindowActions } from "@/pages/home/hooks/useTimelineWindowActions";
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
  const { date, openCalendar } = useTimelineWindowActions(open);
  return (
    <>
      <span className="timeline-date">{date}</span>
      <button
        className="icon-button"
        aria-label="Open calendar"
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
