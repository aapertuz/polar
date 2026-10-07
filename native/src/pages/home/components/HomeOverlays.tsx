import { useState } from "react";
import { Dialog } from "../../../components/ui/Dialog";
import { Popover } from "../../../components/ui/Popover";
import { Icon } from "../../../components/ui/Icon";
import { missions } from "../../../features/missions/fixtures/missions.fixtures";
import type { OverlayRequest } from "../../../components/ui/overlay.types";
import type { Mission } from "../../../features/missions/types/mission.types";

interface Props {
  request: OverlayRequest;
  mission: Mission;
  close: () => void;
  select: (id: string, instant?: boolean) => void;
  reset: () => void;
  timelineVisible: boolean;
  toggleTimeline: () => void;
  open: (request: OverlayRequest) => void;
}
const titles: Record<OverlayRequest["kind"], string> = {
  search: "Find a mission",
  launcher: "Your workspace",
  documents: "Mission documents",
  settings: "Appearance",
  notifications: "Needs your attention",
  people: "Mission people",
  create: "Create a mission",
  proposal: "Preview plan adjustment",
  calendar: "November 2026",
  detail: "Details",
  "window-menu": "Window controls",
};

export function HomeOverlays({
  request,
  mission,
  close,
  select,
  reset,
  timelineVisible,
  toggleTimeline,
  open,
}: Props) {
  const [query, setQuery] = useState("");
  const choose = (id: string) => {
    select(id, request.instant);
    close();
  };
  const title = request.title ?? titles[request.kind];
  const content = (() => {
    switch (request.kind) {
      case "search":
        return (
          <>
            <label className="search-field">
              <Icon name="search" />
              <input
                autoFocus
                placeholder="Search your missions…"
                aria-label="Search missions"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <kbd>ESC</kbd>
            </label>
            <div className="overlay-list">
              {missions
                .filter((m) => `${m.name} ${m.outcome}`.toLowerCase().includes(query.toLowerCase()))
                .map((m) => (
                  <button key={m.id} onClick={() => choose(m.id)}>
                    <span>
                      <strong>{m.name}</strong>
                      <span>{m.outcome}</span>
                    </span>
                    <Icon name="arrow" size={18} />
                  </button>
                ))}
              {!missions.some((m) =>
                `${m.name} ${m.outcome}`.toLowerCase().includes(query.toLowerCase()),
              ) && <p className="empty-search">No missions match “{query}”.</p>}
            </div>
          </>
        );
      case "launcher":
        return (
          <>
            <p className="overlay-muted">Three missions. One place to stay oriented.</p>
            <div className="overlay-list">
              {missions.map((m) => (
                <button key={m.id} onClick={() => choose(m.id)}>
                  <span>
                    <strong>{m.name}</strong>
                    <span>{m.progress}% complete</span>
                  </span>
                  <Icon name="arrow" size={18} />
                </button>
              ))}
            </div>
          </>
        );
      case "documents":
        return (
          <div className="overlay-list">
            {mission.evidence.map((item) => (
              <button
                key={item.title}
                onClick={(e) =>
                  open({
                    kind: "detail",
                    title: item.title,
                    detail: `${item.source} · ${item.date}. Sample context for ${mission.name}.`,
                    anchor: e.currentTarget,
                    instant: e.detail === 0,
                  })
                }
              >
                <Icon name="file" size={18} />
                <span>
                  <strong>{item.title}</strong>
                  <span>{item.source}</span>
                </span>
              </button>
            ))}
          </div>
        );
      case "settings":
        return (
          <>
            <div className="appearance-swatch">
              <span />
              <span />
              <span />
            </div>
            <h3>Quiet by design</h3>
            <p className="overlay-muted">
              Warm canvas. Dark mission windows. A single orientation color.
            </p>
            <p className="demo-note">Appearance preview · preferences are not saved.</p>
          </>
        );
      case "notifications":
        return (
          <>
            <div className="notification-preview">
              <span className="orientation-point" />
              <div>
                <h3>F1 Pilot needs attention</h3>
                <p className="overlay-muted">Attendee intake may delay interviews by 3 days.</p>
              </div>
            </div>
            <button className="dark-button" onClick={() => choose("pilot")}>
              Open F1 Pilot
              <Icon name="arrow" size={18} />
            </button>
          </>
        );
      case "people":
        return (
          <div className="overlay-people">
            {mission.people.map((person) => (
              <div key={person.name}>
                <span className="avatar">{person.initials}</span>
                <span>
                  <strong>{person.name}</strong>
                  <span>{person.role}</span>
                </span>
              </div>
            ))}
          </div>
        );
      case "create":
        return (
          <>
            <p className="overlay-muted">Start with an outcome. The plan follows.</p>
            <div className="creation-preview">
              <span>MISSION OUTCOME</span>
              <p>What do you want to make happen?</p>
              <span>SUCCESS CRITERIA</span>
              <p>What would tell you it worked?</p>
              <span>CONTEXT</span>
              <p>The people, constraints, and evidence that matter.</p>
            </div>
            <p className="demo-note">
              This is a UI preview. Mission creation is not connected yet.
            </p>
            <button className="dark-button" onClick={close}>
              Close preview
              <Icon name="check" size={18} />
            </button>
          </>
        );
      case "proposal":
        return (
          <>
            <p className="overlay-muted">{mission.name} · proposed adjustment</p>
            <div className="proposal-section">
              <span>CURRENT ASSESSMENT</span>
              <p>{mission.assessment}</p>
            </div>
            <div className="proposal-section proposed">
              <span>PROPOSED APPROACH</span>
              <p>{mission.proposedChange}</p>
            </div>
            <p className="demo-note">Preview only. This does not change the execution plan.</p>
            <button className="dark-button" onClick={close}>
              Close preview
              <Icon name="check" size={18} />
            </button>
          </>
        );
      case "calendar":
        return (
          <>
            <div className="calendar-grid" aria-label="Sample calendar for November 2026">
              {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
                <span key={`day-${i}`} className="calendar-weekday" aria-hidden="true">
                  {d}
                </span>
              ))}
              {Array.from({ length: 30 }, (_, i) => (
                <span
                  key={i}
                  className={
                    i === 3
                      ? "sample-today"
                      : i === 19 && mission.id === "pilot"
                        ? "deadline-day"
                        : ""
                  }
                  aria-label={`November ${i + 1}${i === 3 ? ", sample today" : ""}${i === 19 && mission.id === "pilot" ? ", mission deadline" : ""}`}
                >
                  {i + 1}
                </span>
              ))}
            </div>
            <p className="demo-note">Sample date · Wed, Nov 4</p>
          </>
        );
      case "detail":
        return (
          <>
            <p className="detail-copy">{request.detail}</p>
            <p className="demo-note">Sample mission context · {mission.name}</p>
          </>
        );
      case "window-menu":
        return (
          <div className="window-menu">
            <button
              onClick={() => {
                reset();
                close();
              }}
            >
              <Icon name="reset" size={18} />
              Reset layout
            </button>
            <button
              onClick={() => {
                toggleTimeline();
                close();
              }}
            >
              <Icon name="clock" size={18} />
              {timelineVisible ? "Hide timeline" : "Show timeline"}
            </button>
            <p className="demo-note">Drag the window header to arrange your workspace.</p>
          </div>
        );
    }
  })();
  return ["search", "create", "proposal"].includes(request.kind) ? (
    <Dialog title={title} onClose={close} trigger={request.anchor} instant={request.instant}>
      {content}
    </Dialog>
  ) : (
    <Popover title={title} onClose={close} trigger={request.anchor} instant={request.instant}>
      {content}
    </Popover>
  );
}
