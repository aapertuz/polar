import type { Mission } from "@/features/missions/types/mission.types";
import type { OverlayRequest } from "@/components/ui/overlay.types";
export function useDocumentsOverlay(mission: Mission, open: (request: OverlayRequest) => void) {
  const handleDocumentClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    const item = mission.evidence[Number(event.currentTarget.dataset.documentIndex)];
    open({
      kind: "detail",
      title: item.title,
      detail: `${item.source} · ${item.date}. Sample context for ${mission.name}.`,
      anchor: event.currentTarget,
      instant: event.detail === 0,
    });
  };
  return { handleDocumentClick };
}
