import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useWorkspaceContext } from "@/features/workspace-context/hooks/useWorkspaceContext";
import type { WorkspaceSource } from "@/features/workspace-context/hooks/useWorkspaceContext";

export function useWorkspaceContextSurface() {
  const model = useWorkspaceContext();
  const [editing, setEditing] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editText, setEditText] = useState("");
  const handleBriefChange = (event: React.ChangeEvent<HTMLTextAreaElement>) =>
    model.setBrief(event.currentTarget.value);
  const handleNoteTitleChange = (event: React.ChangeEvent<HTMLInputElement>) =>
    model.setNoteTitle(event.currentTarget.value);
  const handleNoteTextChange = (event: React.ChangeEvent<HTMLTextAreaElement>) =>
    model.setNoteText(event.currentTarget.value);
  const handleEditTitleChange = (event: React.ChangeEvent<HTMLInputElement>) =>
    setEditTitle(event.currentTarget.value);
  const handleEditTextChange = (event: React.ChangeEvent<HTMLTextAreaElement>) =>
    setEditText(event.currentTarget.value);
  const handleBeginEdit = (event: React.MouseEvent<HTMLButtonElement>) => {
    const source = model.context?.sources.find(
      (item) => item.id === event.currentTarget.dataset.sourceId,
    );
    if (!source) return;
    setEditing(source.id);
    setEditTitle(source.title);
    setEditText(source.extractedText);
  };
  const handleSaveSource = (event: React.MouseEvent<HTMLButtonElement>) => {
    const source = model.context?.sources.find(
      (item) => item.id === event.currentTarget.dataset.sourceId,
    );
    if (!source) return;
    void saveSource(source, editTitle, editText, model.refresh, setEditing, model.setFailure);
  };
  const handleCancelEdit = () => setEditing(null);
  const handleImportDocument = () => {
    void model.importDocuments();
  };
  const handleReplaceDocument = (event: React.MouseEvent<HTMLButtonElement>) => {
    const source = model.context?.sources.find(
      (item) => item.id === event.currentTarget.dataset.sourceId,
    );
    if (source) void model.importDocuments(source);
  };
  const handleAddNote = () => {
    void model.addNote();
  };
  const handleSaveBrief = () => {
    void model.saveBrief();
  };
  const handleArchive = (event: React.MouseEvent<HTMLButtonElement>) => {
    const source = model.context?.sources.find(
      (item) => item.id === event.currentTarget.dataset.sourceId,
    );
    if (source) void model.archive(source);
  };
  return {
    ...model,
    editing,
    editTitle,
    editText,
    handleBriefChange,
    handleNoteTitleChange,
    handleNoteTextChange,
    handleEditTitleChange,
    handleEditTextChange,
    handleBeginEdit,
    handleSaveSource,
    handleCancelEdit,
    handleImportDocument,
    handleReplaceDocument,
    handleAddNote,
    handleSaveBrief,
    handleArchive,
  };
}

async function saveSource(
  source: WorkspaceSource,
  title: string,
  extractedText: string,
  refresh: () => Promise<void>,
  setEditing: (id: string | null) => void,
  setFailure: (message: string | null) => void,
) {
  try {
    await invoke("polar_workspace_context_source_replace", {
      sourceId: source.id,
      expectedRevision: source.revision,
      source: {
        id: source.id,
        kind: source.kind,
        title: title.trim(),
        fileName: source.fileName,
        contentHash: source.kind === "document" ? source.contentHash : null,
        extractedText: extractedText.trim(),
      },
    });
    setEditing(null);
    await refresh();
  } catch (error) {
    setFailure(error instanceof Error ? error.message : String(error));
  }
}
