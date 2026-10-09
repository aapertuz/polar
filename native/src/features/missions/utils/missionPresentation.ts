import type { MissionPlan } from "@polar/contracts";
import { formatPlanDate } from "@/features/missions/utils/planDates";
import type { Mission } from "@/features/missions/types/mission.types";

interface SourceReference {
  id: string;
  scope: "workspace" | "mission";
  title: string;
  fileName?: string | null;
  provenance: string;
  revision: number;
  contentHash: string;
  cited?: boolean;
  currentState?: "current" | "changed" | "removed";
}
interface PersistedMission {
  id: string;
  name: string;
  outcome: string;
  deadlineAt: string | null;
  assessment: string;
  recommendation: string;
  checkpoints: MissionPlan["checkpoints"];
  constraints: string[];
  successCriteria: string[];
  risks: string[];
  assumptions: string[];
  actions: {
    title: string;
    detail: string;
    priority: string;
    status: string;
    dependencies?: string[];
    dueOn?: string | null;
  }[];
  sources?: SourceReference[];
}

export function presentMission(value: PersistedMission): Mission {
  const checkpoints = value.checkpoints.map((checkpoint) => ({
    name: checkpoint.name,
    detail: checkpoint.detail,
    status: "Upcoming" as const,
    date: formatPlanDate(checkpoint.dueOn),
    dueOn: checkpoint.dueOn ?? null,
    actions: checkpoint.actions.map(({ title, detail, dependsOn, dueOn }) => ({
      title,
      detail,
      dependsOn,
      dueOn: dueOn ?? null,
      date: formatPlanDate(dueOn),
    })),
  }));
  const upcoming = value.actions
    .filter((action) => action.status === "upcoming")
    .map((action) => ({
      title: action.title,
      timing: "Upcoming",
      dueOn: action.dueOn ?? null,
      priority:
        action.priority === "high"
          ? ("High" as const)
          : action.priority === "medium"
            ? ("Medium" as const)
            : undefined,
      owner: "You",
      detail: action.detail,
    }));
  return {
    id: value.id,
    name: value.name,
    outcome: value.outcome,
    deadlineAt: value.deadlineAt ?? undefined,
    assessment: value.assessment,
    recommendation: value.recommendation,
    proposedChange: "",
    constraint: value.constraints.join(" · ") || "No constraints provided",
    successCriteria: value.successCriteria,
    risks: value.risks,
    assumptions: value.assumptions,
    checkpoints,
    actionCount: value.actions.length,
    units: { received: 0, target: 0, label: "" },
    people: [],
    evidence: (value.sources ?? []).map((source) => ({
      id: source.id,
      title: source.title,
      source: source.scope,
      date: `Revision ${source.revision}${source.cited ? " · cited" : " · supplied"}${source.currentState && source.currentState !== "current" ? ` · ${source.currentState} since activation` : ""}`,
      scope: source.scope,
      revision: source.revision,
      contentHash: source.contentHash,
      cited: source.cited,
      currentState: source.currentState,
    })),
    upcoming,
    activity: [
      {
        title: "You created this mission",
        timing: "Just now",
        icon: "plus",
        detail: "Mission activated from a reviewed proposal.",
      },
    ],
  };
}

export function presentProposal(
  id: string,
  plan: MissionPlan,
  sources: { id: string; fileName: string; contentHash: string; provenance: string }[],
  manifest?: {
    sources: {
      scope: "workspace" | "mission";
      id: string;
      title: string;
      revision: number;
      contentHash: string;
      provenance: string;
    }[];
  } | null,
  citations: {
    scope: "workspace" | "mission";
    sourceId: string;
    revision: number;
    excerptId: string;
  }[] = [],
): Mission {
  const mission = presentMission({
    id,
    name: plan.name,
    outcome: plan.outcome,
    deadlineAt: plan.deadlineAt,
    assessment: plan.assessment,
    recommendation: plan.recommendation,
    checkpoints: plan.checkpoints,
    constraints: plan.constraints,
    successCriteria: plan.successCriteria,
    risks: plan.risks,
    assumptions: plan.assumptions,
    actions: plan.checkpoints.flatMap((checkpoint) =>
      checkpoint.actions.map((action) => ({ ...action, status: "upcoming" })),
    ),
    sources: [
      ...(manifest?.sources
        .filter((source) => source.scope === "workspace")
        .map((source) => ({
          ...source,
          cited: citations.some(
            (citation) => citation.scope === "workspace" && citation.sourceId === source.id,
          ),
        })) ?? []),
      ...sources.map((source) => ({
        ...source,
        scope: "mission" as const,
        title: source.fileName,
        revision: 1,
        cited: citations.some(
          (citation) => citation.scope === "mission" && citation.sourceId === source.id,
        ),
      })),
    ],
  });
  return { ...mission, upcoming: [] };
}
