export function ProgressRing({
  value,
  size = 64,
  label = true,
}: {
  value: number;
  size?: number;
  label?: boolean;
}) {
  const roundedValue = Math.round(value);
  const accessibleLabel = `${roundedValue}% complete`;
  const ringStyle = { width: size, height: size };
  const dashArray = `${value} 100`;
  return (
    <span className="progress-ring" style={ringStyle} role="img" aria-label={accessibleLabel}>
      <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
        <circle
          cx="32"
          cy="32"
          r="27"
          fill="none"
          stroke="currentColor"
          strokeWidth="4"
          opacity=".14"
        />
        <circle
          cx="32"
          cy="32"
          r="27"
          fill="none"
          stroke="currentColor"
          strokeWidth="4"
          strokeLinecap="round"
          pathLength="100"
          strokeDasharray={dashArray}
          transform="rotate(-90 32 32)"
        />
      </svg>
      {label && <span>{roundedValue}%</span>}
    </span>
  );
}
