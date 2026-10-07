import type { OverlayRequest } from "@/components/ui/overlay.types";
import type { Mission } from "@/features/missions/types/mission.types";
import { useDocumentsOverlay } from "@/pages/home/hooks/useDocumentsOverlay";
import { DocumentOverlayItem } from "@/pages/home/components/overlays/DocumentOverlayItem";
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
export function DocumentsOverlay({ mission, open }: Props) {
  const { handleDocumentClick } = useDocumentsOverlay(mission, open);
  return (
    <div className="overlay-list">
      {mission.evidence.map((item, index) => (
        <DocumentOverlayItem
          key={item.title}
          item={item}
          index={index}
          onClick={handleDocumentClick}
        />
      ))}
    </div>
  );
}
