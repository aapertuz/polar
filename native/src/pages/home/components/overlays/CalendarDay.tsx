export function CalendarDay({
  day,
  className,
  ariaLabel,
}: {
  day: number;
  className: string;
  ariaLabel: string;
}) {
  return (
    <span className={className} aria-label={ariaLabel}>
      {day}
    </span>
  );
}
