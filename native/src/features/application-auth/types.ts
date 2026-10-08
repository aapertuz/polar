export interface PolarAuthStatus {
  authenticated: boolean;
  email: string | null;
  workspaceName: string | null;
  operation: "connecting" | null;
  userCode: string | null;
  verificationUrl: string | null;
  message: string | null;
}

export interface PolarSignOutResult {
  remoteRevocationConfirmed: boolean;
  status: PolarAuthStatus;
}
