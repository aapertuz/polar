export type IconName =
  | "search"
  | "grid"
  | "file"
  | "settings"
  | "plus"
  | "calendar"
  | "people"
  | "bell"
  | "sun"
  | "arrow"
  | "more"
  | "close"
  | "check"
  | "clock"
  | "folder"
  | "move"
  | "reset"
  | "chevron";
const paths: Partial<Record<IconName, string>> = {
  search: "M21 21l-5-5M18 10.5a7.5 7.5 0 1 1-15 0 7.5 7.5 0 0 1 15 0",
  file: "M14 3H5v18h14V8l-5-5ZM14 3v5h5M8 12h8M8 16h6",
  settings:
    "m9 3-.6 2.4-2.1 1.2L4 6l-2 3.5 1.7 1.7v2L2 15l2 3.5 2.3-.6 2.1 1.2L9 21h4l.6-2.4 2.1-1.2 2.3.6 2-3.5-1.7-1.7v-2L20 9l-2-3.5-2.3.6-2.1-1.2L13 3H9ZM15 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0",
  plus: "M12 5v14M5 12h14",
  calendar: "M4 5h16v16H4V5ZM8 2v6M16 2v6M4 10h16",
  people:
    "M16 21v-3a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v3h14ZM13 6a4 4 0 1 1-8 0 4 4 0 0 1 8 0M17 3a4 4 0 0 1 0 8M18 14a4 4 0 0 1 4 4v3h-3",
  bell: "M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9ZM10 21h4",
  sun: "M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5l1.5 1.5M5 19l1.5-1.5M17.5 6.5l1.5-1.5M17 12a5 5 0 1 1-10 0 5 5 0 0 1 10 0",
  arrow: "M4 12h16M14 6l6 6-6 6",
  close: "M6 6l12 12M6 18l12-12",
  check: "M5 12l4 4L19 6",
  clock: "M12 7v5l3 2M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0",
  folder: "M3 6h6l2 3h10v12H3V6ZM3 6V3h7l2 3h7v3",
  move: "M12 2v20M2 12h20M9 5l3-3 3 3M9 19l3 3 3-3M5 9l-3 3 3 3M19 9l3 3-3 3",
  reset: "M3 10a9 9 0 1 1 0 5M3 4v6h6",
  chevron: "m6 9 6 6 6-6",
};
export function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {name === "grid" ? (
        [5, 12, 19].flatMap((x) =>
          [5, 12, 19].map((y) => (
            <circle key={`${x}-${y}`} cx={x} cy={y} r="1.8" fill="currentColor" stroke="none" />
          )),
        )
      ) : name === "more" ? (
        [5, 12, 19].map((x) => (
          <circle key={x} cx={x} cy="12" r="1.6" fill="currentColor" stroke="none" />
        ))
      ) : (
        <path d={paths[name]} />
      )}
    </svg>
  );
}
