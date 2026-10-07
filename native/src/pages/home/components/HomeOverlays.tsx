import { Dialog } from "@/components/ui/Dialog";
import { Popover } from "@/components/ui/Popover";
import { overlayRegistry } from "@/pages/home/config/overlayRegistry";
import type { OverlayRequest } from "@/components/ui/overlay.types";
import type { Mission } from "@/features/missions/types/mission.types";
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
}
interface Props extends Omit<OverlayBodyProps, "query" | "setQuery" | "choose"> {}
export function HomeOverlays({
  request,
  mission,
  close,
  select,
  reset,
  timelineVisible,
  toggleTimeline,
  open,
}: Props) {
  const choose = (id: string) => {
    select(id, request.instant);
    close();
  };
  const definition = overlayRegistry[request.kind];
  const Component = definition.Component;
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
  };
  return definition.surface === "dialog" ? (
    <Dialog title={title} onClose={close} trigger={request.anchor} instant={request.instant}>
      <Component {...props} />
    </Dialog>
  ) : (
    <Popover title={title} onClose={close} trigger={request.anchor} instant={request.instant}>
      <Component {...props} />
    </Popover>
  );
}
