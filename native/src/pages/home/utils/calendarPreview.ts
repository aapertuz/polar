import { SAMPLE_CALENDAR } from "@/pages/home/fixtures/home-preview.fixtures";
export function getCalendarPreviewDays(missionId: string) {
  return Array.from({ length: SAMPLE_CALENDAR.days }, (_, index) => {
    const isToday = index === SAMPLE_CALENDAR.today - 1;
    const isDeadline =
      index === SAMPLE_CALENDAR.deadline - 1 && missionId === SAMPLE_CALENDAR.missionId;
    return {
      day: index + 1,
      className: isToday ? "sample-today" : isDeadline ? "deadline-day" : "",
      ariaLabel: `${SAMPLE_CALENDAR.month} ${index + 1}${isToday ? ", sample today" : ""}${isDeadline ? ", mission deadline" : ""}`,
    };
  });
}
