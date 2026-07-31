import type { ConfirmDecision } from "../application/leave-session-policy";

/** Outcome after the confirm dialog finishes (leave may already be done on OK). */
export type LeaveConfirmOutcome =
  | { kind: "cancelled" }
  | { kind: "left" }
  | { kind: "leave_failed" };

export type LeaveSessionConfirmRequest = {
  decision: ConfirmDecision;
  translateError?: (key: string) => string;
  resolve: (outcome: LeaveConfirmOutcome) => void;
};

type Listener = (request: LeaveSessionConfirmRequest | null) => void;

let listener: Listener | null = null;
let pending: LeaveSessionConfirmRequest | null = null;

export function subscribeLeaveSessionConfirm(next: Listener): () => void {
  listener = next;
  if (pending) {
    next(pending);
  }
  return () => {
    if (listener === next) {
      listener = null;
    }
  };
}

/**
 * Phase 1/4 — Show leave-session confirm dialog.
 * On OK the host executes leave while busy, then resolves "left".
 * Dismiss / Cancel resolves "cancelled". Leave API failure resolves "leave_failed".
 */
export function requestLeaveSessionConfirm(
  decision: ConfirmDecision,
  translateError?: (key: string) => string,
): Promise<LeaveConfirmOutcome> {
  return new Promise((resolve) => {
    if (pending) {
      pending.resolve({ kind: "cancelled" });
    }
    pending = {
      decision,
      translateError,
      resolve: (outcome) => {
        pending = null;
        listener?.(null);
        resolve(outcome);
      },
    };
    listener?.(pending);
  });
}
