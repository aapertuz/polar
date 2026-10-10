import { useCallback, useRef } from "react";
import { usePresence, useReducedMotion } from "motion/react";
import { quickAiExpansionMotion } from "@/features/quick-ai/utils/quickAiMotion";
import type { QuickAiSession } from "@/features/quick-ai/utils/quickAiSession";
import type { useQuickAi } from "@/features/quick-ai/hooks/useQuickAi";

type QuickAiModel = ReturnType<typeof useQuickAi>;
export function useQuickAiSurface(
  close: () => void,
  session: QuickAiSession,
  model: QuickAiModel,
  openWorkspaceSettings: (trigger?: HTMLElement) => void,
) {
  const [isPresent, safeToRemove] = usePresence();
  const reducedMotion = Boolean(useReducedMotion());
  const surfaceRef = useRef<HTMLElement>(null);
  const inputDraft = session.drafts[session.intent];
  const { surfaceMotion, contentMotion } = quickAiExpansionMotion(reducedMotion, isPresent);
  const handleAnimationComplete = useCallback(() => {
    if (!isPresent) safeToRemove?.();
  }, [isPresent, safeToRemove]);
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLElement>) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
        return;
      }
      if (event.key !== "Tab") return;
      const items = surfaceRef.current?.querySelectorAll<HTMLElement>(
        'button:not(:disabled), textarea:not(:disabled), input:not(:disabled), summary, [tabindex="0"]',
      );
      if (!items?.length) return;
      const first = items[0]!;
      const last = items[items.length - 1]!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    },
    [close],
  );
  const handleBackdropClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (
        event.target === event.currentTarget ||
        event.target === event.currentTarget.firstElementChild
      )
        close();
    },
    [close],
  );
  const handleSubmit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      void model.submit();
    },
    [model],
  );
  const handleInputChange = useCallback(
    (event: React.ChangeEvent<HTMLTextAreaElement>) => model.setInput(event.currentTarget.value),
    [model],
  );
  const handlePromptKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
        event.preventDefault();
        void model.submit();
      }
    },
    [model],
  );
  const handleAttach = useCallback(() => {
    void model.importFiles();
  }, [model]);
  const handlePasteChange = useCallback(
    (event: React.ChangeEvent<HTMLTextAreaElement>) => model.setPaste(event),
    [model],
  );
  const handleAddPasted = useCallback(() => {
    void model.addPastedContext();
  }, [model]);
  const handleRemoveSource = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      void model.removeSource(event.currentTarget.dataset.sourceId ?? "");
    },
    [model],
  );
  const handleReview = useCallback(() => model.review(), [model]);
  const handleRetry = useCallback(() => {
    void model.retry();
  }, [model]);
  const handleRefreshPlan = useCallback(() => model.refreshPlan(), [model]);
  const handleCancel = useCallback(() => {
    void model.cancelRequest();
  }, [model]);
  const handleOpenWorkspaceSettings = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => openWorkspaceSettings(event.currentTarget),
    [openWorkspaceSettings],
  );
  const handleRefine = useCallback(() => model.refine(), [model]);
  return {
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
    handleOpenWorkspaceSettings,
    handleRefine,
  };
}
