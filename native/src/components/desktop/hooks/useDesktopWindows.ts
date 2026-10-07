import { useState } from "react";
import { useMotionValue } from "motion/react";
type WindowId = "mission" | "timeline";

export function useDesktopWindows() {
  const mission = { x: useMotionValue(0), y: useMotionValue(0) };
  const timeline = { x: useMotionValue(0), y: useMotionValue(0) };
  const [active, setActive] = useState<WindowId>("mission");
  const reset = () => {
    for (const window of [mission, timeline]) {
      window.x.set(0);
      window.y.set(0);
    }
  };
  return { mission, timeline, active, focus: setActive, reset };
}
