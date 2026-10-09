import { useCallback, useEffect, useRef, useState } from "react";
import { invoke, isTauri } from "@tauri-apps/api/core";
import {
  closeQuickAiSession,
  createQuickAiSession,
  openQuickAiSession,
  updateQuickAiDraft,
} from "@/features/quick-ai/utils/quickAiSession";
import type {
  QuickAiContextReference,
  QuickAiIntent,
} from "@/features/quick-ai/utils/quickAiSession";
import { errorMessage } from "@/features/quick-ai/utils/errorMessage";
import type { MissionPlan } from "@polar/contracts";

interface ChatMessage {
  id?: string;
  role: "user" | "assistant";
  content: string;
}
interface MissionSource {
  id: string;
  fileName: string;
  contentHash: string;
  extractedText: string;
  provenance: string;
}
interface ReasoningRequest {
  id: string;
  status: string;
  errorMessage?: string | null;
  leaseExpiresAt?: string | null;
  contextManifest?: {
    workspaceRevision: number;
    sources: {
      scope: "workspace" | "mission";
      id: string;
      title: string;
      revision: number;
      contentHash: string;
      provenance: string;
      excerptIds: string[];
      omittedExcerptCount: number;
    }[];
  } | null;
}
interface DraftDetail {
  id: string;
  goal: string;
  status: string;
  messages: ChatMessage[];
  sources: MissionSource[];
  proposal: {
    id: string;
    revision: number;
    revisionHash: string;
    content: MissionPlan;
    status: string;
    citationReferences?: {
      scope: "workspace" | "mission";
      sourceId: string;
      revision: number;
      excerptId: string;
    }[];
    contextManifest?: ReasoningRequest["contextManifest"];
  } | null;
  request: ReasoningRequest | null;
}
interface LocalDraft {
  id: string | null;
  goal: string;
  messages: ChatMessage[];
  sources: MissionSource[];
  stagedSources: MissionSource[];
  proposal: DraftDetail["proposal"];
  request: ReasoningRequest | null;
  failure: string | null;
  loading: boolean;
}

interface Options {
  initialIntent?: QuickAiIntent;
  closeOverlays: () => void;
}

