export function accountErrorMessage(failure: unknown): string {
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
  return "Polar account could not be updated. Try again.";
}
