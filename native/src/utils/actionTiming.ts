const DAY_MS = 86_400_000;

export function actionTiming(dueOn: string | null | undefined, now: number): string {
  if (!dueOn || !/^\d{4}-\d{2}-\d{2}$/.test(dueOn)) return "Upcoming";
  const [year, month, day] = dueOn.split("-").map(Number);
  const due = new Date(0);
  due.setUTCFullYear(year, month - 1, day);
  due.setUTCHours(0, 0, 0, 0);
  if (due.toISOString().slice(0, 10) !== dueOn) return "Upcoming";
  const today = new Date(now);
  const todayDay = new Date(0);
  todayDay.setUTCFullYear(today.getFullYear(), today.getMonth(), today.getDate());
  todayDay.setUTCHours(0, 0, 0, 0);
  const distance = (due.getTime() - todayDay.getTime()) / DAY_MS;
  if (distance === 0) return "Today";
  if (distance === 1) return "Tomorrow";
  if (distance > 1 && distance < 7) return "Next";
  if (distance >= 7) return "Upcoming";
  const suffix =
    day % 100 >= 11 && day % 100 <= 13 ? "th" : ({ 1: "st", 2: "nd", 3: "rd" }[day % 10] ?? "th");
  const monthLabel = due.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" });
  const yearLabel = year === today.getFullYear() ? "" : `, ${year}`;
  const date = `${monthLabel} ${day}${suffix}${yearLabel}`;
  return distance < 0 ? `Overdue · ${date}` : `By ${date}`;
}
