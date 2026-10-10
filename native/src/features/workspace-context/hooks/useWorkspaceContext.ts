import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { invoke, isTauri } from "@tauri-apps/api/core";

export interface WorkspaceSource {
  id: string;
  kind: "document" | "note";
  title: string;
  fileName: string | null;
  contentHash: string | null;
  extractedText: string;
  revision: number;
  createdAt: string;
  updatedAt: string;
}
interface WorkspaceContext {
  workspaceId: string;
  workspaceName: string;
  role: string;
  brief: string;
  revision: number;
  sources: WorkspaceSource[];
}
interface ImportedSource {
  id: string;
  fileName: string;
  contentHash: string;
  extractedText: string;
  provenance: string;
}
interface ContextDraft {
  brief: string;
  noteTitle: string;
  noteText: string;
}

const drafts = new Map<string, ContextDraft>();
const EMPTY_DRAFT: ContextDraft = { brief: "", noteTitle: "", noteText: "" };

export function clearWorkspaceContextDrafts(accountId: string, workspaceId?: string) {
  if (workspaceId) {
    drafts.delete(`${accountId}:${workspaceId}`);
    return;
  }
  const prefix = `${accountId}:`;
  for (const key of drafts.keys()) if (key.startsWith(prefix)) drafts.delete(key);
}

