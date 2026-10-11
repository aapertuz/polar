import { useEffect, useRef } from "react";
import { useWorkspaceSettings } from "@/features/workspaces/hooks/useWorkspaceSettings";
import type { usePolarAccount } from "@/features/application-auth/hooks/usePolarAccount";

export function useOnboarding(account: ReturnType<typeof usePolarAccount>) {
  const workspace = useWorkspaceSettings(account);
  const heading = useRef<HTMLHeadingElement>(null);
  const loading = account.operation === "loading";
  const authenticated = account.status.authenticated;
  const operation = account.operation;
  useEffect(() => {
    if (!loading) {
      heading.current?.focus({ preventScroll: true });
      heading.current?.closest("main")?.scrollTo(0, 0);
    }
  }, [authenticated, loading, operation]);
  const selectWorkspace = (event: React.ChangeEvent<HTMLSelectElement>) => {
    if (event.currentTarget.value) void workspace.selectWorkspace(event.currentTarget.value);
  };
  const finish = () => {};
  return { workspace, heading, loading, selectWorkspace, finish };
}
