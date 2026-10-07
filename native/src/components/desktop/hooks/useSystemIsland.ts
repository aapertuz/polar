import type { OverlayRequest } from "@/components/ui/overlay.types";
export function useSystemIsland(open: (request: OverlayRequest) => void) {
  const openNotifications = (event: React.MouseEvent<HTMLButtonElement>) =>
    open({ kind: "notifications", anchor: event.currentTarget, instant: event.detail === 0 });
  const openPeople = (event: React.MouseEvent<HTMLButtonElement>) =>
    open({ kind: "people", anchor: event.currentTarget, instant: event.detail === 0 });
  const openLauncher = (event: React.MouseEvent<HTMLButtonElement>) =>
    open({ kind: "launcher", anchor: event.currentTarget, instant: event.detail === 0 });
  return { openNotifications, openPeople, openLauncher };
}
