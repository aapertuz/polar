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
  workspaceId: string | null;
  accountId: string | null;
}

interface ScopeSnapshot {
  session: ReturnType<typeof createQuickAiSession>;
  chat: LocalDraft;
  pasteContext: string;
  reviewing: boolean;
  replacingPlan: boolean;
}
const scopeSnapshots = new Map<string, ScopeSnapshot>();

export function clearQuickAiSnapshots(accountId: string, workspaceId?: string) {
  if (workspaceId) {
    scopeSnapshots.delete(`${accountId}:${workspaceId}`);
    return;
  }
  const prefix = `${accountId}:`;
  for (const key of scopeSnapshots.keys()) if (key.startsWith(prefix)) scopeSnapshots.delete(key);
}

function emptyChat(): LocalDraft {
  return {
    id: null,
    goal: "",
    messages: [],
    sources: [],
    stagedSources: [],
    proposal: null,
    request: null,
    failure: null,
    loading: false,
  };
}

function emptySnapshot(initialIntent: QuickAiIntent): ScopeSnapshot {
  return {
    session: openQuickAiSession(createQuickAiSession(), initialIntent),
    chat: emptyChat(),
    pasteContext: "",
    reviewing: false,
    replacingPlan: false,
  };
}

export function useQuickAi({ closeOverlays, initialIntent, workspaceId, accountId }: Options) {
  const scopeKey = workspaceId && accountId ? `${accountId}:${workspaceId}` : null;
  const initial = scopeKey
    ? (scopeSnapshots.get(scopeKey) ?? emptySnapshot(initialIntent ?? "new-mission"))
    : emptySnapshot(initialIntent ?? "new-mission");
  const [loadedScope, setLoadedScope] = useState(scopeKey);
  const [session, setSession] = useState(initial.session);
  const [chat, setChat] = useState<LocalDraft>(initial.chat);
  const [pasteContext, setPasteContext] = useState(initial.pasteContext);
  const [reviewing, setReviewing] = useState(initial.reviewing);
  const [replacingPlan, setReplacingPlan] = useState(initial.replacingPlan);
  const activeScope = useRef(scopeKey);
  activeScope.current = scopeKey;
  const stateScope = useRef(scopeKey);
  const snapshotRef = useRef(initial);
  const visible = loadedScope === scopeKey && scopeKey !== null;
  useEffect(() => {
    if (stateScope.current === scopeKey) return;
    if (stateScope.current) scopeSnapshots.set(stateScope.current, snapshotRef.current);
    const next = scopeKey
      ? (scopeSnapshots.get(scopeKey) ?? emptySnapshot(initialIntent ?? "new-mission"))
      : emptySnapshot(initialIntent ?? "new-mission");
    stateScope.current = scopeKey;
    setLoadedScope(scopeKey);
    setSession(next.session);
    setChat(next.chat);
    setPasteContext(next.pasteContext);
    setReviewing(next.reviewing);
    setReplacingPlan(next.replacingPlan);
    snapshotRef.current = next;
  }, [initialIntent, scopeKey]);
  useEffect(() => {
    if (loadedScope !== scopeKey) return;
    const snapshot = { session, chat, pasteContext, reviewing, replacingPlan };
    snapshotRef.current = snapshot;
    if (scopeKey) scopeSnapshots.set(scopeKey, snapshot);
  }, [chat, loadedScope, pasteContext, replacingPlan, reviewing, scopeKey, session]);
  const setScopedChat = useCallback(
    (originScope: string | null, update: (current: LocalDraft) => LocalDraft) => {
      if (originScope && activeScope.current === originScope && stateScope.current === originScope)
        setChat((current) =>
          activeScope.current === originScope && stateScope.current === originScope
            ? update(current)
            : current,
        );
    },
    [],
  );
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
      if (!visible || !scopeKey || activeScope.current !== scopeKey) return;
      if (!sessionRef.current.opened && trigger) triggerRef.current = trigger;
      closeOverlays();
      setSession((current) => openQuickAiSession(current, intent));
      requestAnimationFrame(focusInput);
    },
    [closeOverlays, focusInput, scopeKey, visible],
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

  const refreshDraft = useCallback(
    async (draftId: string, originScope = scopeKey) => {
      if (!workspaceId || !originScope)
        throw new Error("Select a workspace before loading a draft.");
      const detail = await invoke<DraftDetail>("polar_mission_draft_get", {
        workspaceId,
        draftId,
      });
      if (activeScope.current !== originScope || stateScope.current !== originScope) return detail;
      setReplacingPlan(detail.status === "activated");
      setScopedChat(originScope, (current) => ({
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
    },
    [scopeKey, setScopedChat, workspaceId],
  );

  const ensureDraft = useCallback(
    async (originScope = scopeKey) => {
      if (!workspaceId || !originScope || activeScope.current !== originScope)
        throw new Error("Select a workspace before creating a mission draft.");
      if (chatRef.current.id) return chatRef.current.id;
      const draft = await invoke<{ id: string }>("polar_mission_draft_create", {
        workspaceId,
        goal: "",
      });
      setScopedChat(originScope, (current) => ({ ...current, id: draft.id, goal: "" }));
      return draft.id;
    },
    [scopeKey, setScopedChat, workspaceId],
  );

  const importFiles = useCallback(async () => {
    const originScope = scopeKey;
    if (!workspaceId || !originScope || activeScope.current !== originScope) return;
    const originChat = chatRef.current;
    if (!isTauri()) {
      setScopedChat(originScope, (current) => ({
        ...current,
        failure: "Attach files from the Polar desktop app.",
      }));
      return;
    }
    setScopedChat(originScope, (current) => ({ ...current, loading: true, failure: null }));
    try {
      const result = await invoke<{
        sources: MissionSource[];
        failures: { fileName: string; message: string }[];
      }>("polar_import_mission_context");
      const draftId =
        result.sources.length && !originChat.id ? await ensureDraft(originScope) : originChat.id;
      const added: MissionSource[] = [];
      for (const source of result.sources) {
        if (draftId) {
          await invoke("polar_mission_source_add", { workspaceId, draftId, source });
          added.push(source);
        } else added.push(source);
      }
      setScopedChat(originScope, (value) => ({
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
      if (draftId) await refreshDraft(draftId, originScope);
    } catch (error) {
      setScopedChat(originScope, (current) => ({
        ...current,
        loading: false,
        failure: errorMessage(error, "Polar could not read the selected files."),
      }));
    }
  }, [ensureDraft, refreshDraft, scopeKey, setScopedChat, workspaceId]);

  const addPastedContext = useCallback(async () => {
    const originScope = scopeKey;
    if (!workspaceId || !originScope || activeScope.current !== originScope) return;
    const originPaste = pasteContext;
    const text = originPaste.trim();
    if (!text) return;
    if (text.length > 100_000) {
      setScopedChat(originScope, (current) => ({
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
      const draftId = await ensureDraft(originScope);
      await invoke("polar_mission_source_add", { workspaceId, draftId, source });
      setScopedChat(originScope, (current) => ({
        ...current,
        id: draftId,
        sources: [...current.sources, source],
        stagedSources: [],
        proposal: null,
        request: null,
        failure: null,
      }));
      if (activeScope.current !== originScope || stateScope.current !== originScope) return;
      setPasteContext("");
      await refreshDraft(draftId, originScope);
    } catch (error) {
      setScopedChat(originScope, (current) => ({
        ...current,
        failure: errorMessage(error, "Polar could not save the pasted context."),
      }));
    }
  }, [ensureDraft, pasteContext, refreshDraft, scopeKey, setScopedChat, workspaceId]);

  const removeSource = useCallback(
    async (sourceId: string) => {
      const originScope = scopeKey;
      if (!workspaceId || !originScope || activeScope.current !== originScope) return;
      try {
        const sourceIsPersisted = Boolean(
          chatRef.current.id &&
          !chatRef.current.stagedSources.some((source) => source.id === sourceId),
        );
        if (sourceIsPersisted && chatRef.current.id)
          await invoke("polar_mission_source_remove", {
            workspaceId,
            draftId: chatRef.current.id,
            sourceId,
          });
        setScopedChat(originScope, (current) => ({
          ...current,
          sources: current.sources.filter((source) => source.id !== sourceId),
          stagedSources: current.stagedSources.filter((source) => source.id !== sourceId),
          proposal: null,
          request: null,
          failure: null,
        }));
      } catch (error) {
        setScopedChat(originScope, (current) => ({
          ...current,
          failure: errorMessage(error, "Polar could not remove this source."),
        }));
      }
    },
    [scopeKey, setScopedChat, workspaceId],
  );

  const submit = useCallback(
    async (providedText?: string, providedDraftId?: string) => {
      const originScope = scopeKey;
      if (!workspaceId || !originScope || activeScope.current !== originScope) return;
      const originChat = chatRef.current;
      const text = (
        providedText ?? sessionRef.current.drafts[sessionRef.current.intent].text
      ).trim();
      if (!text || (chatRef.current.loading && !providedDraftId)) return;
      if (!isTauri()) {
        setScopedChat(originScope, (current) => ({
          ...current,
          failure: "Mission creation requires the Polar desktop app.",
        }));
        return;
      }
      setScopedChat(originScope, (current) => ({ ...current, loading: true, failure: null }));
      try {
        let draftId = providedDraftId ?? originChat.id;
        if (!draftId) {
          const draft = await invoke<{ id: string }>("polar_mission_draft_create", {
            workspaceId,
            goal: text,
          });
          draftId = draft.id;
          for (const source of originChat.stagedSources)
            await invoke("polar_mission_source_add", { workspaceId, draftId, source });
        }
        const queued = await invoke<{ requestId: string }>("polar_mission_draft_send_message", {
          workspaceId,
          draftId,
          content: text,
        });
        if (activeScope.current !== originScope || stateScope.current !== originScope) return;
        if (!providedText) setSession((current) => updateQuickAiDraft(current, ""));
        setScopedChat(originScope, (current) => ({
          ...current,
          id: draftId,
          messages: [...current.messages, { role: "user", content: text }],
          proposal: null,
          request: { id: queued.requestId, status: "queued" },
          loading: false,
          failure: null,
        }));
        await refreshDraft(draftId, originScope);
      } catch (error) {
        setScopedChat(originScope, (current) => ({
          ...current,
          loading: false,
          failure: errorMessage(
            error,
            "Polar could not save this conversation. Retry when connected.",
          ),
        }));
      }
    },
    [refreshDraft, scopeKey, setScopedChat, workspaceId],
  );

  const regeneratePlan = useCallback(
    async (missionId?: string) => {
      const originScope = scopeKey;
      if (!workspaceId || !originScope || activeScope.current !== originScope) return;
      if (regenerationBusy.current) return;
      regenerationBusy.current = true;
      setScopedChat(originScope, (current) => ({ ...current, loading: true, failure: null }));
      setReviewing(false);
      openQuickAi("new-mission");
      try {
        let draftId = chatRef.current.id;
        if (missionId) {
          const result = await invoke<{ draftId: string }>("polar_mission_regenerate", {
            workspaceId,
            missionId,
          });
          draftId = result.draftId;
        }
        if (!draftId) throw new Error("Open a mission plan before regenerating it.");
        await refreshDraft(draftId, originScope);
        await submit(
          "Regenerate the plan using the current workspace context, mission attachments, conversation, and saved plan. Preserve the mission outcome, success criteria, constraints, deadline, and established level of detail. Use clear, natural, professional wording.",
          draftId,
        );
      } catch (error) {
        setScopedChat(originScope, (current) => ({
          ...current,
          loading: false,
          failure: errorMessage(error, "Polar could not regenerate this plan."),
        }));
      } finally {
        regenerationBusy.current = false;
      }
    },
    [openQuickAi, refreshDraft, scopeKey, setScopedChat, submit, workspaceId],
  );

  const refreshPlan = useCallback(() => {
    void submit("Refresh the plan using the current workspace context and mission attachments.");
  }, [submit]);

  const cancelRequest = useCallback(async () => {
    const originScope = scopeKey;
    if (!workspaceId || !originScope || activeScope.current !== originScope) return;
    const request = chatRef.current.request;
    if (!request) return;
    try {
      await invoke("polar_mission_reasoning_cancel", { workspaceId, requestId: request.id });
      if (activeScope.current !== originScope) return;
      await invoke("polar_ai_cancel").catch(() => {});
      setScopedChat(originScope, (current) => ({
        ...current,
        request: { ...request, status: "cancelled" },
        failure: "Request cancelled. Your draft is saved.",
      }));
    } catch (error) {
      setScopedChat(originScope, (current) => ({
        ...current,
        failure: errorMessage(error, "Polar could not cancel this request."),
      }));
    }
  }, [scopeKey, setScopedChat, workspaceId]);

  const retry = useCallback(async () => {
    const originScope = scopeKey;
    if (!workspaceId || !originScope || activeScope.current !== originScope) return;
    const request = chatRef.current.request;
    if (!request) return;
    setScopedChat(originScope, (current) => ({ ...current, failure: null, loading: true }));
    try {
      if (request.status === "claimed") {
        await invoke("polar_mission_reasoning_cancel", { workspaceId, requestId: request.id });
        if (activeScope.current !== originScope) return;
        await invoke("polar_ai_cancel").catch(() => {});
      }
      await invoke("polar_mission_reasoning_retry", { workspaceId, requestId: request.id });
      workerAttempted.current.delete(request.id);
      setScopedChat(originScope, (current) => ({
        ...current,
        request: { ...request, status: "queued" },
        loading: false,
      }));
    } catch (error) {
      setScopedChat(originScope, (current) => ({
        ...current,
        loading: false,
        failure: errorMessage(error, "Polar could not retry this request."),
      }));
    }
  }, [scopeKey, setScopedChat, workspaceId]);

  const resumeDrafts = useCallback(async () => {
    const originScope = scopeKey;
    if (
      !visible ||
      !workspaceId ||
      !originScope ||
      activeScope.current !== originScope ||
      stateScope.current !== originScope ||
      !isTauri() ||
      chatRef.current.id
    )
      return;
    try {
      const drafts = await invoke<{ id: string }[]>("polar_mission_drafts", { workspaceId });
      if (activeScope.current === originScope && drafts.length)
        await refreshDraft(drafts[0]!.id, originScope);
    } catch {
      // An unauthenticated startup remains usable. The next save displays the actionable sign-in error.
    }
  }, [refreshDraft, scopeKey, visible, workspaceId]);

  useEffect(() => {
    void resumeDrafts();
  }, [resumeDrafts]);
  useEffect(() => {
    if (visible && session.opened) requestAnimationFrame(focusInput);
  }, [focusInput, session.opened, visible]);
  useEffect(() => {
    if (!visible || !workspaceId || !session.opened || !chat.id) return;
    const originScope = scopeKey;
    const originWorkspaceId = workspaceId;
    if (!originScope) return;
    const poll = window.setInterval(() => {
      if (activeScope.current !== originScope || stateScope.current !== originScope) return;
      if (chatRef.current.id) void refreshDraft(chatRef.current.id, originScope).catch(() => {});
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
        void invoke<string>("polar_ai_work_once", { workspaceId: originWorkspaceId })
          .then((result) => {
            if (result === "completed" && chatRef.current.id)
              return refreshDraft(chatRef.current.id, originScope);
            return undefined;
          })
          .catch((error: unknown) => {
            setScopedChat(originScope, (current) => ({
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
  }, [chat.id, refreshDraft, scopeKey, session.opened, setScopedChat, visible, workspaceId]);

  const setInput = useCallback(
    (text: string) => {
      if (visible && scopeKey && activeScope.current === scopeKey)
        setSession((current) => updateQuickAiDraft(current, text));
    },
    [scopeKey, visible],
  );
  const setPaste = useCallback(
    (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      if (visible && scopeKey && activeScope.current === scopeKey)
        setPasteContext(event.currentTarget.value);
    },
    [scopeKey, visible],
  );
  const switchIntent = useCallback(
    () => openQuickAi(sessionRef.current.intent === "command" ? "new-mission" : "command"),
    [openQuickAi],
  );
  const addContext = useCallback((_reference: QuickAiContextReference) => {}, []);
  const removeContext = useCallback((_id: string) => {}, []);
  const activate = useCallback(async () => {
    const originScope = scopeKey;
    if (!workspaceId || !originScope || activeScope.current !== originScope) return null;
    const proposal = chatRef.current.proposal;
    const draftId = chatRef.current.id;
    if (!proposal || !draftId || activationBusy.current) return null;
    activationBusy.current = true;
    setScopedChat(originScope, (current) => ({ ...current, loading: true, failure: null }));
    try {
      const result = await invoke<{ missionId: string }>("polar_mission_activate", {
        workspaceId,
        draftId,
        proposalId: proposal.id,
        revisionHash: proposal.revisionHash,
      });
      if (activeScope.current !== originScope || stateScope.current !== originScope) return null;
      setScopedChat(originScope, (current) => ({
        ...current,
        proposal: null,
        failure: null,
        loading: false,
      }));
      setReviewing(false);
      return result.missionId;
    } catch (error) {
      setScopedChat(originScope, (current) => ({
        ...current,
        loading: false,
        failure: errorMessage(error, "Polar could not apply this plan."),
      }));
      openQuickAi("new-mission");
      return null;
    } finally {
      activationBusy.current = false;
    }
  }, [openQuickAi, scopeKey, setScopedChat, workspaceId]);
  const clearProposal = useCallback(
    () => setScopedChat(scopeKey, (current) => ({ ...current, proposal: null })),
    [scopeKey, setScopedChat],
  );
  const review = useCallback(() => {
    if (!visible) return;
    setReviewing(true);
    closeQuickAi();
  }, [closeQuickAi, visible]);
  const refine = useCallback(() => {
    if (!visible) return;
    setReviewing(false);
    openQuickAi("new-mission");
  }, [openQuickAi, visible]);
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
    visible,
    replacingPlan,
    regeneratePlan,
    review,
    refine,
  };
}
