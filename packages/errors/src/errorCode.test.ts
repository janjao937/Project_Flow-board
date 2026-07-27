import { describe, expect, it } from "vitest";
import { ERROR_CODE_META, ErrorCode, httpStatusForCode, messageKeyForCode } from "./errorCode.js";

describe("errorCode", () => {
  it("has an http status and message key for every code", () => {
    for (const code of Object.values(ErrorCode)) {
      const meta = ERROR_CODE_META[code];
      expect(meta.httpStatus).toBeGreaterThanOrEqual(400);
      expect(meta.messageKey.startsWith("errors.")).toBe(true);
    }
  });

  it("maps VALIDATION_FAILED to 400", () => {
    expect(httpStatusForCode(ErrorCode.VALIDATION_FAILED)).toBe(400);
  });

  it("maps INTERNAL to 500 with unexpected message key", () => {
    expect(httpStatusForCode(ErrorCode.INTERNAL)).toBe(500);
    expect(messageKeyForCode(ErrorCode.INTERNAL)).toBe("errors.unexpected");
  });

  it("maps SESSION_ENDED to 410", () => {
    expect(httpStatusForCode(ErrorCode.SESSION_ENDED)).toBe(410);
  });
});
