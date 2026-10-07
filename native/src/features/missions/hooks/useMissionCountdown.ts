import { useCurrentTime } from "@/hooks/useCurrentTime";
import { getCountdown } from "@/features/missions/utils/countdown";
export function useMissionCountdown(deadlineAt?: string) {
  const now = useCurrentTime();
  return getCountdown(deadlineAt, now);
}
