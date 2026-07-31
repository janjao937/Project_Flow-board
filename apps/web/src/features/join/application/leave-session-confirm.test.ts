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

  it("supports deferred leave (confirmed without leaving)", async () => {
    const box: { current: LeaveSessionConfirmRequest | null } = { current: null };
    const unsubscribe = subscribeLeaveSessionConfirm((request) => {
      box.current = request;
    });

    const pending = requestLeaveSessionConfirm(hostNew, { executeLeave: false });
    expect(box.current?.executeLeave).toBe(false);
    box.current?.resolve({ kind: "confirmed" });
    await expect(pending).resolves.toEqual({ kind: "confirmed" });
    unsubscribe();
  });

  it("cancels previous pending when a new confirm is requested", async () => {
    const box: { current: LeaveSessionConfirmRequest | null } = { current: null };
    const unsubscribe = subscribeLeaveSessionConfirm((request) => {
      box.current = request;
    });

    const first = requestLeaveSessionConfirm(hostNew);
    const second = requestLeaveSessionConfirm({
      ...hostNew,
      intent: "join",
    });

    await expect(first).resolves.toEqual({ kind: "cancelled" });
    expect(box.current?.decision.intent).toBe("join");
    box.current?.resolve({ kind: "left" });
    await expect(second).resolves.toEqual({ kind: "left" });
    unsubscribe();
  });
});
