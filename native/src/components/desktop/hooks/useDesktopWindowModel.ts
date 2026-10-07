import { useRef } from "react";
import { useReducedMotion } from "motion/react";
import { useWindowBounds } from "@/components/desktop/hooks/useWindowBounds";
import { useWindowDrag } from "@/components/desktop/hooks/useWindowDrag";
import { useWindowModalFocus } from "@/components/desktop/hooks/useWindowModalFocus";
import { useWindowMovement } from "@/components/desktop/hooks/useWindowMovement";
import type { DesktopWindowProps } from "@/components/desktop/types/desktop.types";

export function useDesktopWindowModel({
  workspace,
  draggable,
  position,
  onFocus,
  modal = false,
  onDismiss,
  restoreFocusTo,
}: DesktopWindowProps) {
  const ref = useRef<HTMLElement>(null);
  const { x, y } = position;
  const bounds = useWindowBounds(ref, workspace, draggable, x, y);
  const drag = useWindowDrag(draggable, onFocus);
  const movement = useWindowMovement(draggable, x, y, bounds);
  const reduced = useReducedMotion();

  useWindowModalFocus(ref, modal, onDismiss, restoreFocusTo);

  return {
    ref,
    bounds,
    x,
    y,
    reduced,
    ...drag,
    ...movement,
  };
}
