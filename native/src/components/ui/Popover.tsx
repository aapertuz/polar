import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { motion, useReducedMotion } from "motion/react";
import { Icon } from "./Icon";
import { popoverMotion } from "./motionPolicy";

export function Popover({
  title,
  children,
  onClose,
  trigger,
  instant,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  trigger?: HTMLElement;
  instant?: boolean;
}) {
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
    const pointer = (e: PointerEvent) => {
      if (!panel.contains(e.target as Node) && !trigger?.contains(e.target as Node))
        closeRef.current();
    };
    const keyboard = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        closeRef.current();
      }
      if (e.key === "Tab") {
        const focusables = Array.from(
          panel.querySelectorAll<HTMLElement>("button:not(:disabled),input,[tabindex='0']"),
        );
        const first = focusables[0],
          last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("pointerdown", pointer);
    document.addEventListener("keydown", keyboard);
    window.addEventListener("resize", place);
    return () => {
      document.removeEventListener("pointerdown", pointer);
      document.removeEventListener("keydown", keyboard);
      window.removeEventListener("resize", place);
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus();
    };
  }, [trigger]);
  return createPortal(
    <motion.div
      ref={ref}
      role="dialog"
      aria-labelledby="popover-title"
      className="demo-popover"
      style={{ left: position.left, top: position.top, transformOrigin: position.origin }}
      {...popoverMotion(!!reduced, !!instant)}
    >
      <div className="popover-heading">
        <h2 id="popover-title">{title}</h2>
        <button className="icon-button" aria-label={`Close ${title}`} onClick={onClose}>
          <Icon name="close" size={18} />
        </button>
      </div>
      {children}
    </motion.div>,
    document.body,
  );
}
