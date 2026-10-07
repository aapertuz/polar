import { useCallback, useEffect, useState, type RefObject } from "react";
import type { MotionValue } from "motion/react";
import {
  clampPosition,
  getWindowBounds,
  DEFAULT_WINDOW_HEADER_HEIGHT,
  type WindowBounds,
} from "@/components/desktop/utils/windowGeometry";
export function useWindowBounds(
  ref: RefObject<HTMLElement | null>,
  workspace: RefObject<HTMLElement | null>,
  draggable: boolean,
  x: MotionValue<number>,
  y: MotionValue<number>,
) {
  const [bounds, setBounds] = useState<WindowBounds>({ left: 0, right: 0, top: 0, bottom: 0 });
  const measure = useCallback(() => {
    if (!draggable || !ref.current || !workspace.current) return;
    const frame = workspace.current.getBoundingClientRect();
    const rect = ref.current.getBoundingClientRect();
    const headerHeight =
      ref.current.querySelector("header")?.getBoundingClientRect().height ??
      DEFAULT_WINDOW_HEADER_HEIGHT;
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
  }, [draggable, ref, workspace, x, y]);
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
  }, [measure, ref, workspace]);
  return bounds;
}
