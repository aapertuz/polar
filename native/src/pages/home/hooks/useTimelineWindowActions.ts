import { useCurrentTime } from "@/hooks/useCurrentTime";
import type { OverlayRequest } from "@/components/ui/overlay.types";
export function useTimelineWindowActions(open: (request: OverlayRequest) => void) {
  const now = useCurrentTime();
  const date = new Date(now).toLocaleDateString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const openCalendar = (event: React.MouseEvent<HTMLButtonElement>) =>
    open({ kind: "calendar", anchor: event.currentTarget, instant: event.detail === 0 });
  return { date, openCalendar };
}