export function useQuickAi({ closeOverlays, initialIntent }: Options) {
  const [session, setSession] = useState(() => {
    const base = createQuickAiSession();
    return openQuickAiSession(base, initialIntent ?? "new-mission");
  });
  const [chat, setChat] = useState<LocalDraft>({
    id: null,
    goal: "",
    messages: [],
    sources: [],
    stagedSources: [],
    proposal: null,
    request: null,
    failure: null,
    loading: false,
  });
  const [pasteContext, setPasteContext] = useState("");
  const [reviewing, setReviewing] = useState(false);
  const [replacingPlan, setReplacingPlan] = useState(false);
  const regenerationBusy = useRef(false);
  const activationBusy = useRef(false);
  const sessionRef = useRef(session);
  sessionRef.current = session;
  const chatRef = useRef(chat);
  chatRef.current = chat;
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const workerBusy = useRef(false);
  const workerAttempted = useRef(new Set<string>());

  const focusInput = useCallback(() => inputRef.current?.focus({ preventScroll: true }), []);
  const openQuickAi = useCallback(
    (intent: QuickAiIntent, trigger?: HTMLElement) => {
      if (!sessionRef.current.opened && trigger) triggerRef.current = trigger;
      closeOverlays();
      setSession((current) => openQuickAiSession(current, intent));
      requestAnimationFrame(focusInput);
    },
    [closeOverlays, focusInput],
  );
  const closeQuickAi = useCallback(() => {
    setSession((current) => closeQuickAiSession(current));
    requestAnimationFrame(() => {
      const trigger = triggerRef.current;
      if (trigger?.isConnected) trigger.focus();
      else document.querySelector<HTMLButtonElement>(".island-mark-button")?.focus();
    });
  }, []);
  const updateDraft = useCallback((text: string) => {
    setSession((current) => updateQuickAiDraft(current, text));
  }, []);

  const refreshDraft = useCallback(async (draftId: string) => {
    const detail = await invoke<DraftDetail>("polar_mission_draft_get", { draftId });
    setReplacingPlan(detail.status === "activated");
    setChat((current) => ({
      ...current,
      id: detail.id,
      goal: detail.goal,
      messages: detail.messages,
      sources: detail.sources,
      stagedSources: [],
      proposal: detail.proposal?.status === "current" ? detail.proposal : null,
      request: detail.request,
      loading: false,
    }));
    return detail;
  }, []);

  const ensureDraft = useCallback(async () => {
    if (chatRef.current.id) return chatRef.current.id;
    const draft = await invoke<{ id: string }>("polar_mission_draft_create", { goal: "" });
    setChat((current) => ({ ...current, id: draft.id, goal: "" }));
    return draft.id;
  }, []);

  const importFiles = useCallback(async () => {
    if (!isTauri()) {
      setChat((current) => ({ ...current, failure: "Attach files from the Polar desktop app." }));
      return;
    }
    setChat((current) => ({ ...current, loading: true, failure: null }));
    try {
      const result = await invoke<{
        sources: MissionSource[];
        failures: { fileName: string; message: string }[];
      }>("polar_import_mission_context");
      const current = chatRef.current;
      const draftId = result.sources.length && !current.id ? await ensureDraft() : current.id;
      const added: MissionSource[] = [];
      for (const source of result.sources) {
        if (draftId) {
          await invoke("polar_mission_source_add", { draftId, source });
          added.push(source);
        } else added.push(source);
      }
      setChat((value) => ({
        ...value,
        id: draftId,
        sources: [...value.sources, ...added],
        stagedSources: [],
        proposal: null,
        request: null,
        loading: false,
        failure:
          result.failures.map((failure) => `${failure.fileName}: ${failure.message}`).join("\n") ||
          null,
      }));
      if (draftId) await refreshDraft(draftId);
    } catch (error) {
      setChat((current) => ({
        ...current,
        loading: false,
        failure: errorMessage(error, "Polar could not read the selected files."),
      }));
    }
  }, [ensureDraft, refreshDraft]);

  const addPastedContext = useCallback(async () => {
    const text = pasteContext.trim();
    if (!text) return;
    if (text.length > 100_000) {
      setChat((current) => ({
        ...current,
        failure: "Pasted context must be 100,000 characters or less.",
      }));
      return;
    }
    const bytes = new TextEncoder().encode(text);
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    const contentHash = Array.from(new Uint8Array(digest), (value) =>
      value.toString(16).padStart(2, "0"),
    ).join("");
    const source: MissionSource = {
      id: crypto.randomUUID(),
      fileName: "Pasted context",
      contentHash,
      extractedText: text,
      provenance: "pasted",
    };
    try {
      const draftId = await ensureDraft();
      await invoke("polar_mission_source_add", { draftId, source });
      setChat((current) => ({
        ...current,
        id: draftId,
        sources: [...current.sources, source],
        stagedSources: [],
        proposal: null,
        request: null,
        failure: null,
      }));
      setPasteContext("");
      await refreshDraft(draftId);
    } catch (error) {
      setChat((current) => ({
        ...current,
        failure: errorMessage(error, "Polar could not save the pasted context."),
      }));
    }
  }, [ensureDraft, pasteContext, refreshDraft]);

  const removeSource = useCallback(async (sourceId: string) => {
    try {
      const sourceIsPersisted = Boolean(
        chatRef.current.id &&
        !chatRef.current.stagedSources.some((source) => source.id === sourceId),
      );
      if (sourceIsPersisted && chatRef.current.id)
        await invoke("polar_mission_source_remove", { draftId: chatRef.current.id, sourceId });
      setChat((current) => ({
        ...current,
        sources: current.sources.filter((source) => source.id !== sourceId),
        stagedSources: current.stagedSources.filter((source) => source.id !== sourceId),
        proposal: null,
        request: null,
        failure: null,
      }));
    } catch (error) {
      setChat((current) => ({
        ...current,
        failure: errorMessage(error, "Polar could not remove this source."),
      }));
    }
  }, []);

  const submit = useCallback(
    async (providedText?: string, providedDraftId?: string) => {
      const text = (
        providedText ?? sessionRef.current.drafts[sessionRef.current.intent].text
      ).trim();
      if (!text || (chatRef.current.loading && !providedDraftId)) return;
      if (!isTauri()) {
        setChat((current) => ({
          ...current,
          failure: "Mission creation requires the Polar desktop app.",
        }));
        return;
      }
      setChat((current) => ({ ...current, loading: true, failure: null }));
      try {
        let draftId = providedDraftId ?? chatRef.current.id;
        if (!draftId) {
          const draft = await invoke<{ id: string }>("polar_mission_draft_create", { goal: text });
          draftId = draft.id;
          for (const source of chatRef.current.stagedSources)
            await invoke("polar_mission_source_add", { draftId, source });
        }
        const queued = await invoke<{ requestId: string }>("polar_mission_draft_send_message", {
          draftId,
          content: text,
        });
        if (!providedText) setSession((current) => updateQuickAiDraft(current, ""));
        setChat((current) => ({
          ...current,
          id: draftId,
          messages: [...current.messages, { role: "user", content: text }],
          proposal: null,
          request: { id: queued.requestId, status: "queued" },
          loading: false,
          failure: null,
        }));
        await refreshDraft(draftId);
      } catch (error) {
        setChat((current) => ({
          ...current,
          loading: false,
          failure: errorMessage(
            error,
            "Polar could not save this conversation. Retry when connected.",
          ),
        }));
      }
    },
    [refreshDraft],
  );

  const regeneratePlan = useCallback(
    async (missionId?: string) => {
      if (regenerationBusy.current) return;
      regenerationBusy.current = true;
      setChat((current) => ({ ...current, loading: true, failure: null }));
      setReviewing(false);
      openQuickAi("new-mission");
      try {
        let draftId = chatRef.current.id;
        if (missionId) {
          const result = await invoke<{ draftId: string }>("polar_mission_regenerate", {
            missionId,
          });
          draftId = result.draftId;
        }
        if (!draftId) throw new Error("Open a mission plan before regenerating it.");
        await refreshDraft(draftId);
        await submit(
          "Regenerate the plan using the current workspace context, mission attachments, conversation, and saved plan. Preserve the mission outcome, success criteria, constraints, deadline, and established level of detail. Use clear, natural, professional wording.",
          draftId,
        );
      } catch (error) {
        setChat((current) => ({
          ...current,
          loading: false,
          failure: errorMessage(error, "Polar could not regenerate this plan."),
        }));
      } finally {
        regenerationBusy.current = false;
      }
    },
    [openQuickAi, refreshDraft, submit],
  );

  const refreshPlan = useCallback(() => {
    void submit("Refresh the plan using the current workspace context and mission attachments.");
  }, [submit]);

  const cancelRequest = useCallback(async () => {
    const request = chatRef.current.request;
    if (!request) return;
    try {
      await invoke("polar_mission_reasoning_cancel", { requestId: request.id });
      await invoke("polar_ai_cancel").catch(() => {});
      setChat((current) => ({
        ...current,
        request: { ...request, status: "cancelled" },
        failure: "Request cancelled. Your draft is saved.",
      }));
    } catch (error) {
      setChat((current) => ({
        ...current,
        failure: errorMessage(error, "Polar could not cancel this request."),
      }));
    }
  }, []);

  const retry = useCallback(async () => {
    const request = chatRef.current.request;
    if (!request) return;
    setChat((current) => ({ ...current, failure: null, loading: true }));
    try {
      if (request.status === "claimed") {
        await invoke("polar_mission_reasoning_cancel", { requestId: request.id });
        await invoke("polar_ai_cancel").catch(() => {});
      }
      await invoke("polar_mission_reasoning_retry", { requestId: request.id });
      workerAttempted.current.delete(request.id);
      setChat((current) => ({
        ...current,
        request: { ...request, status: "queued" },
        loading: false,
      }));
    } catch (error) {
      setChat((current) => ({
        ...current,
        loading: false,
        failure: errorMessage(error, "Polar could not retry this request."),
      }));
    }
  }, []);

  const resumeDrafts = useCallback(async () => {
    if (!isTauri() || chatRef.current.id) return;
    try {
      const drafts = await invoke<{ id: string }[]>("polar_mission_drafts");
      if (drafts.length) await refreshDraft(drafts[0]!.id);
    } catch {
      // An unauthenticated startup remains usable. The next save displays the actionable sign-in error.
    }
  }, [refreshDraft]);

  useEffect(() => {
    void resumeDrafts();
  }, [resumeDrafts]);
  useEffect(() => {
    if (session.opened) requestAnimationFrame(focusInput);
  }, [session.opened, focusInput]);
  useEffect(() => {
    if (!session.opened || !chat.id) return;
    const poll = window.setInterval(() => {
      if (chatRef.current.id) void refreshDraft(chatRef.current.id).catch(() => {});
      const request = chatRef.current.request;
      const claimAvailable =
        request?.status === "queued" ||
        (request?.status === "claimed" &&
          Boolean(request.leaseExpiresAt && Date.parse(request.leaseExpiresAt) <= Date.now()));
      if (
        request &&
        claimAvailable &&
        !workerAttempted.current.has(request.id) &&
        !workerBusy.current &&
        isTauri()
      ) {
        workerBusy.current = true;
        workerAttempted.current.add(request.id);
        void invoke<string>("polar_ai_work_once")
          .then((result) => {
            if (result === "completed" && chatRef.current.id)
              return refreshDraft(chatRef.current.id);
            return undefined;
          })
          .catch((error: unknown) => {
            setChat((current) => ({
              ...current,
              failure: errorMessage(error, "The local ChatGPT worker is unavailable."),
            }));
          })
          .finally(() => {
            workerBusy.current = false;
          });
      }
    }, 2200);
    return () => window.clearInterval(poll);
  }, [chat.id, session.opened, refreshDraft]);

  const setInput = useCallback(
    (text: string) => setSession((current) => updateQuickAiDraft(current, text)),
    [],
  );
  const setPaste = useCallback(
    (event: React.ChangeEvent<HTMLTextAreaElement>) => setPasteContext(event.currentTarget.value),
    [],
  );
  const switchIntent = useCallback(
    () => openQuickAi(sessionRef.current.intent === "command" ? "new-mission" : "command"),
    [openQuickAi],
  );
  const addContext = useCallback((_reference: QuickAiContextReference) => {}, []);
  const removeContext = useCallback((_id: string) => {}, []);
  const activate = useCallback(async () => {
    const proposal = chatRef.current.proposal;
    const draftId = chatRef.current.id;
    if (!proposal || !draftId || activationBusy.current) return null;
    activationBusy.current = true;
    setChat((current) => ({ ...current, loading: true, failure: null }));
    try {
      const result = await invoke<{ missionId: string }>("polar_mission_activate", {
        draftId,
        proposalId: proposal.id,
        revisionHash: proposal.revisionHash,
      });
      setChat((current) => ({ ...current, proposal: null, failure: null, loading: false }));
      setReviewing(false);
      return result.missionId;
    } catch (error) {
      setChat((current) => ({
        ...current,
        loading: false,
        failure: errorMessage(error, "Polar could not apply this plan."),
      }));
      openQuickAi("new-mission");
      return null;
    } finally {
      activationBusy.current = false;
    }
  }, [openQuickAi]);
  const clearProposal = useCallback(
    () => setChat((current) => ({ ...current, proposal: null })),
    [],
  );
  const review = useCallback(() => {
    setReviewing(true);
    closeQuickAi();
  }, [closeQuickAi]);
  const refine = useCallback(() => {
    setReviewing(false);
    openQuickAi("new-mission");
  }, [openQuickAi]);
  const contextReferences: QuickAiContextReference[] = chat.sources.map((source) => ({
    id: source.id,
    label: source.fileName,
    kind: "file",
  }));

  return {
    session,
    chat,
    inputRef,
    focusInput,
    openQuickAi,
    closeQuickAi,
    updateDraft,
    setInput,
    addContext,
    removeContext,
    submit,
    refreshPlan,
    switchIntent,
    importFiles,
    pasteContext,
    setPaste,
    addPastedContext,
    removeSource,
    cancelRequest,
    retry,
    activate,
    clearProposal,
    contextReferences,
    reviewing,
    replacingPlan,
    regeneratePlan,
    review,
    refine,
    setReviewing,
  };
}
