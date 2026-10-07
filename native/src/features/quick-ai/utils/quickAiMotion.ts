// Keep the top edge fixed while the bottom edge travels through the full panel height.
export function quickAiExpansionMotion(reduced: boolean, present: boolean) {
  const collapsedHeight = reduced ? "auto" : 48;
  return {
    surfaceMotion: {
      initial: { height: collapsedHeight, opacity: reduced ? 0 : 1 },
      animate: { height: present ? "auto" : collapsedHeight, opacity: present ? 1 : 0 },
      transition: {
        height: {
          duration: reduced ? 0 : present ? 0.5 : 0.28,
          ease: [0.22, 0.7, 0.2, 1] as const,
        },
        opacity: { duration: 0.12, delay: present || reduced ? 0 : 0.16 },
      },
    },
    contentMotion: {
      initial: { opacity: 0 },
      animate: { opacity: present ? 1 : 0 },
      transition: { duration: 0.16, delay: present && !reduced ? 0.12 : 0 },
    },
  };
}
