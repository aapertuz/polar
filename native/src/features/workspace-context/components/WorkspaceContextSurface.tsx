import { Icon } from "@/components/ui/Icon";
import { useWorkspaceContextSurface } from "@/features/workspace-context/hooks/useWorkspaceContextSurface";

export function WorkspaceContextSurface({ close }: { close: () => void }) {
  const model = useWorkspaceContextSurface();
  return (
    <section className="workspace-context-surface" aria-label="Workspace context">
      <p className="overlay-muted">
        {model.context?.workspaceName ?? "Your workspace"}. Members can use synchronized text;
        original files stay on this device.
      </p>
      {model.canEdit ? (
        <>
          <label className="workspace-context-label" htmlFor="workspace-brief">
            Company and workspace brief
          </label>
          <textarea
            id="workspace-brief"
            className="workspace-context-textarea"
            value={model.brief}
            maxLength={8000}
            onChange={model.handleBriefChange}
            placeholder="Describe your products, customers, team, policies, or constraints."
          />
          <div className="workspace-context-actions">
            <span>{model.brief.length}/8,000</span>
            <button
              className="dark-button"
              onClick={model.handleSaveBrief}
              disabled={model.busy || model.brief.length > 8000}
            >
              Save brief
            </button>
          </div>
          {model.briefSaved && (
            <p className="workspace-context-success" role="status" aria-live="polite">
              Brief saved.
            </p>
          )}
        </>
      ) : (
        <p className="workspace-context-readonly">Workspace owners manage this shared context.</p>
      )}

      <div className="workspace-context-heading">
        <h3>Documents and notes</h3>
        <span>{model.context?.sources.length ?? 0}/50</span>
      </div>
      {!model.context?.sources.length && (
        <p className="workspace-context-empty">
          No shared sources yet. Add a company brief or a reusable document.
        </p>
      )}
      <div className="workspace-context-sources">
        {model.context?.sources.map((source) => (
          <article className="workspace-context-source" key={source.id}>
            {model.editing === source.id ? (
              <div className="workspace-context-edit">
                <label>
                  Title
                  <input
                    value={model.editTitle}
                    onChange={model.handleEditTitleChange}
                    maxLength={255}
                  />
                </label>
                <label>
                  Extracted text
                  <textarea
                    value={model.editText}
                    onChange={model.handleEditTextChange}
                    maxLength={1000000}
                  />
                </label>
                <div className="workspace-context-actions">
                  <button className="quiet-button" onClick={model.handleCancelEdit}>
                    Cancel
                  </button>
                  <button
                    className="dark-button"
                    data-source-id={source.id}
                    disabled={model.busy}
                    onClick={model.handleSaveSource}
                  >
                    Save changes
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="workspace-context-source-title">
                  <Icon name={source.kind === "document" ? "file" : "folder"} size={16} />
                  <div>
                    <strong>{source.title}</strong>
                    <span>
                      {source.kind === "document" ? source.fileName : "Note"} · revision{" "}
                      {source.revision}
                    </span>
                  </div>
                </div>
                <details>
                  <summary>Inspect extracted text</summary>
                  <pre>{source.extractedText}</pre>
                </details>
                {model.canEdit && (
                  <div className="workspace-context-actions">
                    <button
                      className="quiet-button"
                      data-source-id={source.id}
                      onClick={
                        source.kind === "document"
                          ? model.handleReplaceDocument
                          : model.handleBeginEdit
                      }
                    >
                      {source.kind === "document" ? "Replace document" : "Edit note"}
                    </button>
                    <button
                      className="quiet-button"
                      data-source-id={source.id}
                      disabled={model.busy}
                      onClick={model.handleArchive}
                    >
                      Remove from context
                    </button>
                  </div>
                )}
              </>
            )}
          </article>
        ))}
      </div>

      {model.canEdit && (
        <>
          <div className="workspace-context-actions">
            <button
              className="quiet-button"
              disabled={model.busy || (model.context?.sources.length ?? 0) >= 50}
              onClick={model.handleImportDocument}
            >
              <Icon name="plus" size={16} />
              Add document
            </button>
          </div>
          <label className="workspace-context-label" htmlFor="workspace-note-title">
            Add notes
          </label>
          <input
            id="workspace-note-title"
            className="workspace-context-input"
            value={model.noteTitle}
            maxLength={255}
            onChange={model.handleNoteTitleChange}
            placeholder="Note title"
          />
          <textarea
            className="workspace-context-textarea workspace-note-input"
            value={model.noteText}
            maxLength={100000}
            onChange={model.handleNoteTextChange}
            placeholder="Add reusable context for future missions."
          />
          <div className="workspace-context-actions">
            <span>{model.noteText.length}/100,000</span>
            <button
              className="dark-button"
              disabled={model.busy || !model.noteTitle.trim() || !model.noteText.trim()}
              onClick={model.handleAddNote}
            >
              Save note
            </button>
          </div>
        </>
      )}
      {model.failure && (
        <p className="workspace-context-error" role="alert">
          {model.failure}
        </p>
      )}
      <div className="workspace-context-footer">
        <span>Workspace sources are inherited by future mission reasoning.</span>
        <button className="quiet-button" onClick={close}>
          Done
        </button>
      </div>
    </section>
  );
}
