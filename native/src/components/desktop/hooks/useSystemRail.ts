import { useCallback } from "react";
import type { IconName } from "@/components/ui/Icon";
import type { OverlayRequest } from "@/components/ui/overlay.types";
const railItems: { icon: IconName; kind: OverlayRequest["kind"]; label: string }[] = [
  { icon: "search", kind: "search", label: "Search missions" },
  { icon: "grid", kind: "launcher", label: "Open launcher" },
  { icon: "file", kind: "documents", label: "Mission documents" },
  { icon: "settings", kind: "settings", label: "Settings" },
];
export function useSystemRail(open: (request: OverlayRequest) => void, home: () => void) {
  const handleItemClick = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      const item = railItems[Number(event.currentTarget.dataset.itemIndex)];
      open({ kind: item.kind, anchor: event.currentTarget, instant: event.detail === 0 });
    },
    [open],
  );
  return { railItems, handleItemClick, home };
}
