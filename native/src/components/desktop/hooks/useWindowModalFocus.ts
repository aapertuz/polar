import { useEffect, useRef, type RefObject } from "react";
export function useWindowModalFocus(
  ref: RefObject<HTMLElement | null>,
  modal: boolean,
  onDismiss: (() => void) | undefined,
  restoreFocusTo: RefObject<HTMLButtonElement | null> | undefined,
) {
  const dismissRef = useRef(onDismiss);
  dismissRef.current = onDismiss;
  useEffect(() => {
    if (!modal) return;
    const previous = document.activeElement;
    const panel = ref.current;
    panel?.querySelector<HTMLElement>("button")?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!panel?.contains(document.activeElement)) return;
      if (event.key === "Escape") {
        event.preventDefault();
        dismissRef.current?.();
      } else if (event.key === "Tab") {
        const items = Array.from(
          panel.querySelectorAll<HTMLElement>("button:not(:disabled),[tabindex='0']"),
        );
        const first = items[0],
          last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      const target = restoreFocusTo?.current ?? previous;
      if (target instanceof HTMLElement && target.isConnected) target.focus();
    };
  }, [modal, ref, restoreFocusTo]);
}
