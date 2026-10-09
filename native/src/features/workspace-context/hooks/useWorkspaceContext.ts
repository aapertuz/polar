import { useCallback, useEffect, useState } from "react";
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

export function useWorkspaceContext() {
  const [context, setContext] = useState<WorkspaceContext | null>(null);
  const [brief, setBrief] = useState("");
  const [briefSaved, setBriefSaved] = useState(false);
  const [noteTitle, setNoteTitle] = useState("");
  const [noteText, setNoteText] = useState("");
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const canEdit = context?.role === "owner";

  const refresh = useCallback(async () => {
    if (!isTauri()) {
      setFailure("Workspace context is available in the Polar desktop app.");
      return;
    }
    const result = await invoke<WorkspaceContext>("polar_workspace_context_get");
    setContext(result);
    setBrief(result.brief);
  }, []);

  const updateBrief = useCallback((value: string) => {
    setBrief(value);
    setBriefSaved(false);
  }, []);

  useEffect(() => {
    void refresh().catch((error: unknown) => setFailure(message(error)));
  }, [refresh]);

  const saveBrief = useCallback(async () => {
    if (!context || brief.length > 8000) return;
    setBusy(true);
    setFailure(null);
    setBriefSaved(false);
    try {
      await invoke("polar_workspace_context_save_brief", {
        brief,
        expectedRevision: context.revision,
      });
      setBriefSaved(true);
      await refresh();
    } catch (error) {
      setFailure(message(error));
    } finally {
      setBusy(false);
    }
  }, [brief, context, refresh]);

  const addNote = useCallback(async () => {
    if (!noteTitle.trim() || !noteText.trim()) return;
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
      await invoke("polar_workspace_context_source_add", { source });
      setNoteTitle("");
      setNoteText("");
      await refresh();
    } catch (error) {
      setFailure(message(error));
    } finally {
      setBusy(false);
    }
  }, [noteText, noteTitle, refresh]);

  const importDocuments = useCallback(
    async (replace?: WorkspaceSource) => {
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
              ...(replace ? { sourceId: replace.id, expectedRevision: replace.revision } : {}),
              source,
            },
          );
          if (replace) break;
        }
        await refresh();
        if (failures.length) setFailure(failures.join("\n"));
      } catch (error) {
        setFailure(message(error));
      } finally {
        setBusy(false);
      }
    },
    [refresh],
  );

  const archive = useCallback(
    async (source: WorkspaceSource) => {
      setBusy(true);
      setFailure(null);
      try {
        await invoke("polar_workspace_context_source_archive", {
          sourceId: source.id,
          expectedRevision: source.revision,
        });
        await refresh();
      } catch (error) {
        setFailure(message(error));
      } finally {
        setBusy(false);
      }
    },
    [refresh],
  );

  return {
    context,
    brief,
    setBrief: updateBrief,
    briefSaved,
    noteTitle,
    setNoteTitle,
    noteText,
    setNoteText,
    busy,
    failure,
    setFailure,
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
