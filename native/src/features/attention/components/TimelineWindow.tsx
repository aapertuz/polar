import { Icon } from "../../../components/ui/Icon";
import { PolarMark } from "../../../components/ui/PolarMark";
import type { OverlayRequest } from "../../../components/ui/overlay.types";
import type { TimelineData } from "../types/timeline.types";

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
  return (
    <div className="timeline-scroll">
      <section className="up-next">
        <h2>Up next</h2>
        <ol>
          {timeline.upcoming.map((item, index) => (
            <li key={item.title}>
              <button
                onClick={(e) =>
                  open({
                    kind: "detail",
                    title: item.title,
                    detail: item.detail,
                    anchor: e.currentTarget,
                    instant: e.detail === 0,
                  })
                }
              >
                <span
                  className={`timeline-marker ${index === 0 ? "urgent" : ""}`}
                  aria-hidden="true"
                />
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
                <span
                  className="avatar"
                  aria-label={`Owner ${timeline.people.find((p) => p.initials === item.owner)?.name ?? item.owner}`}
                >
                  {item.owner}
                </span>
              </button>
            </li>
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
          {timeline.activity.slice(0, expanded ? undefined : 4).map((item, index) => (
            <li key={item.title}>
              <button
                onClick={(e) =>
                  open({
                    kind: "detail",
                    title: item.title,
                    detail: item.detail,
                    anchor: e.currentTarget,
                    instant: e.detail === 0,
                  })
                }
              >
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
          ))}
        </ul>
      </section>
    </div>
  );
}
