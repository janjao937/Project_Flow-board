/** Shared user-cancel detection for file picker / passphrase / AbortError. */
export function isUserCancelledError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }
  const candidate = error as { name?: string; message?: string };
  return (
    candidate.message === "cancelled" ||
    candidate.name === "AbortError" ||
    /aborted|cancel/i.test(candidate.message ?? "")
  );
}
