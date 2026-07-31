import { describe, expect, it } from "vitest";
import {
  requestLeaveSessionConfirm,
  subscribeLeaveSessionConfirm,
} from "../ui/leave-session-confirm";
import type { ConfirmDecision } from "./leave-session-policy";

const hostNew: ConfirmDecision = {
  kind: "confirm",
  intent: "new",
  role: "host",
  leaveAction: "endSession",
};

describe("requestLeaveSessionConfirm", () => {
  it("delivers the decision to the subscriber and resolves ok", async () => {
    const seen: ConfirmDecision[] = [];
    const unsubscribe = subscribeLeaveSessionConfirm((request) => {
      if (request) {
        seen.push(request.decision);
        request.resolve("ok");
      }
    });

    await expect(requestLeaveSessionConfirm(hostNew)).resolves.toBe("ok");
    expect(seen).toEqual([hostNew]);
    unsubscribe();
  });

  it("cancels previous pending when a new confirm is requested", async () => {
    let latest: { decision: ConfirmDecision; resolve: (c: "ok" | "cancel") => void } | null =
      null;
    const unsubscribe = subscribeLeaveSessionConfirm((request) => {
      latest = request;
    });

    const first = requestLeaveSessionConfirm(hostNew);
    const second = requestLeaveSessionConfirm({
      ...hostNew,
      intent: "join",
    });

    await expect(first).resolves.toBe("cancel");
    expect(latest?.decision.intent).toBe("join");
    latest?.resolve("ok");
    await expect(second).resolves.toBe("ok");
    unsubscribe();
  });
});
