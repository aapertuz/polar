import type { Mission } from "@/features/missions/types/mission.types";
import type { OverlayRequest } from "@/components/ui/overlay.types";
export function useMissionContext(mission: Mission, open: (request: OverlayRequest) => void) {
  const workspaceSources = mission.evidence.filter((item) => item.scope === "workspace");
  const missionSources = mission.evidence.filter((item) => item.scope !== "workspace");
  const handleEvidenceClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    const item = mission.evidence[Number(event.currentTarget.dataset.evidenceIndex)];
    open({
      kind: "detail",
      title: item.title,
      detail: `${item.scope === "workspace" ? "Workspace source" : "Mission attachment"} · revision ${item.revision ?? 1} · ${item.currentState ?? "historical source version"}${item.cited ? " · cited by the approved plan" : " · supplied to reasoning"}${item.contentHash ? ` · SHA-256 ${item.contentHash}` : ""}.`,
      anchor: event.currentTarget,
      instant: event.detail === 0,
    });
  };
  return { handleEvidenceClick, workspaceSources, missionSources };
}
