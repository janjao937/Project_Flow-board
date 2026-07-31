import { describe, expect, it } from "vitest";
import { isUserCancelledError } from "@/shared/lib/is-user-cancelled-error";

describe("isUserCancelledError", () => {
  it("detects cancelled message and AbortError", () => {
    expect(isUserCancelledError(new Error("cancelled"))).toBe(true);
    const abort = new Error("The user aborted a request.");
    abort.name = "AbortError";
    expect(isUserCancelledError(abort)).toBe(true);
    expect(isUserCancelledError(new Error("boom"))).toBe(false);
  });
});
