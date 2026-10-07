import { useEffect, useRef, useState } from "react";
import type { MotionValue } from "motion/react";
import { clampPosition, type WindowBounds } from "@/components/desktop/utils/windowGeometry";
import { DESKTOP_DEFAULTS } from "@/components/desktop/constants/desktop.constants";
export function useWindowMovement(
  draggable: boolean,
  x: MotionValue<number>,
  y: MotionValue<number>,
  bounds: WindowBounds,
) {
  const [moving, setMoving] = useState(false);
  const moveOrigin = useRef({ x: 0, y: 0 });
  const moveButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!draggable) setMoving(false);
  }, [draggable]);
  const handleMoveClick = () => {
    moveOrigin.current = { x: x.get(), y: y.get() };
    setMoving(!moving);
  };
  const handleMoveKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
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
      const step = event.shiftKey
        ? DESKTOP_DEFAULTS.preciseKeyboardMoveStep
        : DESKTOP_DEFAULTS.keyboardMoveStep;
      const next = clampPosition(
        {
          x: x.get() + (event.key === "ArrowRight" ? step : event.key === "ArrowLeft" ? -step : 0),
          y: y.get() + (event.key === "ArrowDown" ? step : event.key === "ArrowUp" ? -step : 0),
        },
        bounds,
      );
      x.set(next.x);
      y.set(next.y);
    }
  };
  const handleMoveBlur = () => setMoving(false);
  return { moving, moveButton, handleMoveClick, handleMoveKeyDown, handleMoveBlur };
}
