import { Dialog } from "@/components/ui/Dialog";
import { Popover } from "@/components/ui/Popover";
import { SettingsOverlay } from "@/pages/home/components/overlays/SettingsOverlay";
import { WindowMenuOverlay } from "@/pages/home/components/overlays/WindowMenuOverlay";
import { useEmptyWorkspace } from "@/pages/home/hooks/useEmptyWorkspace";
import type { OverlayRequest } from "@/components/ui/overlay.types";
interface Props {
  request: OverlayRequest;
  close: () => void;
  open: (request: OverlayRequest) => void;
  reset: () => void;
  timelineVisible: boolean;
  toggleTimeline: () => void;
}
export function EmptyHomeOverlays({
  request,
  close,
  open,
  reset,
  timelineVisible,
  toggleTimeline,
}: Props) {
  const { openSettings } = useEmptyWorkspace(open);
  if (request.kind === "settings")
    return (
      <Dialog
        title="Settings"
        eyebrow="POLAR / SETTINGS"
        onClose={close}
        trigger={request.anchor}
        instant={request.instant}
      >
        <SettingsOverlay />
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
        <button className="dark-button" onClick={openSettings}>
          Settings
        </button>
      )}
    </Popover>
  );
}
const EMPTY_TITLES = {
  search: "Find a mission",
  launcher: "Your workspace",
  documents: "Mission documents",
  notifications: "Needs your attention",
  people: "Workspace people",
  proposal: "Plan adjustment",
  calendar: "Calendar",
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
  detail: "No mission selected.",
  "window-menu": "",
};
