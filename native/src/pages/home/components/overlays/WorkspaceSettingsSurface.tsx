import { Icon } from "@/components/ui/Icon";
import { WorkspaceContextSurface } from "@/features/workspace-context/components/WorkspaceContextSurface";
import { useWorkspaceSettingsSurface } from "@/features/workspaces/hooks/useWorkspaceSettingsSurface";
import type { OverlayRequest } from "@/components/ui/overlay.types";
import type { useWorkspaceSettings } from "@/features/workspaces/hooks/useWorkspaceSettings";

type WorkspaceSettingsModel = ReturnType<typeof useWorkspaceSettings>;

export function WorkspaceSettingsSurface({
  model,
  open,
  close,
}: {
  model: WorkspaceSettingsModel;
  open: (request: OverlayRequest) => void;
  close: () => void;
}) {
  const surface = useWorkspaceSettingsSurface(model, open);
  const workspace = model.workspace;
  const owner = workspace?.role === "owner";
  const account = model.account;

  return (
    <section className="workspace-settings-surface" aria-label="Workspace settings">
      <div
        className="workspace-settings-tabs"
        role="tablist"
        aria-label="Workspace settings sections"
      >
        <button
          id="workspace-general-tab"
          role="tab"
          aria-selected={surface.section === "general"}
          aria-controls="workspace-general-panel"
          onClick={surface.handleSectionGeneral}
        >
          General
        </button>
        <button
          id="workspace-context-tab"
          role="tab"
          aria-selected={surface.section === "context"}
          aria-controls="workspace-context-panel"
          onClick={surface.handleSectionContext}
        >
          Context
        </button>
      </div>

      {surface.section === "general" ? (
        <div id="workspace-general-panel" role="tabpanel" aria-labelledby="workspace-general-tab">
          <div className="workspace-settings-heading">
            <div>
              <span className="workspace-settings-eyebrow">WORKSPACE / GENERAL</span>
              <h3>{workspace?.name ?? "No workspace selected"}</h3>
            </div>
            <button
              className="dark-button"
              onClick={surface.handleOpenCreate}
              disabled={!account.status.authenticated || model.busy}
            >
              <Icon name="plus" size={16} />
              Create workspace
            </button>
          </div>

          {!account.status.authenticated ? (
            <p className="workspace-settings-note">
              Sign in to Polar to create and manage workspaces.
            </p>
          ) : !workspace ? (
            <p className="workspace-settings-note">
              This account has no workspaces. Create one to organize missions and context.
            </p>
          ) : (
            <>
              <form className="workspace-settings-form" onSubmit={surface.handleSaveGeneral}>
                <label>
                  Workspace name
                  <input
                    value={surface.name}
                    onChange={surface.handleNameChange}
                    maxLength={120}
                    disabled={!owner || model.busy}
                  />
                </label>
                <label>
                  Privacy
                  <select
                    value={surface.privacy}
                    onChange={surface.handlePrivacyChange}
                    disabled={!owner || model.busy}
                  >
                    <option value="private">Private · owner only</option>
                    <option value="shared">Shared · members only</option>
                  </select>
                </label>
                <p className="workspace-settings-note">
                  Shared workspaces stay private to their members. Changing privacy never adds or
                  removes members.
                </p>
                {owner && (
                  <div className="workspace-settings-actions">
                    <button className="dark-button" type="submit" disabled={model.busy}>
                      Save changes
                    </button>
                  </div>
                )}
              </form>

              {!owner && (
                <p className="workspace-settings-note">
                  Only the workspace owner can rename this workspace or change its privacy.
                </p>
              )}

              <div className="workspace-settings-field">
                <label htmlFor="workspace-default">Account default</label>
                <select
                  id="workspace-default"
                  value={account.status.defaultWorkspaceId ?? ""}
                  onChange={surface.handleDefaultChange}
                  disabled={model.busy}
                >
                  <option value="">No default workspace</option>
                  {model.workspaces.map((item) => (
                    <option value={item.id} key={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
                <p className="workspace-settings-note">
                  This default is separate from the workspace currently selected on this desktop.
                </p>
              </div>

              {owner && (
                <div className="workspace-settings-delete">
                  <h4>Delete workspace</h4>
                  <p>
                    Permanently remove this workspace, its missions, drafts, and context from Polar.
                    Type <strong>{workspace.name}</strong> to confirm.
                  </p>
                  <input
                    aria-label="Type the workspace name to confirm deletion"
                    value={surface.confirmation}
                    onChange={surface.handleConfirmationChange}
                    placeholder={workspace.name}
                    maxLength={120}
                  />
                  <button
                    className="workspace-delete-button"
                    disabled={model.busy || surface.confirmation.trim() !== workspace.name}
                    onClick={surface.handleDelete}
                  >
                    Delete workspace
                  </button>
                </div>
              )}
            </>
          )}
          {model.failure && (
            <p className="workspace-context-error" role="alert">
              {model.failure}
            </p>
          )}
          {model.message && (
            <p className="workspace-context-success" role="status">
              {model.message}
            </p>
          )}
        </div>
      ) : (
        <div id="workspace-context-panel" role="tabpanel" aria-labelledby="workspace-context-tab">
          {workspace ? (
            <WorkspaceContextSurface
              workspaceId={workspace.id}
              accountId={account.status.userId}
              close={close}
            />
          ) : (
            <p className="workspace-settings-note">
              Select or create a workspace to inspect its saved brief, documents, and notes.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
