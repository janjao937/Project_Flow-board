import { showErrorToast } from "@/shared/api-client/show-error-toast";
import { useSessionStore } from "../store/session-store";
import {
  decideLeaveGate,
  resolveLeaveConfirm,
  type LeaveAction,
  type LeaveIntent,
} from "./leave-session-policy";
import { requestLeaveSessionConfirm } from "../ui/leave-session-confirm";

/**
 * Execute the leave half of a leaveThenProceed plan (SR §6.3).
 * Throws / returns false on failure so the caller skips the intent.
 */
export async function executeLeaveAction(leaveAction: LeaveAction): Promise<void> {
  if (leaveAction === "endSession") {
    await useSessionStore.getState().endSession();
    return;
  }
  useSessionStore.getState().clear();
}

export type EnsureLeaveResult =
  | { ok: true; skippedConfirm: boolean }
  | { ok: false; reason: "cancelled" | "leave_failed" };

/**
 * Phase 1 entry helper for Phase 2 wiring:
 * 1) decideLeaveGate
 * 2) if confirm → requestLeaveSessionConfirm
 * 3) on OK → executeLeaveAction
 * 4) returns whether caller may run the intent
 */
export async function ensureLeaveSessionForIntent(
  intent: LeaveIntent,
  translateError?: (key: string) => string,
): Promise<EnsureLeaveResult> {
  const { sessionId, role } = useSessionStore.getState();
  const gate = decideLeaveGate({ sessionId, role }, intent);

  if (gate.kind === "proceed") {
    return { ok: true, skippedConfirm: true };
  }

  const choice = await requestLeaveSessionConfirm(gate);
  const plan = resolveLeaveConfirm(gate, choice);

  if (plan.kind === "abort") {
    return { ok: false, reason: "cancelled" };
  }

  try {
    await executeLeaveAction(plan.leaveAction);
    return { ok: true, skippedConfirm: false };
  } catch (error) {
    if (translateError) {
      showErrorToast(error, translateError);
    }
    return { ok: false, reason: "leave_failed" };
  }
}

/**
 * Phase 2 — SR §6.3 full path: leave (if needed) then run the UI intent.
 * No-ops when user cancels or leave fails.
 */
export async function runAfterLeaveSession(
  intent: LeaveIntent,
  translateError: (key: string) => string,
  run: () => void | Promise<void>,
): Promise<void> {
  const result = await ensureLeaveSessionForIntent(intent, translateError);
  if (!result.ok) {
    return;
  }
  await run();
}
