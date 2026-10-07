import { useCallback, useEffect, useRef, useState } from "react";
import {
  addQuickAiContext,
  applyQuickAiPreview,
  closeQuickAiSession,
  createQuickAiSession,
  openQuickAiSession,
  removeQuickAiContext,
  submitQuickAiPrompt,
  updateQuickAiDraft,
} from "@/features/quick-ai/utils/quickAiSession";
import type {
  QuickAiContextReference,
  QuickAiIntent,
} from "@/features/quick-ai/utils/quickAiSession";
import type { QuickAiMissionSummary } from "@/features/quick-ai/types/quick-ai.types";

interface Options {
  mission: QuickAiMissionSummary;
  closeOverlays: () => void;
}

export function useQuickAi({ mission, closeOverlays }: Options) {
  const [session, setSession] = useState(createQuickAiSession);
  const sessionRef = useRef(session);
  sessionRef.current = session;
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const activeMission = useRef(mission);
  activeMission.current = mission;

  const focusInput = useCallback(() => inputRef.current?.focus({ preventScroll: true }), []);
  const openQuickAi = useCallback(
    (intent: QuickAiIntent, trigger?: HTMLElement) => {
      if (!sessionRef.current.opened && trigger) triggerRef.current = trigger;
      closeOverlays();
      setSession((current) =>
        openQuickAiSession(
          current,
          intent,
          intent === "command"
            ? { id: activeMission.current.id, label: activeMission.current.name, kind: "mission" }
            : undefined,
        ),
      );
      requestAnimationFrame(focusInput);
    },
    [closeOverlays, focusInput],
  );
  const closeQuickAi = useCallback(() => {
    setSession((current) => closeQuickAiSession(current));
    requestAnimationFrame(() => {
      const trigger = triggerRef.current;
      if (trigger?.isConnected) trigger.focus();
    });
  }, []);
  const updateDraft = useCallback((text: string) => {
    setSession((current) => updateQuickAiDraft(current, text));
  }, []);
  const addContext = useCallback((reference: QuickAiContextReference) => {
    setSession((current) => addQuickAiContext(current, reference));
  }, []);
  const removeContext = useCallback((id: string) => {
    setSession((current) => removeQuickAiContext(current, id));
  }, []);
  const submit = useCallback(() => {
    setSession((current) => submitQuickAiPrompt(current));
  }, []);
  const applyPreview = useCallback(() => {
    setSession((current) => applyQuickAiPreview(current));
  }, []);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if (
        event.isComposing ||
        event.key.toLowerCase() !== "k" ||
        (!event.metaKey && !event.ctrlKey) ||
        event.altKey
      ) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      const trigger = document.activeElement;
      openQuickAi("command", trigger instanceof HTMLElement ? trigger : undefined);
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [openQuickAi]);

  return {
    session,
    inputRef,
    focusInput,
    openQuickAi,
    closeQuickAi,
    updateDraft,
    addContext,
    removeContext,
    submit,
    applyPreview,
  };
}
