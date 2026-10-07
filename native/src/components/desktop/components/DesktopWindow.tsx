import { useCallback, useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { motion, useDragControls, useReducedMotion, type MotionValue } from "motion/react";
import { Icon } from "../../ui/Icon";
import { clampPosition, getWindowBounds, type WindowBounds } from "../utils/windowGeometry";

interface Props {
  id: string;
  title: string;
  header: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  workspace: RefObject<HTMLElement | null>;
  draggable: boolean;
  position: { x: MotionValue<number>; y: MotionValue<number> };
  active: boolean;
  onFocus: () => void;
  modal?: boolean;
  onDismiss?: () => void;
  restoreFocusTo?: RefObject<HTMLButtonElement | null>;
}

export function DesktopWindow({
  id,
  title,
  header,
  actions,
  children,
  className = "",
  workspace,
  draggable,
  position,
  active,
  onFocus,
  modal = false,
  onDismiss,
  restoreFocusTo,
}: Props) {
  const ref = useRef<HTMLElement>(null);
  const controls = useDragControls();
  const [bounds, setBounds] = useState<WindowBounds>({ left: 0, right: 0, top: 0, bottom: 0 });
  const [dragging, setDragging] = useState(false);
  const [moving, setMoving] = useState(false);
  const moveOrigin = useRef({ x: 0, y: 0 });
  const moveButton = useRef<HTMLButtonElement>(null);
  const { x, y } = position;
  const reduced = useReducedMotion();
  const dismissRef = useRef(onDismiss);
  dismissRef.current = onDismiss;

  useEffect(() => {
    if (!modal) return;
    const previous = document.activeElement;
    const panel = ref.current;
    panel?.querySelector<HTMLElement>("button")?.focus();
    const keydown = (event: KeyboardEvent) => {
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
    document.addEventListener("keydown", keydown);
    return () => {
      document.removeEventListener("keydown", keydown);
      const target = restoreFocusTo?.current ?? previous;
      if (target instanceof HTMLElement && target.isConnected) target.focus();
    };
  }, [modal, restoreFocusTo]);

  const measure = useCallback(() => {
    if (!draggable || !ref.current || !workspace.current) return;
    const frame = workspace.current.getBoundingClientRect();
    const rect = ref.current.getBoundingClientRect();
    const headerHeight = ref.current.querySelector("header")?.getBoundingClientRect().height ?? 78;
    const next = getWindowBounds(
      frame,
      {
        left: rect.left - x.get(),
        top: rect.top - y.get(),
        width: rect.width,
        height: rect.height,
      },
      headerHeight,
    );
    setBounds(next);
    const clamped = clampPosition({ x: x.get(), y: y.get() }, next);
    x.set(clamped.x);
    y.set(clamped.y);
  }, [draggable, workspace, x, y]);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };
    const observer = new ResizeObserver(update);
    if (ref.current) observer.observe(ref.current);
    if (workspace.current) observer.observe(workspace.current);
    window.addEventListener("resize", update);
    update();
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
      cancelAnimationFrame(frame);
    };
  }, [measure, workspace]);

  useEffect(() => {
    if (!draggable) setMoving(false);
  }, [draggable]);

  return (
    <motion.section
      ref={ref}
      aria-label={`${title} window`}
      role={modal ? "dialog" : undefined}
      aria-modal={modal ? true : undefined}
      data-window={id}
      className={`desktop-window ${className} ${active ? "is-active" : ""} ${dragging ? "is-dragging" : ""}`}
      style={{ x: draggable ? x : 0, y: draggable ? y : 0, zIndex: active ? 15 : 14 }}
      initial={modal && !reduced ? { opacity: 0 } : false}
      animate={{ opacity: 1 }}
      drag={draggable}
      dragControls={controls}
      dragListener={false}
      dragConstraints={bounds}
      dragElastic={0}
      dragMomentum={false}
      onDragStart={() => {
        setDragging(true);
        onFocus();
      }}
      onDragEnd={() => setDragging(false)}
      onPointerDownCapture={onFocus}
      onFocusCapture={onFocus}
    >
      <header
        className={`window-header ${draggable ? "can-drag" : ""}`}
        onPointerDown={(event) => {
          if (
            !draggable ||
            event.button !== 0 ||
            (event.target as HTMLElement).closest("button,input,a")
          )
            return;
          event.preventDefault();
          controls.start(event);
        }}
      >
        <div className="window-header-label">{header}</div>
        <div className="window-header-actions">
          {draggable && (
            <button
              ref={moveButton}
              className="icon-button move-window"
              aria-label={`Move ${title} window`}
              aria-pressed={moving}
              onClick={() => {
                moveOrigin.current = { x: x.get(), y: y.get() };
                setMoving(!moving);
              }}
              onKeyDown={(event) => {
                if (!moving) return;
                if (event.key === "Escape") {
                  event.preventDefault();
                  event.stopPropagation();
                  x.set(moveOrigin.current.x);
                  y.set(moveOrigin.current.y);
                  setMoving(false);
                } else if (event.key === "Enter") {
                  event.preventDefault();
                  setMoving(false);
                } else if (event.key.startsWith("Arrow")) {
                  event.preventDefault();
                  const step = event.shiftKey ? 4 : 16;
                  const next = clampPosition(
                    {
                      x:
                        x.get() +
                        (event.key === "ArrowRight" ? step : event.key === "ArrowLeft" ? -step : 0),
                      y:
                        y.get() +
                        (event.key === "ArrowDown" ? step : event.key === "ArrowUp" ? -step : 0),
                    },
                    bounds,
                  );
                  x.set(next.x);
                  y.set(next.y);
                }
              }}
              onBlur={() => setMoving(false)}
            >
              <Icon name="move" size={16} />
            </button>
          )}
          {actions}
        </div>
      </header>
      {moving && (
        <div className="move-instructions" role="status">
          Arrow keys to move · Shift for precision · Enter to finish · Esc to cancel
        </div>
      )}
      {children}
    </motion.section>
  );
}
