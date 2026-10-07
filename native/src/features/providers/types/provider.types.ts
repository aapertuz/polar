export interface ChatgptAccount {
  id: string;
  email: string;
  label: string;
  connected: boolean;
  model: string | null;
}

export interface ChatgptStatus {
  accounts: ChatgptAccount[];
  activeId: string | null;
  planNoticeSeen: boolean;
}

export interface ChatgptModel {
  slug: string;
  display_name: string;
}

export interface DisconnectResult {
  status: ChatgptStatus;
  revocationConfirmed: boolean;
}

export type ConnectionOperation =
  | "loading"
  | "connecting"
  | "models"
  | "selecting"
  | "testing"
  | "disconnecting";
