export function EmptyWorkspace({
  missionLoadFailed,
  onRetry,
  hasWorkspace,
  authenticated,
  onCreateWorkspace,
  onOpenSettings,
}: {
  missionLoadFailed: boolean;
  onRetry: () => void;
  hasWorkspace: boolean;
  authenticated: boolean;
  onCreateWorkspace: () => void;
  onOpenSettings: () => void;
}) {
  return (
    <section className="workspace-empty-message" aria-labelledby="welcome-title">
      <h1 id="welcome-title">
        {!hasWorkspace
          ? authenticated
            ? "No workspace selected."
            : "Sign in to create a workspace."
          : missionLoadFailed
            ? "Your missions couldn't load."
            : "Make your next move clear."}
      </h1>
      <p>
        {!hasWorkspace
          ? authenticated
            ? "Create or select a workspace to see its missions and context."
            : "Connect a Polar account in settings to create and sync a workspace."
          : missionLoadFailed
            ? "Your saved missions are unchanged. Check your connection and try again."
            : "No missions yet. Start with an outcome you want to achieve."}
      </p>
      {!hasWorkspace && authenticated && (
        <button className="workspace-empty-retry" onClick={onCreateWorkspace}>
          Create workspace
        </button>
      )}
      {!hasWorkspace && !authenticated && (
        <button className="workspace-empty-retry" onClick={onOpenSettings}>
          Open account settings
        </button>
      )}
      {hasWorkspace && missionLoadFailed && (
        <button className="workspace-empty-retry" onClick={onRetry}>
          Try again
        </button>
      )}
    </section>
  );
}
