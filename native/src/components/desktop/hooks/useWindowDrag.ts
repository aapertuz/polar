import { useState } from "react";
import { useDragControls } from "motion/react";
export function useWindowDrag(draggable: boolean, onFocus: () => void) {
  const controls = useDragControls();
  const [dragging, setDragging] = useState(false);
  const handleDragStart = () => {
    setDragging(true);
    onFocus();
  };
  const handleDragEnd = () => setDragging(false);
  const handleHeaderPointerDown = (event: React.PointerEvent<HTMLElement>) => {
    if (!draggable || event.button !== 0 || (event.target as HTMLElement).closest("button,input,a"))
      return;
    event.preventDefault();
    controls.start(event);
  };
  return { controls, dragging, handleDragStart, handleDragEnd, handleHeaderPointerDown };
}