export function useWorkspaceContext(workspaceId: string | null, accountId: string | null) {
  const scopeKey = useMemo(
    () => (workspaceId && accountId ? `${accountId}:${workspaceId}` : null),
    [accountId, workspaceId],
  );
  const activeScope = useRef(scopeKey);
  activeScope.current = scopeKey;
  const [context, setContext] = useState<WorkspaceContext | null>(null);
  const [loadedScope, setLoadedScope] = useState<string | null>(null);
  const [brief, setBrief] = useState("");
  const [briefSaved, setBriefSaved] = useState(false);
  const [noteTitle, setNoteTitle] = useState("");
  const [noteText, setNoteText] = useState("");
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const visibleContext = loadedScope === scopeKey ? context : null;
  const canEdit = visibleContext?.role === "owner";

  useEffect(() => {
    setContext(null);
    setLoadedScope(scopeKey);
    setFailure(null);
    setBriefSaved(false);
    setBusy(false);
    if (!scopeKey || !workspaceId) {
      setBrief("");
      setNoteTitle("");
      setNoteText("");
      setBusy(false);
      return;
    }
    const cached = drafts.get(scopeKey);
    const current = cached ?? EMPTY_DRAFT;
    setBrief(current.brief);
    setNoteTitle(current.noteTitle);
    setNoteText(current.noteText);
    if (!isTauri()) {
      setFailure("Workspace context is available in the Polar desktop app.");
      return;
    }
    void invoke<WorkspaceContext>("polar_workspace_context_get", { workspaceId })
      .then((result) => {
        if (activeScope.current !== scopeKey) return;
        setContext(result);
        if (!cached || result.role !== "owner") setBrief(result.brief);
      })
      .catch((error: unknown) => {
        if (activeScope.current === scopeKey) setFailure(message(error));
      });
  }, [scopeKey, workspaceId]);

  useEffect(() => {
    if (scopeKey && loadedScope === scopeKey) drafts.set(scopeKey, { brief, noteTitle, noteText });
  }, [brief, loadedScope, noteText, noteTitle, scopeKey]);

  const refresh = useCallback(async () => {
    if (!workspaceId || !scopeKey) return;
    if (!isTauri()) {
      setFailure("Workspace context is available in the Polar desktop app.");
      return;
    }
    const result = await invoke<WorkspaceContext>("polar_workspace_context_get", { workspaceId });
    if (activeScope.current !== scopeKey) return;
    setContext(result);
  }, [scopeKey, workspaceId]);

  const updateBrief = useCallback((value: string) => {
    setBrief(value);
    setBriefSaved(false);
  }, []);
  const scopeLoaded = loadedScope === scopeKey;

  const saveBrief = useCallback(async () => {
    if (!workspaceId || !scopeKey || !visibleContext || brief.length > 8000) return;
    const originScope = scopeKey;
    setBusy(true);
    setFailure(null);
    setBriefSaved(false);
    try {
      const saved = await invoke<{ brief: string; revision: number }>(
        "polar_workspace_context_save_brief",
        { workspaceId, brief, expectedRevision: visibleContext.revision },
      );
      if (activeScope.current === originScope) {
        setContext((current) =>
          current ? { ...current, brief: saved.brief, revision: saved.revision } : current,
        );
        setBrief(saved.brief);
        setBriefSaved(true);
      }
    } catch (error) {
      if (activeScope.current === originScope) setFailure(message(error));
    } finally {
      if (activeScope.current === originScope) setBusy(false);
    }
  }, [brief, scopeKey, visibleContext, workspaceId]);

  const addNote = useCallback(async () => {
    if (!workspaceId || !scopeKey || !noteTitle.trim() || !noteText.trim()) return;
    const originScope = scopeKey;
    const source = {
      id: crypto.randomUUID(),
      kind: "note",
      title: noteTitle.trim(),
      fileName: null,
      contentHash: null,
      extractedText: noteText.trim(),
    };
    setBusy(true);
    setFailure(null);
    try {
      await invoke("polar_workspace_context_source_add", { workspaceId, source });
      if (activeScope.current !== originScope) return;
      setNoteTitle("");
      setNoteText("");
      await refresh();
    } catch (error) {
      if (activeScope.current === originScope) setFailure(message(error));
    } finally {
      if (activeScope.current === originScope) setBusy(false);
    }
  }, [noteText, noteTitle, refresh, scopeKey, workspaceId]);

  const importDocuments = useCallback(
    async (replace?: WorkspaceSource) => {
      if (!workspaceId || !scopeKey) return;
      const originScope = scopeKey;
      setBusy(true);
      setFailure(null);
      try {
        const result = await invoke<{
          sources: ImportedSource[];
          failures: { fileName: string; message: string }[];
        }>("polar_import_workspace_context");
        const failures = result.failures.map((item) => `${item.fileName}: ${item.message}`);
        for (const imported of result.sources) {
          const source = {
            id: replace?.id ?? imported.id,
            kind: "document",
            title: replace?.title ?? imported.fileName,
            fileName: imported.fileName,
            contentHash: imported.contentHash,
            extractedText: imported.extractedText,
          };
          await invoke(
            replace
              ? "polar_workspace_context_source_replace"
              : "polar_workspace_context_source_add",
            {
              workspaceId,
              ...(replace ? { sourceId: replace.id, expectedRevision: replace.revision } : {}),
              source,
            },
          );
          if (replace) break;
        }
        if (activeScope.current !== originScope) return;
        await refresh();
        if (failures.length) setFailure(failures.join("\n"));
      } catch (error) {
        if (activeScope.current === originScope) setFailure(message(error));
      } finally {
        if (activeScope.current === originScope) setBusy(false);
      }
    },
    [refresh, scopeKey, workspaceId],
  );

  const archive = useCallback(
    async (source: WorkspaceSource) => {
      if (!workspaceId || !scopeKey) return;
      const originScope = scopeKey;
      setBusy(true);
      setFailure(null);
      try {
        await invoke("polar_workspace_context_source_archive", {
          workspaceId,
          sourceId: source.id,
          expectedRevision: source.revision,
        });
        if (activeScope.current === originScope) await refresh();
      } catch (error) {
        if (activeScope.current === originScope) setFailure(message(error));
      } finally {
        if (activeScope.current === originScope) setBusy(false);
      }
    },
    [refresh, scopeKey, workspaceId],
  );

  return {
    context: visibleContext,
    brief: scopeLoaded ? brief : "",
    setBrief: updateBrief,
    briefSaved: scopeLoaded && briefSaved,
    noteTitle: scopeLoaded ? noteTitle : "",
    setNoteTitle,
    noteText: scopeLoaded ? noteText : "",
    setNoteText,
    busy: scopeLoaded && busy,
    failure: scopeLoaded ? failure : null,
    setFailure: (value: string | null) => {
      if (scopeLoaded && activeScope.current === scopeKey) setFailure(value);
    },
    canEdit,
    saveBrief,
    addNote,
    importDocuments,
    archive,
    refresh,
  };
}

function message(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
