export const MOTION_TIMINGS = {
  contentEnter: 0.22,
  contentExit: 0.12,
  popoverEnter: 0.18,
  tabIndicator: 0.16,
} as const;
export function contentMotion(reduced: boolean, instant: boolean, present: boolean) {
  return {
    initial: instant ? (false as const) : { opacity: 0, y: reduced ? 0 : 4 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: 0 },
    transition: {
      duration: instant ? 0 : present ? MOTION_TIMINGS.contentEnter : MOTION_TIMINGS.contentExit,
    },
  };
}

export function popoverMotion(reduced: boolean, instant: boolean) {
  return {
    initial: instant ? (false as const) : { opacity: 0, scale: reduced ? 1 : 0.98 },
    animate: { opacity: 1, scale: 1 },
    transition: { duration: instant ? 0 : MOTION_TIMINGS.popoverEnter },
  };
}
