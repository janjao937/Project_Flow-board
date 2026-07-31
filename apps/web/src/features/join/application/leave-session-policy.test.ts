import { describe, expect, it } from "vitest";
import {
  decideLeaveGate,
  leaveConfirmMessageKey,
  resolveLeaveConfirm,
  type ConfirmDecision,
} from "./leave-session-policy";

describe("decideLeaveGate (SR FR-1..3)", () => {
  it("proceeds when there is no session", () => {
    expect(
      decideLeaveGate({ sessionId: null, role: null }, "new"),
    ).toEqual({ kind: "proceed" });
  });

  it("proceeds when sessionId exists but role is missing (defensive)", () => {
    expect(
      decideLeaveGate({ sessionId: "s1", role: null }, "join"),
    ).toEqual({ kind: "proceed" });
  });

  it("requires confirm for host with endSession leave action", () => {
    expect(
      decideLeaveGate({ sessionId: "s1", role: "host" }, "new"),
    ).toEqual({
      kind: "confirm",
      intent: "new",
      role: "host",
      leaveAction: "endSession",
    });
  });

  it("requires confirm for guest with clear leave action", () => {
    expect(
      decideLeaveGate({ sessionId: "s1", role: "guest" }, "join"),
    ).toEqual({
      kind: "confirm",
      intent: "join",
      role: "guest",
      leaveAction: "clear",
    });
  });

  it("preserves open intent on confirm", () => {
    const decision = decideLeaveGate({ sessionId: "s1", role: "host" }, "open");
    expect(decision).toMatchObject({ kind: "confirm", intent: "open" });
  });
});

describe("resolveLeaveConfirm (SR FR-4..6)", () => {
  const hostNew: ConfirmDecision = {
    kind: "confirm",
    intent: "new",
    role: "host",
    leaveAction: "endSession",
  };

  const guestJoin: ConfirmDecision = {
    kind: "confirm",
    intent: "join",
    role: "guest",
    leaveAction: "clear",
  };

  it("cancel aborts and keeps session (no leave)", () => {
    expect(resolveLeaveConfirm(hostNew, "cancel")).toEqual({ kind: "abort" });
  });

  it("host OK plans endSession then proceed with intent", () => {
    expect(resolveLeaveConfirm(hostNew, "ok")).toEqual({
      kind: "leaveThenProceed",
      leaveAction: "endSession",
      intent: "new",
    });
  });

  it("guest OK plans clear then proceed with intent", () => {
    expect(resolveLeaveConfirm(guestJoin, "ok")).toEqual({
      kind: "leaveThenProceed",
      leaveAction: "clear",
      intent: "join",
    });
  });
});

describe("leaveConfirmMessageKey", () => {
  it("builds intent_role keys for i18n variants", () => {
    expect(leaveConfirmMessageKey("new", "host")).toBe("new_host");
    expect(leaveConfirmMessageKey("join", "guest")).toBe("join_guest");
    expect(leaveConfirmMessageKey("open", "host")).toBe("open_host");
  });
});
