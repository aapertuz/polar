import type { OverlayRequest } from "@/components/ui/overlay.types";

export function useLauncherOverlay(
  request: OverlayRequest,
  choose: (id: string) => void,
  open: (request: OverlayRequest) => void,
) {
  const handleChoose = (event: React.MouseEvent<HTMLButtonElement>) =>
    choose(event.currentTarget.dataset.missionId!);
  const openSettings = (event: React.MouseEvent<HTMLButtonElement>) =>
    open({ kind: "settings", anchor: request.anchor, instant: event.detail === 0 });
  return { handleChoose, openSettings };
}
