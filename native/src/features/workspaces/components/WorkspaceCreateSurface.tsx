import { useWorkspaceCreateSurface } from "@/features/workspaces/hooks/useWorkspaceCreateSurface";
import type { useWorkspaceSettings } from "@/features/workspaces/hooks/useWorkspaceSettings";

type WorkspaceSettingsModel = ReturnType<typeof useWorkspaceSettings>;

export function WorkspaceCreateSurface({
  model,
  close,
}: {
  model: WorkspaceSettingsModel;
  close: () => void;
}) {
  const surface = useWorkspaceCreateSurface(model, close);
  return (
    <form className="workspace-settings-form workspace-create-form" onSubmit={surface.handleSubmit}>
      <p className="workspace-settings-note">
        {model.account.status.authenticated
          ? "Workspaces are private to their owner or members. Shared never means public."
          : "Sign in to Polar from account settings before creating a workspace."}
      </p>
      <label>
        Workspace name
        <input
          autoFocus
          value={surface.name}
          onChange={surface.handleNameChange}
          maxLength={120}
          required
          placeholder="Product launch"
        />
      </label>
      <label>
        Privacy
        <select value={surface.privacy} onChange={surface.handlePrivacyChange}>
          <option value="private">Private · owner only</option>
          <option value="shared">Shared · members only</option>
        </select>
      </label>
      {model.failure && (
        <p className="workspace-context-error" role="alert">
          {model.failure}
        </p>
      )}
      <div className="workspace-settings-actions">
        <button className="quiet-button" type="button" onClick={close}>
          Cancel
        </button>
        <button
          className="dark-button"
          type="submit"
          disabled={!model.account.status.authenticated || model.busy || !surface.name.trim()}
        >
          {model.busy ? "Creating…" : "Create workspace"}
        </button>
      </div>
    </form>
  );
}
