import { motion } from "motion/react";
import { Icon } from "@/components/ui/Icon";
import type { QuickAiSession } from "@/features/quick-ai/utils/quickAiSession";
import { useQuickAiSurface } from "@/features/quick-ai/hooks/useQuickAiSurface";
import type { useQuickAi } from "@/features/quick-ai/hooks/useQuickAi";
import "@/features/quick-ai/styles/quick-ai.css";

type QuickAiModel = ReturnType<typeof useQuickAi>;
export function QuickAiSurface({
  session,
  model,
  openWorkspaceContext,
}: {
  mission: unknown;
  session: QuickAiSession;
  model: QuickAiModel;
  openWorkspaceContext: (trigger?: HTMLElement) => void;
}) {
  const {
    surfaceRef,
    isPresent,
    inputDraft,
    surfaceMotion,
    contentMotion,
    handleAnimationComplete,
    handleKeyDown,
    handleBackdropClick,
    handleSubmit,
    handleInputChange,
    handlePromptKeyDown,
    handleAttach,
    handlePasteChange,
    handleAddPasted,
    handleRemoveSource,
    handleReview,
    handleRetry,
    handleRefreshPlan,
    handleCancel,
    handleOpenWorkspaceContext,
  } = useQuickAiSurface(model.closeQuickAi, session, model, openWorkspaceContext);
  const { chat } = model;

  return (
    <motion.div
      className="quick-ai-layer"
      onClick={handleBackdropClick}
      aria-hidden={!isPresent}
      style={{ pointerEvents: isPresent ? "auto" : "none" }}
    >
      <motion.div
        className="quick-ai-dimmer"
        aria-hidden="true"
        initial={{ opacity: 0 }}
        animate={{ opacity: isPresent ? 1 : 0 }}
        transition={{ duration: 0.18 }}
      />
      <motion.section
        ref={surfaceRef}
        className="quick-ai-surface"
        role="dialog"
        aria-modal={isPresent}
        inert={!isPresent}
        aria-labelledby="quick-ai-title"
        onKeyDown={handleKeyDown}
        {...surfaceMotion}
        onAnimationComplete={handleAnimationComplete}
      >
        <motion.div className="quick-ai-content" {...contentMotion}>
          <header className="quick-ai-heading">
            <div className="quick-ai-brand">
              <div>
                <span className="quick-ai-eyebrow">POLAR / QUICK AI</span>
                <h2 id="quick-ai-title">{chat.goal ? "Mission conversation" : "New mission"}</h2>
              </div>
            </div>
            <div className="quick-ai-heading-actions">
              {chat.id && <span className="quick-ai-draft-state">Draft saved</span>}
              <button
                className="quick-ai-close"
                type="button"
                aria-label="Close Quick AI"
                onClick={model.closeQuickAi}
              >
                <Icon name="close" size={18} />
              </button>
            </div>
          </header>

          <div className="quick-ai-conversation" aria-live="polite">
            {chat.messages.map((message, index) => (
              <article
                className={`quick-ai-message ${message.role}`}
                key={message.id ?? `${message.role}-${index}`}
              >
                <span>{message.role === "assistant" ? "POLAR" : "YOU"}</span>
                <p>{message.content}</p>
              </article>
            ))}
            {chat.request &&
              ["queued", "claimed"].includes(chat.request.status) &&
              !chat.failure && (
                <div className="quick-ai-working" role="status">
                  <span className="quick-ai-working-dot" />
                  {chat.request.status === "claimed"
                    ? "ChatGPT is building your plan"
                    : "Waiting for your connected Polar desktop"}
                  <button type="button" onClick={handleCancel}>
                    Stop
                  </button>
                </div>
              )}
            {chat.request?.status === "failed" && (
              <div className="quick-ai-error" role="status">
                <span>
                  {chat.request.errorMessage ?? "ChatGPT could not complete this request."}
                </span>
                <button type="button" onClick={handleRetry}>
                  Retry with ChatGPT
                </button>
              </div>
            )}
            {chat.request?.status === "stale" && (
              <div className="quick-ai-error" role="status">
                <span>{chat.request.errorMessage}</span>
                <button type="button" onClick={handleRefreshPlan}>
                  Refresh plan
                </button>
              </div>
            )}
          </div>

          <form className="quick-ai-form" onSubmit={handleSubmit}>
            <label className="sr-only" htmlFor="quick-ai-input">
              Describe the goal or reply to Polar
            </label>
            <textarea
              ref={model.inputRef}
              id="quick-ai-input"
              value={inputDraft.text}
              onChange={handleInputChange}
              onKeyDown={handlePromptKeyDown}
              placeholder={
                chat.goal
                  ? "Answer Polar or refine the goal…"
                  : "What are you trying to accomplish?"
              }
              rows={2}
              spellCheck={false}
              disabled={chat.loading || chat.request?.status === "claimed"}
            />
            <div className="quick-ai-composer-footer">
              <span>Enter to send · Shift + Enter for a new line</span>
              <button
                className="quick-ai-submit"
                type="submit"
                disabled={
                  !inputDraft.text.trim() || chat.loading || chat.request?.status === "claimed"
                }
                aria-label="Send message"
              >
                <Icon name="arrow" size={16} />
              </button>
            </div>
          </form>

          <div className="quick-ai-context-row">
            <span className="quick-ai-section-label">Using</span>
            <div className="quick-ai-chips" aria-label="Context in use">
              <button
                className="quick-ai-workspace-context"
                type="button"
                onClick={handleOpenWorkspaceContext}
              >
                Workspace context · inherited automatically
              </button>
              {chat.sources.length === 0 && (
                <span className="quick-ai-no-context">No context selected</span>
              )}
              {chat.sources.map((source) => (
                <span className="quick-ai-chip" key={source.id}>
                  <Icon name="file" size={13} />
                  {source.fileName}
                  <button
                    type="button"
                    data-source-id={source.id}
                    aria-label={`Remove ${source.fileName}`}
                    onClick={handleRemoveSource}
                  >
                    <Icon name="close" size={12} />
                  </button>
                </span>
              ))}
            </div>
          </div>
          {chat.request?.contextManifest && (
            <details className="quick-ai-source-coverage">
              <summary>
                Sources supplied to this run · workspace revision{" "}
                {chat.request.contextManifest.workspaceRevision}
              </summary>
              {chat.request.contextManifest.sources.length ? (
                <ul>
                  {chat.request.contextManifest.sources.map((source) => (
                    <li key={`${source.scope}-${source.id}`}>
                      <strong>{source.scope === "workspace" ? "Workspace" : "Mission"}:</strong>{" "}
                      {source.title} · revision {source.revision} · {source.excerptIds.length}{" "}
                      excerpts supplied
                      {source.omittedExcerptCount ? ` · ${source.omittedExcerptCount} omitted` : ""}
                    </li>
                  ))}
                </ul>
              ) : (
                <p>Only the workspace brief and mission conversation were supplied.</p>
              )}
              {chat.proposal?.citationReferences?.length ? (
                <p>
                  Cited by proposal:{" "}
                  {chat.proposal.citationReferences
                    .map((citation) => `${citation.scope} source ${citation.sourceId}`)
                    .join(", ")}
                </p>
              ) : (
                <p>This proposal did not cite a document excerpt.</p>
              )}
            </details>
          )}

          {chat.failure && chat.request?.status !== "failed" && (
            <section className="quick-ai-error" role="alert">
              <p>{chat.failure}</p>
              {chat.request && ["queued", "claimed", "cancelled"].includes(chat.request.status) && (
                <button type="button" onClick={handleRetry}>
                  Retry with ChatGPT
                </button>
              )}
            </section>
          )}
          {chat.proposal && (
            <section className="quick-ai-result">
              <span className="quick-ai-result-status">PLAN READY FOR REVIEW</span>
              <p>{chat.proposal.content.recommendation}</p>
              <button className="quick-ai-apply" type="button" onClick={handleReview}>
                Review plan <Icon name="arrow" size={15} />
              </button>
            </section>
          )}

          <footer className="quick-ai-actions">
            <button
              className="quick-ai-action-button"
              type="button"
              onClick={handleAttach}
              disabled={chat.loading}
            >
              <Icon name="plus" size={15} /> Attach context
            </button>
            <details className="quick-ai-paste-context">
              <summary>Add pasted context</summary>
              <textarea
                value={model.pasteContext}
                onChange={handlePasteChange}
                aria-label="Pasted context"
                placeholder="Paste notes, requirements, or relevant text…"
                rows={3}
              />
              <button type="button" onClick={handleAddPasted}>
                Add context
              </button>
            </details>
            <span className="quick-ai-footer-note">
              {chat.loading ? "Reading documents…" : "Original files stay on this device."}
            </span>
          </footer>
        </motion.div>
      </motion.section>
    </motion.div>
  );
}
