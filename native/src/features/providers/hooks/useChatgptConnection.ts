import { useCallback, useEffect, useRef, useState } from "react";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import {
  accountLabel,
  providerErrorMessage,
} from "@/features/providers/utils/providerPresentation";
import type {
  ChatgptModel,
  ChatgptStatus,
  ConnectionOperation,
  DisconnectResult,
} from "@/features/providers/types/provider.types";

const EMPTY_STATUS: ChatgptStatus = { accounts: [], activeId: null, planNoticeSeen: false };

export function useChatgptConnection() {
  const [status, setStatus] = useState(EMPTY_STATUS);
  const [models, setModels] = useState<ChatgptModel[]>([]);
  const [operation, setOperation] = useState<ConnectionOperation | null>("loading");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const mounted = useRef(false);
  const running = useRef(false);
  const desktop = isTauri();
  const active = status.accounts.find((account) => account.id === status.activeId);
  const accountOptions = status.accounts.map((account) => ({
    id: account.id,
    label: accountLabel(account),
  }));
  const selectedModel = models.some((model) => model.slug === active?.model)
    ? (active?.model ?? "")
    : "";

  const loadModels = useCallback(async (nextStatus: ChatgptStatus) => {
    if (!mounted.current) return;
    setModels([]);
    const selected = nextStatus.accounts.find((account) => account.id === nextStatus.activeId);
    if (!selected?.connected) return;
    const nextModels = await invoke<ChatgptModel[]>("chatgpt_models");
    if (mounted.current) setModels(nextModels);
  }, []);

  const perform = useCallback(
    async (nextOperation: ConnectionOperation, work: () => Promise<void>) => {
      if (!mounted.current || running.current || !desktop) return;
      running.current = true;
      setOperation(nextOperation);
      setError("");
      setMessage("");
      try {
        await work();
      } catch (failure) {
        if (mounted.current) setError(providerErrorMessage(failure));
      } finally {
        running.current = false;
        if (mounted.current) setOperation(null);
      }
    },
    [desktop],
  );

  const refresh = useCallback(() => {
    void perform("loading", async () => {
      const nextStatus = await invoke<ChatgptStatus>("chatgpt_status");
      if (!mounted.current) return;
      setStatus(nextStatus);
      await loadModels(nextStatus);
    });
  }, [perform, loadModels]);

  useEffect(() => {
    mounted.current = true;
    let disposed = false;
    // React Strict Mode replays mount effects. Start IPC only for the live effect.
    queueMicrotask(() => {
      if (disposed) return;
      if (desktop) refresh();
      else setOperation(null);
    });
    return () => {
      disposed = true;
      mounted.current = false;
      if (running.current) void invoke("chatgpt_cancel").catch(() => {});
    };
  }, [desktop, refresh]);

  const connect = useCallback(
    (accountId: string | null) => {
      void perform("connecting", async () => {
        const nextStatus = await invoke<ChatgptStatus>("chatgpt_connect", { accountId });
        if (!mounted.current) return;
        setStatus(nextStatus);
        setMessage("ChatGPT account connected. Choose a model, then test access.");
        await loadModels(nextStatus);
      });
    },
    [perform, loadModels],
  );
  const addAccount = useCallback(() => connect(null), [connect]);
  const reconnect = useCallback(() => connect(status.activeId), [connect, status.activeId]);

  const selectAccount = useCallback(
    (event: React.ChangeEvent<HTMLSelectElement>) => {
      const accountId = event.currentTarget.value;
      void perform("selecting", async () => {
        const nextStatus = await invoke<ChatgptStatus>("chatgpt_select_account", { accountId });
        if (!mounted.current) return;
        setStatus(nextStatus);
        await loadModels(nextStatus);
      });
    },
    [perform, loadModels],
  );
  const selectModel = useCallback(
    (event: React.ChangeEvent<HTMLSelectElement>) => {
      const model = event.currentTarget.value;
      void perform("selecting", async () => {
        const nextStatus = await invoke<ChatgptStatus>("chatgpt_select_model", { model });
        if (mounted.current) setStatus(nextStatus);
      });
    },
    [perform],
  );
  const testConnection = useCallback(() => {
    void perform("testing", async () => {
      await invoke<string>("chatgpt_test");
      if (mounted.current)
        setMessage("Connection verified. Your selected model completed the test.");
    });
  }, [perform]);
  const disconnect = useCallback(() => {
    if (!status.activeId) return;
    const accountId = status.activeId;
    void perform("disconnecting", async () => {
      const result = await invoke<DisconnectResult>("chatgpt_disconnect", { accountId });
      if (!mounted.current) return;
      setStatus(result.status);
      setModels([]);
      setMessage(
        result.revocationConfirmed
          ? "Disconnected from ChatGPT."
          : "Disconnected on this device. Remote revocation was not confirmed; disconnect Polar in ChatGPT Settings to end remote access.",
      );
    });
  }, [perform, status.activeId]);
  const cancel = useCallback(() => {
    void invoke("chatgpt_cancel").catch((failure: unknown) => {
      if (mounted.current) setError(providerErrorMessage(failure));
    });
  }, []);
  const openUsage = useCallback(() => {
    void openUrl("https://chatgpt.com/settings/usage").catch((failure: unknown) => {
      if (mounted.current) setError(providerErrorMessage(failure));
    });
  }, []);

  const acknowledgePlan = useCallback(() => {
    void perform("selecting", async () => {
      const nextStatus = await invoke<ChatgptStatus>("chatgpt_acknowledge_plan");
      if (mounted.current) setStatus(nextStatus);
    });
  }, [perform]);

  return {
    showPlanNotice: Boolean(active?.connected && !status.planNoticeSeen && !operation),
    acknowledgePlan,
    desktop,
    active,
    accountOptions,
    selectedModel,
    models,
    operation,
    busy: operation !== null,
    message,
    error,
    addAccount,
    reconnect,
    selectAccount,
    selectModel,
    testConnection,
    disconnect,
    cancel,
    refresh,
    openUsage,
  };
}
