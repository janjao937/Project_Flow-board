import { ErrorCode, httpStatusForCode, messageKeyForCode } from "./errorCode";

export interface AppErrorOptions {
  details?: Record<string, unknown>;
  cause?: unknown;
}

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly httpStatus: number;
  readonly messageKey: string;
  readonly details?: Record<string, unknown>;

  constructor(code: ErrorCode, options: AppErrorOptions = {}) {
    super(code);
    this.name = "AppError";
    this.code = code;
    this.httpStatus = httpStatusForCode(code);
    this.messageKey = messageKeyForCode(code);
    this.details = options.details;
    if (options.cause !== undefined) {
      this.cause = options.cause;
    }
  }

  static from(code: ErrorCode, details?: Record<string, unknown>): AppError {
    return new AppError(code, { details });
  }
}

export function isAppError(value: unknown): value is AppError {
  return value instanceof AppError;
}
