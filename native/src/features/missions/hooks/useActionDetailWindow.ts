import { useEffect, useRef } from "react";
import { useMotionValue } from "motion/react";
import { useDialog } from "@/components/ui/hooks/useDialog";
import { useWindowBounds } from "@/components/desktop/hooks/useWindowBounds";
import { useWindowDrag } from "@/components/desktop/hooks/useWindowDrag";
import { useWindowMovement } from "@/components/desktop/hooks/useWindowMovement";
import { useWindowResize } from "@/components/desktop/hooks/useWindowResize";

export function useActionDetailWindow(trigger: HTMLElement | undefined, onClose: () => void) {
  const dialog = useDialog(trigger, onClose, false);
  const workspace = useRef<HTMLElement | null>(document.documentElement);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const bounds = useWindowBounds(dialog.ref, workspace, true, x, y);
  const focusWindow = () => dialog.ref.current?.focus({ preventScroll: true });
  const drag = useWindowDrag(true, focusWindow);
  const movement = useWindowMovement(true, x, y, bounds);
  const resize = useWindowResize(dialog.ref, workspace, x, y);
  useEffect(() => {
    const rect = dialog.ref.current?.getBoundingClientRect();
    if (!rect) return;
    x.set(Math.max(0, (window.innerWidth - rect.width) / 2));
    y.set(Math.max(0, (window.innerHeight - rect.height) / 2));
  }, [dialog.ref, x, y]);
  const handleKeyDown = (event: React.KeyboardEvent<HTMLDialogElement>) => {
    if (event.key === "Escape" && !event.defaultPrevented) {
      event.preventDefault();
      onClose();
    }
  };
  return { ...dialog, workspace, x, y, bounds, ...drag, ...movement, ...resize, handleKeyDown };
}
