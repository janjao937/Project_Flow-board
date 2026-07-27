import { AppError } from "./appError.js";
import { ErrorCode } from "./errorCode.js";

export interface ErrorResponseBody {
  error: {
    code: ErrorCode;
    messageKey: string;
    requestId: string;
    details?: Record<string, unknown>;
  };
}

export function toErrorResponse(error: AppError, requestId: string): ErrorResponseBody {
  return {
    error: {
      code: error.code,
      messageKey: error.messageKey,
      requestId,
      details: error.details,
    },
  };
}
