import type { OverlayRequest } from "@/components/ui/overlay.types";
import type { Mission } from "@/features/missions/types/mission.types";

export function useMissionPlan(mission: Mission, open: (request: OverlayRequest) => void) {
  const handleOpenAction = (title: string) => () => {
    const action = mission.actions?.find((item) => item.title === title);
    if (!action) return;
    open({
      kind: "action",
      title: action.title,
      detail: action.detail,
      action: {
        id: action.id,
        timing: action.dueOn ?? "No deadline",
        priority: action.priority,
        owner: action.assigneeIds?.[0] ?? "—",
        ownerInitials: "—",
        dueOn: action.dueOn,
        status: action.status,
        assigneeIds: action.assigneeIds,
        contextSourceIds: action.contextSourceIds,
      },
    });
  };
  return { handleOpenAction };
}
