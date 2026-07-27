import { describe, expect, it } from "vitest";
import { AppError, ErrorCode } from "../../../packages/errors/src/index";
import { buildApp } from "./app.js";
import { loadEnv } from "./env.js";

describe("errorHandler", () => {
  it("serializes AppError with its code, messageKey and http status", async () => {
    const app = await buildApp(loadEnv({ NODE_ENV: "test" }));
    app.get("/test-app-error", async () => {
      throw AppError.from(ErrorCode.JOIN_CODE_INVALID);
    });

    const response = await app.inject({ method: "GET", url: "/test-app-error" });
    expect(response.statusCode).toBe(404);
    expect(response.json()).toMatchObject({
      error: {
        code: "JOIN_CODE_INVALID",
        messageKey: "errors.joinCodeInvalid",
      },
    });
    await app.close();
  });

  it("maps unknown errors to INTERNAL without leaking the message", async () => {
    const app = await buildApp(loadEnv({ NODE_ENV: "test" }));
    app.get("/test-unknown-error", async () => {
      throw new Error("secret internal detail");
    });

    const response = await app.inject({ method: "GET", url: "/test-unknown-error" });
    expect(response.statusCode).toBe(500);
    const body = response.json();
    expect(body.error.code).toBe("INTERNAL");
    expect(JSON.stringify(body)).not.toContain("secret internal detail");
    await app.close();
  });
});
