import { useLayoutEffect, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";
import { popoverMotion } from "@/components/ui/motionPolicy";
export function usePopover(
  trigger: HTMLElement | undefined,
  instant: boolean | undefined,
  onClose: () => void,
) {
  const ref = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ left: 0, top: 0, origin: "top left" });
  const reduced = useReducedMotion();
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useLayoutEffect(() => {
    const panel = ref.current;
    if (!panel) return;
    const previous = trigger ?? document.activeElement;
    const place = () => {
      const anchor = trigger?.getBoundingClientRect();
      const left = Math.max(
        12,
        Math.min(
          window.innerWidth - panel.offsetWidth - 12,
          anchor?.left ?? window.innerWidth / 2 - panel.offsetWidth / 2,
        ),
      );
      const below = (anchor?.bottom ?? 80) + 10;
      const top =
        below + panel.offsetHeight > window.innerHeight - 12
          ? Math.max(12, (anchor?.top ?? 80) - panel.offsetHeight - 10)
          : below;
      setPosition({ left, top, origin: top < below ? "bottom left" : "top left" });
    };
    place();
    panel.querySelector<HTMLElement>("button,input,[tabindex='0']")?.focus();
    const handlePointerDown = (event: PointerEvent) => {
      if (!panel.contains(event.target as Node) && !trigger?.contains(event.target as Node))
        closeRef.current();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeRef.current();
      }
      if (event.key === "Tab") {
        const focusables = Array.from(
          panel.querySelectorAll<HTMLElement>("button:not(:disabled),input,[tabindex='0']"),
        );
        const first = focusables[0],
          last = focusables[focusables.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", place);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", place);
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus();
    };
  }, [trigger]);
  return { ref, position, motion: popoverMotion(!!reduced, !!instant) };
}
