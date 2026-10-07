import { Icon } from "@/components/ui/Icon";
import type { OverlayRequest } from "@/components/ui/overlay.types";
import type { Mission } from "@/features/missions/types/mission.types";
import { useSearchOverlay } from "@/pages/home/hooks/useSearchOverlay";
import { MissionChoiceRow } from "@/pages/home/components/overlays/MissionChoiceRow";
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
export function SearchOverlay({ choose }: Props) {
  const { query, filteredMissions, handleQueryChange, handleChoose } = useSearchOverlay(choose);
  return (
    <>
      <label className="search-field">
        <Icon name="search" />
        <input
          autoFocus
          placeholder="Search your missions…"
          aria-label="Search missions"
          value={query}
          onChange={handleQueryChange}
        />
        <kbd>ESC</kbd>
      </label>
      <div className="overlay-list">
        {filteredMissions.map((mission) => (
          <MissionChoiceRow
            key={mission.id}
            missionId={mission.id}
            title={mission.name}
            detail={mission.outcome}
            onChoose={handleChoose}
          />
        ))}
        {filteredMissions.length === 0 && (
          <p className="empty-search">No missions match “{query}”.</p>
        )}
      </div>
    </>
  );
}
