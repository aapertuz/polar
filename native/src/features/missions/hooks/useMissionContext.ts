import type { Mission } from "@/features/missions/types/mission.types";
import type { OverlayRequest } from "@/components/ui/overlay.types";
export function useMissionContext(mission: Mission, open: (request: OverlayRequest) => void) {
  const handleEvidenceClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    const item = mission.evidence[Number(event.currentTarget.dataset.evidenceIndex)];
    open({
      kind: "detail",
      title: item.title,
      detail: `${item.source} · ${item.date}. This sample artifact provides context for ${mission.name}.`,
      anchor: event.currentTarget,
      instant: event.detail === 0,
    });
  };
  return { handleEvidenceClick };
}
