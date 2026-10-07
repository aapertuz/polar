import { useState } from "react";
import { missions } from "@/features/missions/fixtures/missions.fixtures";
export function useSearchOverlay(choose: (id: string) => void) {
  const [query, setQuery] = useState("");
  const filteredMissions = missions.filter((mission) =>
    `${mission.name} ${mission.outcome}`.toLowerCase().includes(query.toLowerCase()),
  );
  const handleQueryChange = (event: React.ChangeEvent<HTMLInputElement>) =>
    setQuery(event.target.value);
  const handleChoose = (event: React.MouseEvent<HTMLButtonElement>) =>
    choose(event.currentTarget.dataset.missionId!);
  return { query, filteredMissions, handleQueryChange, handleChoose };
}
