export function formatPlanDate(dueOn: string | null | undefined): string {
  if (!dueOn || !/^\d{4}-\d{2}-\d{2}$/.test(dueOn)) return "";
  const date = new Date(`${dueOn}T00:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== dueOn) return "";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}
