import { motion } from "motion/react";
import { Icon } from "@/components/ui/Icon";
import type { QuickAiMissionSummary } from "@/features/quick-ai/types/quick-ai.types";
import type {
  QuickAiContextReference,
  QuickAiSession,
} from "@/features/quick-ai/utils/quickAiSession";
import { useQuickAiSurface } from "@/features/quick-ai/hooks/useQuickAiSurface";
import type { useQuickAi } from "@/features/quick-ai/hooks/useQuickAi";
import "@/features/quick-ai/styles/quick-ai.css";

type QuickAiModel = ReturnType<typeof useQuickAi>;

interface Props {
  mission: QuickAiMissionSummary | null;
  session: QuickAiSession;
  model: QuickAiModel;
}

export function QuickAiSurface({ mission, session, model }: Props) {
  const {
    surfaceRef,
    isPresent,
    draft,
    surfaceMotion,
    contentMotion,
    handleAnimationComplete,
    handleKeyDown,
    handleBackdropClick,
    handleSubmit,
    handleInputChange,
    handlePromptKeyDown,
    handleApply,
    handleIntentSwitch,
    handleMissionContext,
    handleEvidenceSelection,
    handleRemoveContext,
    handleFiles,
  } = useQuickAiSurface(model.closeQuickAi, mission, session, model);

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
                <h2 id="quick-ai-title">
                  {session.intent === "command"
                    ? (mission?.name ?? "Quick command")
                    : "New mission"}
                </h2>
              </div>
            </div>
            <div className="quick-ai-heading-actions">
              <button className="quick-ai-mode-toggle" type="button" onClick={handleIntentSwitch}>
                {session.intent === "command" ? "New mission" : "Quick command"}
              </button>
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

          <form className="quick-ai-form" onSubmit={handleSubmit}>
            <label className="sr-only" htmlFor="quick-ai-input">
              Ask Polar or describe what you want to accomplish
            </label>
            <textarea
              ref={model.inputRef}
              id="quick-ai-input"
              value={draft.text}
              onChange={handleInputChange}
              onKeyDown={handlePromptKeyDown}
              placeholder={
                session.intent === "command"
                  ? "Ask Polar or describe what you want to accomplish..."
                  : undefined
              }
              rows={2}
              spellCheck={false}
            />
            <div className="quick-ai-composer-footer">
              <span>Enter to preview</span>
              <button
                className="quick-ai-submit"
                type="submit"
                disabled={!draft.text.trim()}
                aria-label="Submit request"
              >
                <Icon name="arrow" size={16} />
              </button>
            </div>
          </form>

          <div className="quick-ai-context-row">
            <span className="quick-ai-section-label">Using</span>
            <div className="quick-ai-chips" aria-label="Context in use">
              {draft.context.length === 0 && (
                <span className="quick-ai-no-context">No context selected</span>
              )}
              {draft.context.map((reference) => (
                <ContextChip
                  key={reference.id}
                  reference={reference}
                  onRemove={handleRemoveContext}
                />
              ))}
            </div>
          </div>

          {draft.result && (
            <section
              className={`quick-ai-result ${draft.result.kind === "unsupported" ? "is-unsupported" : ""}`}
              aria-live="polite"
            >
              <span className="quick-ai-result-status">
                {draft.result.kind === "proposal" ? "PREVIEW PROPOSAL" : "PREVIEW LIMIT"}
              </span>
              <p>{draft.result.message}</p>
              {draft.result.kind === "proposal" && (
                <button
                  className={draft.result.applied ? "quick-ai-applied" : "quick-ai-apply"}
                  type="button"
                  onClick={handleApply}
                >
                  {draft.result.applied ? (
                    <>
                      <Icon name="check" size={15} /> Preview applied · no workspace changes made
                    </>
                  ) : (
                    <>
                      Apply change <Icon name="arrow" size={15} />
                    </>
                  )}
                </button>
              )}
            </section>
          )}

          <footer className="quick-ai-actions">
            <div className="quick-ai-picker-group">
              <details className="quick-ai-picker" data-quick-ai-picker>
                <summary>
                  <Icon name="folder" size={15} /> Context
                </summary>
                <div className="quick-ai-picker-menu">
                  <span>Mission context</span>
                  {mission ? (
                    <button type="button" onClick={handleMissionContext}>
                      {mission.name}
                    </button>
                  ) : (
                    <p className="quick-ai-no-context">No missions yet.</p>
                  )}
                </div>
              </details>
              <label className="quick-ai-action-button quick-ai-attach">
                <Icon name="plus" size={15} /> Attach
                <input
                  type="file"
                  multiple
                  onChange={handleFiles}
                  aria-label="Attach files for this preview"
                />
              </label>
              <details className="quick-ai-picker" data-quick-ai-picker>
                <summary>
                  <Icon name="file" size={15} /> Sources
                </summary>
                <div className="quick-ai-picker-menu">
                  <span>{mission?.name ?? "Workspace"} sources</span>
                  {!mission?.evidence.length && (
                    <p className="quick-ai-no-context">No sources yet.</p>
                  )}
                  {mission?.evidence.map((evidence) => (
                    <button
                      key={evidence.title}
                      type="button"
                      data-title={evidence.title}
                      onClick={handleEvidenceSelection}
                    >
                      {evidence.title}
                    </button>
                  ))}
                </div>
              </details>
            </div>
            <span className="quick-ai-footer-note">Responses and changes are simulated.</span>
          </footer>
        </motion.div>
      </motion.section>
    </motion.div>
  );
}

function ContextChip({
  reference,
  onRemove,
}: {
  reference: QuickAiContextReference;
  onRemove: (event: React.MouseEvent<HTMLButtonElement>) => void;
}) {
  return (
    <span className="quick-ai-chip">
      {reference.kind === "file" ? (
        <Icon name="file" size={13} />
      ) : (
        <span className="quick-ai-chip-dot" />
      )}
      {reference.label}
      <button
        type="button"
        aria-label={`Remove ${reference.label} context`}
        data-context-id={reference.id}
        onClick={onRemove}
      >
        <Icon name="close" size={12} />
      </button>
    </span>
  );
}
