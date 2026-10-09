export function errorMessage(error: unknown, fallback: string): string {
  if (typeof error === "string" && error.trim()) return error;
  return error instanceof Error && error.message.trim() ? error.message : fallback;
}
