import { motion } from "motion/react";
import type { ReactNode } from "react";
import { useAnimatedContent } from "@/components/ui/hooks/useAnimatedContent";

export function AnimatedContent({
  children,
  instant = false,
  className = "",
}: {
  children: ReactNode;
  instant?: boolean;
  className?: string;
}) {
  const { present, motion: motionProps } = useAnimatedContent(instant);
  return (
    <motion.div className={className} inert={!present} {...motionProps}>
      {children}
    </motion.div>
  );
}
