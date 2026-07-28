import { ERROR_CODE_META, ErrorCode, type ErrorResponseBody } from "@/shared/packages/errors";
import { resolvePublicApiBase } from "./public-url";

export class ApiError extends Error {
  readonly code: ErrorCode;
  readonly messageKey: string;
  readonly requestId: string;
  readonly details?: Record<string, unknown>;
  readonly httpStatus: number;

  constructor(body: ErrorResponseBody["error"], httpStatus: number) {
    super(body.code);
    this.name = "ApiError";
    this.code = body.code;
    this.messageKey = body.messageKey;
    this.requestId = body.requestId;
    this.details = body.details;
    this.httpStatus = httpStatus;
  }
}

export function isApiError(value: unknown): value is ApiError {
  return value instanceof ApiError;
}

export async function apiFetch<T>(input: string, init?: RequestInit): Promise<T> {
  const base = resolvePublicApiBase();
  let response: Response;
  try {
    const headers = new Headers(init?.headers);
    if (init?.body != null && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }
    response = await fetch(`${base}${input}`, {
      ...init,
      headers,
    });
  } catch {
    throw new ApiError(
      {
        code: ErrorCode.INTERNAL,
        messageKey: "errors.apiUnavailable",
        requestId: "network",
      },
      0,
    );
  }

  if (!response.ok) {
    let payload: ErrorResponseBody | null = null;
    try {
      payload = (await response.json()) as ErrorResponseBody;
    } catch {
      payload = null;
    }

    if (payload?.error?.code) {
      throw new ApiError(payload.error, response.status);
    }

    throw new ApiError(
      {
        code: ErrorCode.INTERNAL,
        messageKey: ERROR_CODE_META.INTERNAL.messageKey,
        requestId: response.headers.get("x-request-id") ?? "unknown",
      },
      response.status,
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}
