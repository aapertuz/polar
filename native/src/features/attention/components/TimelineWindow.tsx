import { Icon } from "@/components/ui/Icon";
import { UpcomingTimelineItem } from "@/features/attention/components/UpcomingTimelineItem";
import { ActivityTimelineItem } from "@/features/attention/components/ActivityTimelineItem";
import type { OverlayRequest } from "@/components/ui/overlay.types";
import type { TimelineData } from "@/features/attention/types/timeline.types";
import { useTimelineWindow } from "@/features/attention/hooks/useTimelineWindow";

export function TimelineWindow({
  timeline,
  expanded,
  toggleExpanded,
  open,
}: {
  timeline: TimelineData;
  expanded: boolean;
  toggleExpanded: () => void;
  open: (request: OverlayRequest) => void;
}) {
  const { upcomingItems, visibleActivity, handleUpcomingClick, handleActivityClick } =
    useTimelineWindow(timeline, expanded, open);
  return (
    <div className="timeline-scroll">
      <section className="up-next">
        <h2>Up next</h2>
        <ol>
          {upcomingItems.map((item, index) => (
            <UpcomingTimelineItem
              key={item.title}
              item={item}
              index={index}
              onClick={handleUpcomingClick}
            />
          ))}
        </ol>
      </section>
      <section className="recent-activity">
        <div className="section-heading">
          <h2>Recent activity</h2>
          <button className="text-button" onClick={toggleExpanded} aria-expanded={expanded}>
            {expanded ? "Show less" : "View all"}
            <Icon name="arrow" size={16} />
          </button>
        </div>
        <ul>
          {visibleActivity.map((item, index) => (
            <ActivityTimelineItem
              key={item.title}
              item={item}
              index={index}
              onClick={handleActivityClick}
            />
          ))}
        </ul>
      </section>
    </div>
  );
}
