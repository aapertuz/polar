import type { TimelineData } from "@/features/attention/types/timeline.types";
import type { OverlayRequest } from "@/components/ui/overlay.types";
import { TIMELINE_PREVIEW_LIMIT } from "@/features/attention/constants/timeline.constants";
export function useTimelineWindow(
  timeline: TimelineData,
  expanded: boolean,
  open: (request: OverlayRequest) => void,
) {
  const visibleActivity = timeline.activity.slice(0, expanded ? undefined : TIMELINE_PREVIEW_LIMIT);
  const upcomingItems = timeline.upcoming.map((item) => ({
    ...item,
    ownerName: timeline.people.find((person) => person.initials === item.owner)?.name ?? item.owner,
  }));
  const handleUpcomingClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    const item = timeline.upcoming[Number(event.currentTarget.dataset.itemIndex)];
    open({
      kind: "detail",
      title: item.title,
      detail: item.detail,
      anchor: event.currentTarget,
      instant: event.detail === 0,
    });
  };
  const handleActivityClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    const item = visibleActivity[Number(event.currentTarget.dataset.itemIndex)];
    open({
      kind: "detail",
      title: item.title,
      detail: item.detail,
      anchor: event.currentTarget,
      instant: event.detail === 0,
    });
  };
  return { upcomingItems, visibleActivity, handleUpcomingClick, handleActivityClick };
}
