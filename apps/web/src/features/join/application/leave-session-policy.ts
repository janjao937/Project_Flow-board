/**
 * Phase 0 — Leave-session confirm policy (pure logic).
 * Spec: docs/sr/SR-leave-session-confirm.md
 *
 * UI / stores are NOT imported here. Phase 1+ executes plans against session/workflow stores.
 */

export type LeaveIntent = "new" | "join" | "open";

export type LeaveAction = "endSession" | "clear";

export type SessionRole = "host" | "guest";

export type LeaveSessionSnapshot = {
  sessionId: string | null;
  role: SessionRole | null;
};

/** No active session → run the intent immediately. */
export type ProceedDecision = {
  kind: "proceed";
};

/** Active session → show confirm; do not run intent yet. */
export type ConfirmDecision = {
  kind: "confirm";
  intent: LeaveIntent;
  role: SessionRole;
  leaveAction: LeaveAction;
};

export type GateDecision = ProceedDecision | ConfirmDecision;

export type AbortPlan = {
  kind: "abort";
};

export type LeaveThenProceedPlan = {
  kind: "leaveThenProceed";
  leaveAction: LeaveAction;
  intent: LeaveIntent;
};

export type ResolvePlan = AbortPlan | LeaveThenProceedPlan;

export type ConfirmChoice = "ok" | "cancel";

/**
 * FR-1..3 — Decide whether New/Join/Open may proceed or must confirm first.
 */
export function decideLeaveGate(
  state: LeaveSessionSnapshot,
  intent: LeaveIntent,
): GateDecision {
  if (!state.sessionId || !state.role) {
    return { kind: "proceed" };
  }

  return {
    kind: "confirm",
    intent,
    role: state.role,
    leaveAction: state.role === "host" ? "endSession" : "clear",
  };
}

/**
 * FR-4..6 — Map modal OK/Cancel to an executable plan.
 * Only valid for ConfirmDecision (caller must not pass proceed).
 */
export function resolveLeaveConfirm(
  decision: ConfirmDecision,
  choice: ConfirmChoice,
): ResolvePlan {
  if (choice === "cancel") {
    return { kind: "abort" };
  }

  return {
    kind: "leaveThenProceed",
    leaveAction: decision.leaveAction,
    intent: decision.intent,
  };
}

/**
 * i18n key suffix helper for Phase 1 copy variants: `${intent}_${role}`.
 * Example: "new_host", "join_guest".
 */
export function leaveConfirmMessageKey(
  intent: LeaveIntent,
  role: SessionRole,
): `${LeaveIntent}_${SessionRole}` {
  return `${intent}_${role}`;
}

/**
 * Convenience for entry points (Phase 2+):
 * if proceed → caller runs intent;
 * if confirm → caller opens modal with decision.
 */
export function gateOrProceed(
  state: LeaveSessionSnapshot,
  intent: LeaveIntent,
): GateDecision {
  return decideLeaveGate(state, intent);
}
