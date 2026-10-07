import { Icon } from "@/components/ui/Icon";
import { PolarMark } from "@/components/ui/PolarMark";
import type { TimelineData } from "@/features/attention/types/timeline.types";
export function ActivityTimelineItem({
  item,
  index,
  onClick,
}: {
  item: TimelineData["activity"][number];
  index: number;
  onClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
}) {
  return (
    <li>
      <button data-item-index={index} onClick={onClick}>
        <span className="activity-icon">
          {item.title === "You created this mission" ? (
            <PolarMark size={19} />
          ) : (
            <Icon name={item.icon} size={18} />
          )}
        </span>
        <span className="timeline-item-copy">
          <strong>{item.title}</strong>
          <span>{item.timing}</span>
        </span>
        <span className="sr-only">Activity {index + 1}</span>
      </button>
    </li>
  );
}
