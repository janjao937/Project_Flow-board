import { afterEach, describe, expect, it, vi } from "vitest";
import { ensureLeaveSessionForIntent } from "./ensure-leave-session";
import { requestLeaveSessionConfirm } from "../ui/leave-session-confirm";
import { useSessionStore } from "../store/session-store";

vi.mock("../ui/leave-session-confirm", () => ({
  requestLeaveSessionConfirm: vi.fn(),
}));

describe("ensureLeaveSessionForIntent single-flight", () => {
  afterEach(() => {
    vi.mocked(requestLeaveSessionConfirm).mockReset();
    useSessionStore.setState({
      sessionId: null,
      role: null,
      token: null,
      joinCode: null,
      participantId: null,
      displayName: null,
      canEdit: true,
      guestsCanEdit: false,
      participants: [],
      endedReason: null,
      revision: 0,
    });
  });

  it("rejects a second concurrent intent instead of sharing the first promise", async () => {
    useSessionStore.setState({
      sessionId: "s1",
      role: "host",
      token: "t1",
    });

    let resolveConfirm!: (value: { kind: "left" }) => void;
    vi.mocked(requestLeaveSessionConfirm).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveConfirm = resolve;
        }),
    );

    const first = ensureLeaveSessionForIntent("new");
    const second = await ensureLeaveSessionForIntent("join");

    expect(second).toEqual({ ok: false, reason: "busy" });
    expect(requestLeaveSessionConfirm).toHaveBeenCalledTimes(1);

    resolveConfirm({ kind: "left" });
    await expect(first).resolves.toEqual({ ok: true, skippedConfirm: false });
  });
});
