import { Dialog } from "@/components/ui/Dialog";
import { Popover } from "@/components/ui/Popover";
import { ActionDetailWindow } from "@/features/missions/components/ActionDetailWindow";
import { overlayRegistry } from "@/pages/home/config/overlayRegistry";
import type { OverlayRequest } from "@/components/ui/overlay.types";
import type { Mission } from "@/features/missions/types/mission.types";
import type { MissionActionUpdate } from "@polar/contracts";
import type { usePolarAccount } from "@/features/application-auth/hooks/usePolarAccount";
import type { useWorkspaceSettings } from "@/features/workspaces/hooks/useWorkspaceSettings";
type AccountModel = ReturnType<typeof usePolarAccount>;
type WorkspaceSettingsModel = ReturnType<typeof useWorkspaceSettings>;
export interface OverlayBodyProps {
  request: OverlayRequest;
  mission: Mission;
  close: () => void;
  select: (id: string, instant?: boolean) => void;
  reset: () => void;
  timelineVisible: boolean;
  toggleTimeline: () => void;
  open: (request: OverlayRequest) => void;
  choose: (id: string) => void;
  updateAction?: (
    missionId: string,
    actionId: string,
    updates: MissionActionUpdate,
  ) => Promise<void>;
  account: AccountModel;
  workspaceSettings: WorkspaceSettingsModel;
}
interface Props extends Omit<OverlayBodyProps, "query" | "setQuery" | "choose"> {}
const surfaces = {
  dialog: Dialog,
  popover: Popover,
  "action-window": ActionDetailWindow,
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
  updateAction,
  account,
  workspaceSettings,
}: Props) {
  const choose = (id: string) => {
    select(id, request.instant);
    close();
  };
  const definition = overlayRegistry[request.kind];
  const Component = definition.Component;
  const Surface = surfaces[definition.surface];
  const title = request.title ?? definition.title;
  const props = {
    request,
    mission,
    close,
    select,
    reset,
    timelineVisible,
    toggleTimeline,
    open,
    choose,
    updateAction,
    account,
    workspaceSettings,
  };
  return (
    <Surface
      title={title}
      onClose={close}
      trigger={request.anchor}
      instant={request.instant}
      eyebrow={request.kind === "settings" ? "POLAR / SETTINGS" : "POLAR / PREVIEW"}
    >
      <Component {...props} />
    </Surface>
  );
}
