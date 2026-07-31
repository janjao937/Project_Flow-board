import type { ConfirmChoice, ConfirmDecision } from "../application/leave-session-policy";

export type LeaveSessionConfirmRequest = {
  decision: ConfirmDecision;
  resolve: (choice: ConfirmChoice) => void;
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
 * Phase 1 — Show leave-session confirm dialog.
 * Resolves "ok" | "cancel". Dismiss without confirm counts as cancel.
 */
export function requestLeaveSessionConfirm(
  decision: ConfirmDecision,
): Promise<ConfirmChoice> {
  return new Promise((resolve) => {
    if (pending) {
      pending.resolve("cancel");
    }
    pending = {
      decision,
      resolve: (choice) => {
        pending = null;
        listener?.(null);
        resolve(choice);
      },
    };
    listener?.(pending);
  });
}
