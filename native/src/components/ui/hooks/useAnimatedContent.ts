import { useIsPresent, useReducedMotion } from "motion/react";
import { contentMotion } from "@/components/ui/motionPolicy";
export function useAnimatedContent(instant: boolean) {
  const present = useIsPresent();
  const reduced = useReducedMotion();
  return { present, motion: contentMotion(!!reduced, instant, present) };
}
