import { describe, expect, it } from "vitest";
import { AppError, isAppError } from "./appError";
import { ErrorCode } from "./errorCode";
import { toErrorResponse } from "./errorResponse";

describe("AppError", () => {
  it("carries http status and message key derived from the code", () => {
    const error = AppError.from(ErrorCode.JOIN_CODE_INVALID);
    expect(error.httpStatus).toBe(404);
    expect(error.messageKey).toBe("errors.joinCodeInvalid");
  });

  it("is detected by isAppError", () => {
    expect(isAppError(AppError.from(ErrorCode.INTERNAL))).toBe(true);
    expect(isAppError(new Error("plain"))).toBe(false);
  });

  it("serializes to the standard error response shape", () => {
    const error = AppError.from(ErrorCode.VALIDATION_FAILED, { fields: ["name"] });
    const body = toErrorResponse(error, "req_1");
    expect(body).toEqual({
      error: {
        code: "VALIDATION_FAILED",
        messageKey: "errors.validation",
        requestId: "req_1",
        details: { fields: ["name"] },
      },
    });
  });
});
