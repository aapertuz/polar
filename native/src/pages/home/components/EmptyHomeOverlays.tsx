import { Dialog } from "@/components/ui/Dialog";
import { Popover } from "@/components/ui/Popover";
import { SettingsOverlay } from "@/pages/home/components/overlays/SettingsOverlay";
import { WindowMenuOverlay } from "@/pages/home/components/overlays/WindowMenuOverlay";
import { WorkspaceSettingsSurface } from "@/pages/home/components/overlays/WorkspaceSettingsSurface";
import { WorkspaceCreateSurface } from "@/features/workspaces/components/WorkspaceCreateSurface";
import { useEmptyWorkspace } from "@/pages/home/hooks/useEmptyWorkspace";
import type { OverlayRequest } from "@/components/ui/overlay.types";
import type { usePolarAccount } from "@/features/application-auth/hooks/usePolarAccount";
import type { useWorkspaceSettings } from "@/features/workspaces/hooks/useWorkspaceSettings";
type AccountModel = ReturnType<typeof usePolarAccount>;
type WorkspaceSettingsModel = ReturnType<typeof useWorkspaceSettings>;
interface Props {
  request: OverlayRequest;
  close: () => void;
  open: (request: OverlayRequest) => void;
  reset: () => void;
  timelineVisible: boolean;
  toggleTimeline: () => void;
  account: AccountModel;
  workspaceSettings: WorkspaceSettingsModel;
}
export function EmptyHomeOverlays({
  request,
  close,
  open,
  reset,
  timelineVisible,
  toggleTimeline,
  account,
  workspaceSettings,
}: Props) {
  const { openSettings } = useEmptyWorkspace(open);
  const openWorkspaceSettings = () => open({ kind: "workspace-settings" });
  if (request.kind === "settings")
    return (
      <Dialog
        title="Settings"
        eyebrow="POLAR / SETTINGS"
        onClose={close}
        trigger={request.anchor}
        instant={request.instant}
      >
        <SettingsOverlay account={account} />
      </Dialog>
    );
  if (request.kind === "workspace-settings")
    return (
      <Dialog
        title="Workspace settings"
        eyebrow="POLAR / WORKSPACE"
        onClose={close}
        trigger={request.anchor}
        instant={request.instant}
      >
        <WorkspaceSettingsSurface model={workspaceSettings} open={open} close={close} />
      </Dialog>
    );
  if (request.kind === "workspace-create")
    return (
      <Dialog
        title="Create workspace"
        eyebrow="POLAR / WORKSPACE"
        onClose={close}
        trigger={request.anchor}
        instant={request.instant}
      >
        <WorkspaceCreateSurface model={workspaceSettings} close={close} />
      </Dialog>
    );
  return (
    <Popover
      title={request.title ?? EMPTY_TITLES[request.kind]}
      onClose={close}
      trigger={request.anchor}
      instant={request.instant}
    >
      {request.kind === "window-menu" ? (
        <WindowMenuOverlay
          reset={reset}
          close={close}
          timelineVisible={timelineVisible}
          toggleTimeline={toggleTimeline}
        />
      ) : (
        <p className="overlay-muted">{EMPTY_MESSAGES[request.kind]}</p>
      )}
      {request.kind === "launcher" && (
        <div className="window-menu">
          <button onClick={openWorkspaceSettings}>Workspace settings</button>
          <button onClick={openSettings}>Settings</button>
        </div>
      )}
    </Popover>
  );
}
const EMPTY_TITLES = {
  search: "Find a mission",
  launcher: "Your workspace",
  "workspace-settings": "Workspace settings",
  "workspace-create": "Create workspace",
  documents: "Mission documents",
  notifications: "Needs your attention",
  people: "Workspace people",
  proposal: "Plan adjustment",
  calendar: "Calendar",
  action: "Action details",
  detail: "Details",
  "window-menu": "Window controls",
};
const EMPTY_MESSAGES = {
  search: "No missions to search yet.",
  launcher: "Your workspace has no missions yet.",
  documents: "No mission documents yet.",
  notifications: "You're all caught up. No notifications yet.",
  people: "No mission collaborators yet.",
  proposal: "No plan adjustments to review.",
  calendar: "No deadlines scheduled yet.",
  action: "No mission selected.",
  detail: "No mission selected.",
  "window-menu": "",
};
