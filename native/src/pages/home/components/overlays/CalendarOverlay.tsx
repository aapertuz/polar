import type { OverlayRequest } from "@/components/ui/overlay.types";
import type { Mission } from "@/features/missions/types/mission.types";
import { SAMPLE_CALENDAR } from "@/pages/home/fixtures/home-preview.fixtures";
import { getCalendarPreviewDays } from "@/pages/home/utils/calendarPreview";
import { CalendarDay } from "@/pages/home/components/overlays/CalendarDay";
interface Props {
  request: OverlayRequest;
  mission: Mission;
  close: () => void;
  select: (id: string, instant?: boolean) => void;
  reset: () => void;
  timelineVisible: boolean;
  toggleTimeline: () => void;
  open: (request: OverlayRequest) => void;
  choose: (id: string) => void;
}
export function CalendarOverlay({ mission }: Props) {
  const calendarDays = getCalendarPreviewDays(mission.id);
  return (
    <>
      <div
        className="calendar-grid"
        aria-label={`Sample calendar for ${SAMPLE_CALENDAR.month} ${SAMPLE_CALENDAR.year}`}
      >
        {SAMPLE_CALENDAR.weekdays.map((d, i) => (
          <span key={`day-${i}`} className="calendar-weekday" aria-hidden="true">
            {d}
          </span>
        ))}
        {calendarDays.map((day) => (
          <CalendarDay key={day.day} {...day} />
        ))}
      </div>
      <p className="demo-note">Sample date · {SAMPLE_CALENDAR.date}</p>
    </>
  );
}
