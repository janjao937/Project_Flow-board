import { describe, expect, it } from "vitest";
import { buildApp } from "./app";
import { loadEnv } from "./env";

describe("sessions API", () => {
  it("creates a host session and lets a guest join with the code", async () => {
    const { app, stopWatchdog } = await buildApp(loadEnv({ NODE_ENV: "test" }));

    const created = await app.inject({
      method: "POST",
      url: "/sessions",
      payload: {
        workflowId: "wf_1",
        workflowName: "Demo",
        displayName: "Host",
        guestsCanEdit: true,
        snapshot: { manifest: { id: "wf_1" }, data: { boards: {} } },
      },
    });
    expect(created.statusCode).toBe(200);
    const hostBody = created.json();
    expect(hostBody.joinCode).toHaveLength(6);
    expect(hostBody.role).toBe("host");
    expect(hostBody.canEdit).toBe(true);

    const joined = await app.inject({
      method: "POST",
      url: "/sessions/join",
      payload: {
        code: hostBody.joinCode,
        displayName: "Guest",
      },
    });
    expect(joined.statusCode).toBe(200);
    const guestBody = joined.json();
    expect(guestBody.role).toBe("guest");
    expect(guestBody.canEdit).toBe(true);
    expect(guestBody.sessionId).toBe(hostBody.sessionId);

    const ended = await app.inject({
      method: "POST",
      url: `/sessions/${hostBody.sessionId}/end`,
      headers: { authorization: `Bearer ${hostBody.token}` },
    });
    expect(ended.statusCode).toBe(200);

    const joinAfterEnd = await app.inject({
      method: "POST",
      url: "/sessions/join",
      payload: { code: hostBody.joinCode, displayName: "Late" },
    });
    expect(joinAfterEnd.statusCode).toBe(404);

    stopWatchdog();
    await app.close();
  });

  it("rejects invalid join codes", async () => {
    const { app, stopWatchdog } = await buildApp(loadEnv({ NODE_ENV: "test" }));
    const response = await app.inject({
      method: "POST",
      url: "/sessions/join",
      payload: { code: "ZZZZZZ", displayName: "Guest" },
    });
    expect(response.statusCode).toBe(404);
    expect(response.json().error.code).toBe("JOIN_CODE_INVALID");
    stopWatchdog();
    await app.close();
  });

  it("lets host toggle guestsCanEdit", async () => {
    const { app, stopWatchdog } = await buildApp(loadEnv({ NODE_ENV: "test" }));
    const created = await app.inject({
      method: "POST",
      url: "/sessions",
      payload: {
        workflowId: "wf_2",
        workflowName: "Toggle",
        displayName: "Host",
        guestsCanEdit: false,
      },
    });
    const hostBody = created.json();

    const patched = await app.inject({
      method: "PATCH",
      url: `/sessions/${hostBody.sessionId}`,
      headers: { authorization: `Bearer ${hostBody.token}` },
      payload: { guestsCanEdit: true },
    });
    expect(patched.statusCode).toBe(200);
    expect(patched.json().guestsCanEdit).toBe(true);

    stopWatchdog();
    await app.close();
  });
});
