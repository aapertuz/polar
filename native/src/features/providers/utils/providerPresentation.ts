import type { ChatgptAccount } from "@/features/providers/types/provider.types";

export function accountLabel(account: ChatgptAccount): string {
  return `${account.email || "ChatGPT account"} · ${account.label}`;
}

export function providerErrorMessage(error: unknown): string {
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }
  return "Could not complete this connection operation. Try again.";
}
