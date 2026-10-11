import { useEffect, useRef } from "react";
import { invoke, isTauri } from "@tauri-apps/api/core";
import type { Mission } from "@/features/missions/types/mission.types";

interface Options {
  accountId: string | null;
  authenticated: boolean;
  workspaceId: string | null;
  refreshMissions: () => Promise<Mission[]>;
  onAttention: (items: AttentionItem[]) => void;
}

export interface AttentionItem {
  id: string;
  missionId: string;
  actionId: string | null;
  title: string;
  reason: string;
  createdAt: string;
}

export function useBackgroundMissionWorker({
  accountId,
  authenticated,
  workspaceId,
  refreshMissions,
  onAttention,
}: Options) {
  const busy = useRef(false);
  const lastActionAttempts = useRef(new Map<string, number>());
  const scopeRef = useRef("");
  const scope = accountId && workspaceId ? `${accountId}:${workspaceId}` : "";
  scopeRef.current = scope;

  useEffect(() => {
    if (!isTauri() || !authenticated || !workspaceId || !accountId) return;
    let active = true;
    const run = async () => {
      if (!active || busy.current) return;
      const originScope = `${accountId}:${workspaceId}`;
      if (scopeRef.current !== originScope) return;
      busy.current = true;
      try {
        const missions = await refreshMissions();
        if (!active || scopeRef.current !== originScope) return;
        for (const mission of missions) {
          for (const action of mission.actions ?? []) {
            if (
              action.status === "completed" ||
              action.evidenceStatus !== "awaiting_evaluation" ||
              !action.id
            )
              continue;
            const lastAttempt = lastActionAttempts.current.get(action.id) ?? 0;
            if (Date.now() - lastAttempt < 120_000) continue;
            lastActionAttempts.current.set(action.id, Date.now());
            try {
              await invoke("polar_action_evaluate", {
                workspaceId,
                missionId: mission.id,
                actionId: action.id,
              });
              if (!active || scopeRef.current !== originScope) return;
              await refreshMissions();
            } catch {
              // Pending state remains durable; retry after a short backoff.
            }
          }
        }
        if (!active || scopeRef.current !== originScope) return;
        const attention = await invoke<AttentionItem[]>("polar_attention", { workspaceId });
        if (!active || scopeRef.current !== originScope) return;
        onAttention(attention);
        const result = await invoke<string>("polar_ai_work_once", { workspaceId });
        if (result === "completed" && active && scopeRef.current === originScope)
          await refreshMissions();
      } catch {
        // The local worker retries while Polar remains running and authenticated.
      } finally {
        busy.current = false;
      }
    };
    void run();
    const timer = window.setInterval(() => void run(), 30_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [accountId, authenticated, onAttention, refreshMissions, workspaceId]);
}
