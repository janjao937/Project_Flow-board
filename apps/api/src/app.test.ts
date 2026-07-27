import { describe, expect, it } from "vitest";
import { buildApp } from "./app";
import { loadEnv } from "./env";

describe("health route", () => {
  it("returns ok status", async () => {
    const { app, stopWatchdog } = await buildApp(loadEnv({ NODE_ENV: "test" }));
    const response = await app.inject({ method: "GET", url: "/health" });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: "ok" });
    stopWatchdog();
    await app.close();
  });
});
