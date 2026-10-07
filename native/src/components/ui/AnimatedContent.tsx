import { motion, useIsPresent, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";
import { contentMotion } from "./motionPolicy";

export function AnimatedContent({
  children,
  instant = false,
  className = "",
}: {
  children: ReactNode;
  instant?: boolean;
  className?: string;
}) {
  const present = useIsPresent();
  const reduced = useReducedMotion();
  return (
    <motion.div
      className={className}
      inert={!present}
      {...contentMotion(!!reduced, instant, present)}
    >
      {children}
    </motion.div>
  );
}
