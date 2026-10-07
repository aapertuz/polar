import { useCallback, useRef } from "react";
import { usePresence, useReducedMotion } from "motion/react";
import { quickAiExpansionMotion } from "@/features/quick-ai/utils/quickAiMotion";
import type { QuickAiMissionSummary } from "@/features/quick-ai/types/quick-ai.types";
import type { QuickAiSession } from "@/features/quick-ai/utils/quickAiSession";
import type { useQuickAi } from "@/features/quick-ai/hooks/useQuickAi";

type QuickAiModel = ReturnType<typeof useQuickAi>;

export function useQuickAiSurface(
  close: () => void,
  mission: QuickAiMissionSummary,
  session: QuickAiSession,
  model: QuickAiModel,
) {
  const [isPresent, safeToRemove] = usePresence();
  const reducedMotion = Boolean(useReducedMotion());
  const surfaceRef = useRef<HTMLDivElement>(null);
  const draft = session.drafts[session.intent];

  const { surfaceMotion, contentMotion } = quickAiExpansionMotion(reducedMotion, isPresent);
  const handleAnimationComplete = useCallback(() => {
    if (!isPresent) safeToRemove?.();
  }, [isPresent, safeToRemove]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key === "Escape") {
        const openPicker = surfaceRef.current?.querySelector<HTMLDetailsElement>(
          "[data-quick-ai-picker][open]",
        );
        if (openPicker) {
          event.preventDefault();
          openPicker.open = false;
          openPicker.querySelector<HTMLElement>("summary")?.focus();
          return;
        }
        event.preventDefault();
        close();
        return;
      }

      if (event.key !== "Tab") return;
      const focusable = surfaceRef.current?.querySelectorAll<HTMLElement>(
        'button:not(:disabled), textarea:not(:disabled), input:not(:disabled), summary, [tabindex="0"]',
      );
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
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
      ) {
        close();
      }
    },
    [close],
  );

  const handleSubmit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      model.submit();
    },
    [model],
  );
  const handleInputChange = useCallback(
    (event: React.ChangeEvent<HTMLTextAreaElement>) => model.updateDraft(event.currentTarget.value),
    [model],
  );
  const handlePromptKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
        event.preventDefault();
        model.submit();
      }
    },
    [model],
  );
  const handleApply = useCallback(() => model.applyPreview(), [model]);
  const handleIntentSwitch = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      model.openQuickAi(
        session.intent === "command" ? "new-mission" : "command",
        event.currentTarget,
      );
    },
    [model, session.intent],
  );
  const handleMissionContext = useCallback(() => {
    model.addContext({ id: mission.id, label: mission.name, kind: "mission" });
    const picker = surfaceRef.current?.querySelector<HTMLDetailsElement>(
      "[data-quick-ai-picker][open]",
    );
    if (picker) {
      picker.open = false;
      picker.querySelector<HTMLElement>("summary")?.focus();
    }
  }, [mission.id, mission.name, model]);
  const handleEvidenceSelection = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      const evidence = mission.evidence.find(
        (item) => item.title === event.currentTarget.dataset.title,
      );
      if (evidence) {
        model.addContext({
          id: `${mission.id}:evidence:${evidence.title}`,
          label: evidence.title,
          kind: "source",
        });
      }
      const picker = event.currentTarget.closest<HTMLDetailsElement>("[data-quick-ai-picker]");
      if (picker) {
        picker.open = false;
        picker.querySelector<HTMLElement>("summary")?.focus();
      }
    },
    [mission.evidence, mission.id, model],
  );
  const handleRemoveContext = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      model.removeContext(event.currentTarget.dataset.contextId ?? "");
    },
    [model],
  );
  const handleFiles = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = [...(event.currentTarget.files ?? [])];
      files.forEach((file) =>
        model.addContext({
          id: `file:${file.name}:${file.size}:${file.lastModified}`,
          label: file.name,
          kind: "file",
        }),
      );
      event.currentTarget.value = "";
    },
    [model],
  );

  return {
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
  };
}
