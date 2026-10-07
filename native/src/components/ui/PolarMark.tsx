export function PolarMark({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" fill="none">
      <path
        d="M26.9 17.4A11 11 0 1 1 18 5.2"
        stroke="currentColor"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <circle cx="25.2" cy="8.7" r="3.2" fill="var(--red)" />
    </svg>
  );
}
