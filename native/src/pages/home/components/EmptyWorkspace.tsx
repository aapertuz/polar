export function EmptyWorkspace({
  missionLoadFailed,
  onRetry,
}: {
  missionLoadFailed: boolean;
  onRetry: () => void;
}) {
  return (
    <section className="workspace-empty-message" aria-labelledby="welcome-title">
      <h1 id="welcome-title">
        {missionLoadFailed ? "Your missions couldn't load." : "Make your next move clear."}
      </h1>
      <p>
        {missionLoadFailed
          ? "Your saved missions are unchanged. Check your connection and try again."
          : "No missions yet. Start with an outcome you want to achieve."}
      </p>
      {missionLoadFailed && (
        <button className="workspace-empty-retry" onClick={onRetry}>
          Try again
        </button>
      )}
    </section>
  );
}
