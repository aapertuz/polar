import { useCurrentTime } from "@/hooks/useCurrentTime";
import { actionTiming } from "@/utils/actionTiming";
import type { TimelineData } from "@/features/attention/types/timeline.types";
import type { OverlayRequest } from "@/components/ui/overlay.types";
import { TIMELINE_PREVIEW_LIMIT } from "@/features/attention/constants/timeline.constants";
export function useTimelineWindow(
  timeline: TimelineData,
  expanded: boolean,
  open: (request: OverlayRequest) => void,
) {
  const now = useCurrentTime();
  const visibleActivity = timeline.activity.slice(0, expanded ? undefined : TIMELINE_PREVIEW_LIMIT);
  const upcomingItems = timeline.upcoming.map((item) => ({
    ...item,
    timing: actionTiming(item.dueOn, now),
    ownerName:
      (timeline.workspacePeople ?? [])
        .filter((person) => item.assigneeIds?.includes(person.id ?? ""))
        .map((person) => (person.id === timeline.currentUserId ? "You" : person.name))
        .join(", ") || "Unassigned",
  }));
  const handleUpcomingClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    const item = upcomingItems[Number(event.currentTarget.dataset.itemIndex)];
    open({
      kind: "action",
      title: item.title,
      detail: item.detail,
      action: {
        id: item.id,
        timing: item.timing,
        priority: item.priority,
        category: item.category,
        owner: item.ownerName,
        ownerInitials: item.owner,
        dueOn: item.dueOn,
        status: item.status,
        assigneeIds: item.assigneeIds,
        contextSourceIds: item.contextSourceIds,
      },
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
