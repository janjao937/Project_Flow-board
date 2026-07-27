import type { FastifyError, FastifyReply, FastifyRequest } from "fastify";
import { randomUUID } from "node:crypto";
import { AppError, ErrorCode, isAppError, toErrorResponse } from "../../../packages/errors/src/index";
import { ZodError } from "zod";

export function requestIdFromHeaders(request: FastifyRequest): string {
  const header = request.headers["x-request-id"];
  if (typeof header === "string" && header.length > 0) {
    return header;
  }
  return randomUUID();
}

export function errorHandler(
  error: FastifyError | ZodError | AppError | Error,
  request: FastifyRequest,
  reply: FastifyReply,
): void {
  const requestId = requestIdFromHeaders(request);

  if (isAppError(error)) {
    request.log.warn({ requestId, code: error.code }, error.message);
    reply.status(error.httpStatus).send(toErrorResponse(error, requestId));
    return;
  }

  if (error instanceof ZodError) {
    const appError = AppError.from(ErrorCode.VALIDATION_FAILED, {
      fields: error.issues.map((issue: { path: PropertyKey[] }) => issue.path.join(".")),
    });
    request.log.warn({ requestId, code: appError.code }, appError.message);
    reply.status(appError.httpStatus).send(toErrorResponse(appError, requestId));
    return;
  }

  request.log.error({ requestId, err: error }, "unhandled error");
  const internalError = AppError.from(ErrorCode.INTERNAL);
  reply.status(internalError.httpStatus).send(toErrorResponse(internalError, requestId));
}
