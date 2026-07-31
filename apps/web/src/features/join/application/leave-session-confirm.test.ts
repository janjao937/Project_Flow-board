import { describe, expect, it } from "vitest";
import {
  requestLeaveSessionConfirm,
  subscribeLeaveSessionConfirm,
  type LeaveSessionConfirmRequest,
} from "../ui/leave-session-confirm";
import type { ConfirmDecision } from "./leave-session-policy";

const hostNew: ConfirmDecision = {
  kind: "confirm",
  intent: "new",
  role: "host",
  leaveAction: "endSession",
};

describe("requestLeaveSessionConfirm", () => {
  it("delivers the decision to the subscriber and resolves left", async () => {
    const seen: ConfirmDecision[] = [];
    const unsubscribe = subscribeLeaveSessionConfirm((request) => {
      if (request) {
        seen.push(request.decision);
        request.resolve({ kind: "left" });
      }
    });

    await expect(requestLeaveSessionConfirm(hostNew)).resolves.toEqual({ kind: "left" });
    expect(seen).toEqual([hostNew]);
    unsubscribe();
  });

  it("cancels previous pending when a new confirm is requested", async () => {
    let latest: LeaveSessionConfirmRequest | null = null;
    const unsubscribe = subscribeLeaveSessionConfirm((request) => {
      latest = request;
    });

    const first = requestLeaveSessionConfirm(hostNew);
    const second = requestLeaveSessionConfirm({
      ...hostNew,
      intent: "join",
    });

    await expect(first).resolves.toEqual({ kind: "cancelled" });
    const active = latest;
    expect(active).not.toBeNull();
    if (!active) {
      throw new Error("expected pending leave-session confirm request");
    }
    expect(active.decision.intent).toBe("join");
    active.resolve({ kind: "left" });
    await expect(second).resolves.toEqual({ kind: "left" });
    unsubscribe();
  });
});
