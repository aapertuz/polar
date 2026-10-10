import { useEffect, useState } from "react";
import type { OverlayRequest } from "@/components/ui/overlay.types";
import type { useWorkspaceSettings } from "@/features/workspaces/hooks/useWorkspaceSettings";

type WorkspaceSettingsModel = ReturnType<typeof useWorkspaceSettings>;

export function useWorkspaceSettingsSurface(
  model: WorkspaceSettingsModel,
  open: (request: OverlayRequest) => void,
) {
  const [section, setSection] = useState<"general" | "context">("general");
  const [name, setName] = useState("");
  const [privacy, setPrivacy] = useState<"private" | "shared">("private");
  const [confirmation, setConfirmation] = useState("");
  const workspaceId = model.workspace?.id ?? null;

  useEffect(() => {
    setName(model.workspace?.name ?? "");
    setPrivacy(model.workspace?.privacy ?? "private");
    setConfirmation("");
  }, [workspaceId, model.workspace?.name, model.workspace?.privacy]);

  const handleNameChange = (event: React.ChangeEvent<HTMLInputElement>) =>
    setName(event.currentTarget.value);
  const handlePrivacyChange = (event: React.ChangeEvent<HTMLSelectElement>) =>
    setPrivacy(event.currentTarget.value as "private" | "shared");
  const handleConfirmationChange = (event: React.ChangeEvent<HTMLInputElement>) =>
    setConfirmation(event.currentTarget.value);
  const handleSectionGeneral = () => setSection("general");
  const handleSectionContext = () => setSection("context");
  const handleOpenCreate = () => open({ kind: "workspace-create" });
  const handleSaveGeneral = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!workspaceId) return;
    void model.updateWorkspace(workspaceId, { name: name.trim(), privacy });
  };
  const handleDefaultChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    void model.setDefaultWorkspace(event.currentTarget.value || null);
  };
  const handleDelete = async () => {
    if (!workspaceId) return;
    const deleted = await model.deleteWorkspace(workspaceId, confirmation);
    if (deleted) setConfirmation("");
  };

  return {
    section,
    name,
    privacy,
    confirmation,
    handleNameChange,
    handlePrivacyChange,
    handleConfirmationChange,
    handleSectionGeneral,
    handleSectionContext,
    handleOpenCreate,
    handleSaveGeneral,
    handleDefaultChange,
    handleDelete,
  };
}
