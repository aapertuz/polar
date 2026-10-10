import { useCallback, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { WorkspaceSummary } from "@polar/contracts";

interface PolarAccountModel {
  status: {
    authenticated: boolean;
    userId: string | null;
    selectedWorkspaceId: string | null;
    defaultWorkspaceId: string | null;
    workspaces: WorkspaceSummary[];
  };
  selectWorkspace: (workspaceId: string) => Promise<unknown>;
  reload: () => Promise<void>;
}

function workspaceErrorMessage(failure: unknown): string {
  if (failure && typeof failure === "object" && "message" in failure) {
    const message = failure.message;
    if (typeof message === "string" && message) return message;
  }
  if (typeof failure === "string" && failure) {
    try {
      const parsed: unknown = JSON.parse(failure);
      if (parsed && typeof parsed === "object" && "message" in parsed) {
        const message = parsed.message;
        if (typeof message === "string" && message) return message;
      }
    } catch {
      return failure;
    }
    return failure;
  }
  return "Workspace settings could not be updated. Try again.";
}

export function useWorkspaceSettings(account: PolarAccountModel) {
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState("");
  const [message, setMessage] = useState("");
  const workspaces = account.status.workspaces;
  const workspace = useMemo(
    () => workspaces.find((item) => item.id === account.status.selectedWorkspaceId) ?? null,
    [account.status.selectedWorkspaceId, workspaces],
  );

  const selectWorkspace = useCallback(
    async (workspaceId: string) => {
      setBusy(true);
      setFailure("");
      setMessage("");
      try {
        await account.selectWorkspace(workspaceId);
      } catch (error) {
        setFailure(workspaceErrorMessage(error));
      } finally {
        setBusy(false);
      }
    },
    [account.selectWorkspace],
  );

  const createWorkspace = useCallback(
    async (name: string, privacy: "private" | "shared") => {
      setBusy(true);
      setFailure("");
      setMessage("");
      try {
        const created = await invoke<WorkspaceSummary>("polar_workspace_create", { name, privacy });
        await account.selectWorkspace(created.id);
        setMessage("Workspace created.");
        return created;
      } catch (error) {
        setFailure(workspaceErrorMessage(error));
        return null;
      } finally {
        setBusy(false);
      }
    },
    [account.selectWorkspace],
  );

  const updateWorkspace = useCallback(
    async (workspaceId: string, updates: { name?: string; privacy?: "private" | "shared" }) => {
      setBusy(true);
      setFailure("");
      setMessage("");
      try {
        await invoke<WorkspaceSummary>("polar_workspace_update", { workspaceId, updates });
        await account.reload();
        setMessage("Workspace settings saved.");
        return true;
      } catch (error) {
        setFailure(workspaceErrorMessage(error));
        return false;
      } finally {
        setBusy(false);
      }
    },
    [account.reload],
  );

  const deleteWorkspace = useCallback(
    async (workspaceId: string, confirmationName: string) => {
      setBusy(true);
      setFailure("");
      setMessage("");
      try {
        await invoke("polar_workspace_delete", { workspaceId, confirmationName });
        await account.reload();
        setMessage("Workspace deleted.");
        return true;
      } catch (error) {
        setFailure(workspaceErrorMessage(error));
        return false;
      } finally {
        setBusy(false);
      }
    },
    [account.reload],
  );

  const setDefaultWorkspace = useCallback(
    async (defaultWorkspaceId: string | null) => {
      setBusy(true);
      setFailure("");
      setMessage("");
      try {
        await invoke("polar_workspace_set_default", { defaultWorkspaceId });
        await account.reload();
        setMessage(defaultWorkspaceId ? "Account default saved." : "Account default cleared.");
      } catch (error) {
        setFailure(workspaceErrorMessage(error));
      } finally {
        setBusy(false);
      }
    },
    [account.reload],
  );

  return {
    account,
    workspaces,
    workspace,
    busy,
    failure,
    message,
    createWorkspace,
    selectWorkspace,
    updateWorkspace,
    deleteWorkspace,
    setDefaultWorkspace,
  };
}
