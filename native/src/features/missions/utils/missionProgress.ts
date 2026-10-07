import type { Mission } from "@/features/missions/types/mission.types";

export const completedCheckpoints = (mission: Mission) =>
  mission.checkpoints.filter((c) => c.status === "Complete").length;
