import { useEffect, useRef, useState, type RefObject } from "react";
import type { MotionValue } from "motion/react";
import { DESKTOP_DEFAULTS } from "@/components/desktop/constants/desktop.constants";
import {
  RESIZE_EDGES,
  resizeWindow,
  windowResizeLimits,
} from "@/components/desktop/utils/windowResize";
import type { ResizeEdge, ResizeFrame } from "@/components/desktop/utils/windowResize";

interface ResizeGesture {
  pointerId: number;
  edge: ResizeEdge;
  frame: ResizeFrame;
  pointer: { x: number; y: number };
  position: { x: number; y: number };
}

export function useWindowResize(
  ref: RefObject<HTMLElement | null>,
  workspace: RefObject<HTMLElement | null>,
  x: MotionValue<number>,
  y: MotionValue<number>,
) {
  const [size, setSize] = useState<{ width: number; height: number }>();
  const gesture = useRef<ResizeGesture | null>(null);
  const [resizing, setResizing] = useState(false);
  const getLimits = () =>
    windowResizeLimits(
      workspace.current?.getBoundingClientRect() ?? {
        width: window.innerWidth,
        height: window.innerHeight,
      },
    );
  const applyResize = (
    frame: ResizeFrame,
    edge: ResizeEdge,
    delta: { x: number; y: number },
    position: { x: number; y: number },
  ) => {
    const next = resizeWindow(frame, edge, delta, getLimits());
    x.set(position.x + next.left - frame.left);
    y.set(position.y + next.top - frame.top);
    setSize({ width: next.width, height: next.height });
  };
  const handleResizeStart = (event: React.PointerEvent<HTMLButtonElement>) => {
    const edge = event.currentTarget.dataset.resizeEdge as ResizeEdge;
    if (event.button !== 0 || gesture.current || !RESIZE_EDGES.includes(edge) || !ref.current)
      return;
    event.preventDefault();
    event.stopPropagation();
    gesture.current = {
      pointerId: event.pointerId,
      edge,
      frame: ref.current.getBoundingClientRect(),
      pointer: { x: event.clientX, y: event.clientY },
      position: { x: x.get(), y: y.get() },
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    setResizing(true);
  };
  const handleResizeMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    const current = gesture.current;
    if (!current || current.pointerId !== event.pointerId) return;
    applyResize(
      current.frame,
      current.edge,
      { x: event.clientX - current.pointer.x, y: event.clientY - current.pointer.y },
      current.position,
    );
  };
  const handleResizeEnd = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (gesture.current?.pointerId !== event.pointerId) return;
    gesture.current = null;
    setResizing(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
  };
  const handleResizeKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (!event.key.startsWith("Arrow") || !ref.current || gesture.current) return;
    event.preventDefault();
    event.stopPropagation();
    const step = event.shiftKey
      ? DESKTOP_DEFAULTS.preciseKeyboardMoveStep
      : DESKTOP_DEFAULTS.keyboardMoveStep;
    applyResize(
      ref.current.getBoundingClientRect(),
      "se",
      {
        x: event.key === "ArrowRight" ? step : event.key === "ArrowLeft" ? -step : 0,
        y: event.key === "ArrowDown" ? step : event.key === "ArrowUp" ? -step : 0,
      },
      { x: x.get(), y: y.get() },
    );
  };
  useEffect(() => {
    const recoverSize = () => {
      gesture.current = null;
      setResizing(false);
      const frame = workspace.current?.getBoundingClientRect() ?? {
        width: window.innerWidth,
        height: window.innerHeight,
      };
      const limits = windowResizeLimits(frame);
      setSize((current) =>
        current
          ? {
              width: Math.min(limits.maxWidth, Math.max(limits.minWidth, current.width)),
              height: Math.min(limits.maxHeight, Math.max(limits.minHeight, current.height)),
            }
          : current,
      );
    };
    window.addEventListener("resize", recoverSize);
    return () => window.removeEventListener("resize", recoverSize);
  }, [workspace]);
  return {
    size,
    resizing,
    handleResizeStart,
    handleResizeMove,
    handleResizeEnd,
    handleResizeKeyDown,
  };
}
