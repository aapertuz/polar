import type { OverlayRequest } from "@/components/ui/overlay.types";
export function useEmptyWorkspace(open: (request: OverlayRequest) => void) {
  const openSettings = (event: React.MouseEvent<HTMLButtonElement>) =>
    open({ kind: "settings", anchor: event.currentTarget, instant: event.detail === 0 });
  return { openSettings };
}
