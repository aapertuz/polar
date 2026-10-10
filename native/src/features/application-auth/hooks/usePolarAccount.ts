import { useCallback, useEffect, useRef, useState } from "react";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import { accountErrorMessage } from "@/features/application-auth/utils/accountPresentation";
import type { PolarAuthStatus, PolarSignOutResult } from "@/features/application-auth/types";

const EMPTY_STATUS: PolarAuthStatus = {
  authenticated: false,
  email: null,
  userId: null,
  selectedWorkspaceId: null,
  workspaceName: null,
  workspacePrivacy: null,
  workspaces: [],
  defaultWorkspaceId: null,
  operation: null,
  userCode: null,
  verificationUrl: null,
  message: null,
};

export function usePolarAccount() {
  const [status, setStatus] = useState(EMPTY_STATUS);
  const [operation, setOperation] = useState<"loading" | "connecting" | "signing-out" | null>(
    "loading",
  );
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const mounted = useRef(false);
  const running = useRef(false);
  const desktop = isTauri();

  const load = useCallback(async () => {
    if (!desktop || !mounted.current || running.current) return;
    running.current = true;
    setOperation("loading");
    setError("");
    try {
      const next = await invoke<PolarAuthStatus>("polar_auth_status");
      if (mounted.current) {
        setStatus(next);
        setMessage(next.message ?? "");
      }
    } catch (failure) {
      if (mounted.current) setError(accountErrorMessage(failure));
    } finally {
      running.current = false;
      if (mounted.current) setOperation(null);
    }
  }, [desktop]);

  useEffect(() => {
    mounted.current = true;
    let disposed = false;
    queueMicrotask(() => {
      if (!disposed) {
        if (desktop) void load();
        else setOperation(null);
      }
    });
    return () => {
      disposed = true;
      mounted.current = false;
      if (running.current) void invoke("polar_auth_cancel").catch(() => {});
    };
  }, [desktop, load]);

  const connect = useCallback(async () => {
    if (!desktop || running.current) return;
    running.current = true;
    setOperation("connecting");
    setError("");
    setMessage("");
    setStatus({ ...EMPTY_STATUS, operation: "connecting" });
    let done = false;
    const poll = async () => {
      while (!done && mounted.current) {
        await new Promise((resolve) => window.setTimeout(resolve, 500));
        if (done || !mounted.current) return;
        try {
          const next = await invoke<PolarAuthStatus>("polar_auth_status");
          if (mounted.current && next.operation === "connecting") setStatus(next);
        } catch {
          // The connect command reports its final error after polling stops.
        }
      }
    };
    const pollTask = poll();
    try {
      const next = await invoke<PolarAuthStatus>("polar_auth_connect");
      if (mounted.current) {
        setStatus(next);
        setMessage("Polar account connected.");
      }
    } catch (failure) {
      if (mounted.current) setError(accountErrorMessage(failure));
    } finally {
      done = true;
      await pollTask;
      running.current = false;
      if (mounted.current) setOperation(null);
    }
  }, [desktop]);

  const cancel = useCallback(async () => {
    try {
      await invoke("polar_auth_cancel");
    } catch (failure) {
      if (mounted.current) setError(accountErrorMessage(failure));
    }
  }, []);

  const signOut = useCallback(async () => {
    if (!desktop || running.current) return;
    running.current = true;
    setOperation("signing-out");
    setError("");
    setMessage("");
    try {
      const result = await invoke<PolarSignOutResult>("polar_auth_sign_out");
      if (!mounted.current) return;
      setStatus(result.status);
      setMessage(
        result.remoteRevocationConfirmed
          ? "Signed out of Polar."
          : "Signed out on this desktop. Remote sign-out could not be confirmed; reconnect to Polar to revoke the session.",
      );
    } catch (failure) {
      if (mounted.current) setError(accountErrorMessage(failure));
    } finally {
      running.current = false;
      if (mounted.current) setOperation(null);
    }
  }, [desktop]);

  const openVerification = useCallback(async () => {
    const verificationUrl = status.verificationUrl;
    if (!verificationUrl) return;
    try {
      await openUrl(verificationUrl);
    } catch (failure) {
      if (mounted.current) setError(accountErrorMessage(failure));
    }
  }, [status.verificationUrl]);

  const selectWorkspace = useCallback(
    async (workspaceId: string) => {
      if (!desktop) throw new Error("Workspace selection requires the Polar desktop app.");
      const next = await invoke<PolarAuthStatus>("polar_workspace_select", { workspaceId });
      if (mounted.current) setStatus(next);
      return next;
    },
    [desktop],
  );

  return {
    status,
    operation,
    error,
    message,
    desktop,
    busy: operation !== null,
    connect,
    cancel,
    signOut,
    openVerification,
    selectWorkspace,
    reload: load,
  };
}
