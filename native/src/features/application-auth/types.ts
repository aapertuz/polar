export interface PolarAuthStatus {
  authenticated: boolean;
  email: string | null;
  userId: string | null;
  selectedWorkspaceId: string | null;
  workspaceName: string | null;
  workspacePrivacy: "private" | "shared" | null;
  workspaces: WorkspaceSummary[];
  defaultWorkspaceId: string | null;
  operation: "connecting" | null;
  userCode: string | null;
  verificationUrl: string | null;
  message: string | null;
}

export interface WorkspaceSummary {
  id: string;
  name: string;
  privacy: "private" | "shared";
  role: "owner" | "member";
  createdAt: string;
}

export interface PolarSignOutResult {
  remoteRevocationConfirmed: boolean;
  status: PolarAuthStatus;
}
