import { planDetailPoints } from "@/features/missions/utils/planDetailPoints";

export function PlanDetail({ detail }: { detail: string }) {
  const points = planDetailPoints(detail);
  return (
    <ul className="plan-detail-points">
      {points.map((point, index) => (
        <li key={`${index}-${point}`}>{point}</li>
      ))}
    </ul>
  );
}
