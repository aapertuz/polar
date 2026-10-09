import { useCallback, useState } from "react";
import type { OverlayRequest } from "@/components/ui/overlay.types";
export function useHomeOverlay() {
  const [overlay, setOverlay] = useState<OverlayRequest | null>(null);
  const close = useCallback(() => setOverlay(null), []);
  const open = useCallback((request: OverlayRequest) => setOverlay(request), []);
  return { overlay, close, open };
}
