import type { TimelineData } from "@/features/attention/types/timeline.types";
export function UpcomingTimelineItem({
  item,
  index,
  onClick,
}: {
  item: TimelineData["upcoming"][number] & { ownerName: string };
  index: number;
  onClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
}) {
  return (
    <li>
      <button data-item-index={index} onClick={onClick}>
        <span className={`timeline-marker ${index === 0 ? "urgent" : ""}`} aria-hidden="true" />
        <span className="timeline-item-copy">
          <strong>{item.title}</strong>
          <span>
            {item.timing}
            {item.priority && (
              <>
                {" "}
                ·{" "}
                <span className={item.priority === "High" ? "high-priority" : ""}>
                  {item.priority}
                </span>
              </>
            )}
          </span>
        </span>
        <span className="avatar" aria-label={`Owner ${item.ownerName}`}>
          {item.owner}
        </span>
      </button>
    </li>
  );
}
