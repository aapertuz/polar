import type { OverlayRequest } from "@/components/ui/overlay.types";
import type { Mission } from "@/features/missions/types/mission.types";
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
export function PeopleOverlay({ mission }: Props) {
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
}
