export const ErrorCode = {
  VALIDATION_FAILED: "VALIDATION_FAILED",
  NOT_FOUND: "NOT_FOUND",
  JOIN_CODE_INVALID: "JOIN_CODE_INVALID",
  JOIN_CODE_EXPIRED: "JOIN_CODE_EXPIRED",
  SESSION_NOT_FOUND: "SESSION_NOT_FOUND",
  SESSION_ENDED: "SESSION_ENDED",
  FORBIDDEN_READ_ONLY: "FORBIDDEN_READ_ONLY",
  WORKFLOW_PACK_INVALID: "WORKFLOW_PACK_INVALID",
  RATE_LIMITED: "RATE_LIMITED",
  INTERNAL: "INTERNAL",
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

interface ErrorCodeMeta {
  httpStatus: number;
  messageKey: string;
}

export const ERROR_CODE_META: Record<ErrorCode, ErrorCodeMeta> = {
  VALIDATION_FAILED: { httpStatus: 400, messageKey: "errors.validation" },
  NOT_FOUND: { httpStatus: 404, messageKey: "errors.notFound" },
  JOIN_CODE_INVALID: { httpStatus: 404, messageKey: "errors.joinCodeInvalid" },
  JOIN_CODE_EXPIRED: { httpStatus: 410, messageKey: "errors.joinCodeExpired" },
  SESSION_NOT_FOUND: { httpStatus: 404, messageKey: "errors.sessionNotFound" },
  SESSION_ENDED: { httpStatus: 410, messageKey: "errors.sessionEnded" },
  FORBIDDEN_READ_ONLY: { httpStatus: 403, messageKey: "errors.readOnly" },
  WORKFLOW_PACK_INVALID: { httpStatus: 422, messageKey: "errors.workflowPackInvalid" },
  RATE_LIMITED: { httpStatus: 429, messageKey: "errors.rateLimited" },
  INTERNAL: { httpStatus: 500, messageKey: "errors.unexpected" },
};

export function httpStatusForCode(code: ErrorCode): number {
  return ERROR_CODE_META[code].httpStatus;
}

export function messageKeyForCode(code: ErrorCode): string {
  return ERROR_CODE_META[code].messageKey;
}
