import { useState } from "react";
import type { useWorkspaceSettings } from "@/features/workspaces/hooks/useWorkspaceSettings";

type WorkspaceSettingsModel = ReturnType<typeof useWorkspaceSettings>;

export function useWorkspaceCreateSurface(model: WorkspaceSettingsModel, close: () => void) {
  const [name, setName] = useState("");
  const [privacy, setPrivacy] = useState<"private" | "shared">("private");
  const handleNameChange = (event: React.ChangeEvent<HTMLInputElement>) =>
    setName(event.currentTarget.value);
  const handlePrivacyChange = (event: React.ChangeEvent<HTMLSelectElement>) =>
    setPrivacy(event.currentTarget.value as "private" | "shared");
  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const created = await model.createWorkspace(name, privacy);
    if (created) close();
  };
  return { name, privacy, handleNameChange, handlePrivacyChange, handleSubmit };
}
