import type { ConfirmDecision } from "../application/leave-session-policy";

/** Outcome after the confirm dialog finishes. */
export type LeaveConfirmOutcome =
  | { kind: "cancelled" }
  | { kind: "left" }
  | { kind: "confirmed" }
  | { kind: "leave_failed" };

export type LeaveSessionConfirmRequest = {
  decision: ConfirmDecision;
  /** When false, OK only confirms — caller runs leave later (Open pick-before-leave). */
  executeLeave: boolean;
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

export type RequestLeaveSessionConfirmOptions = {
  translateError?: (key: string) => string;
  /** Default true. Set false to confirm without ending/clearing the session yet. */
  executeLeave?: boolean;
};

/**
 * Show leave-session confirm dialog.
 * - executeLeave true (default): OK runs leave while busy, then resolves "left"
 * - executeLeave false: OK resolves "confirmed" without leaving
 */
export function requestLeaveSessionConfirm(
  decision: ConfirmDecision,
  options: RequestLeaveSessionConfirmOptions = {},
): Promise<LeaveConfirmOutcome> {
  const executeLeave = options.executeLeave !== false;
  return new Promise((resolve) => {
    if (pending) {
      pending.resolve({ kind: "cancelled" });
    }
    pending = {
      decision,
      executeLeave,
      translateError: options.translateError,
      resolve: (outcome) => {
        pending = null;
        listener?.(null);
        resolve(outcome);
      },
    };
    listener?.(pending);
  });
}
