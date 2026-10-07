export function getCountdown(deadlineAt: string | undefined, now: number) {
  const timestamp = deadlineAt ? Date.parse(deadlineAt) : NaN;
  if (!Number.isFinite(timestamp) || !Number.isFinite(now)) return null;
  const minutes = Math.ceil(Math.max(0, timestamp - now) / 60_000);
  return {
    days: Math.floor(minutes / 1440),
    hours: Math.floor((minutes % 1440) / 60),
    minutes: minutes % 60,
    expired: timestamp <= now,
  };
}
