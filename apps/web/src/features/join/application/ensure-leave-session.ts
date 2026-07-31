import { useSessionStore } from "../store/session-store";
import { disconnectRealtimeNow } from "../infrastructure/realtime-disconnect";
import { decideLeaveGate, type LeaveAction, type LeaveIntent } from "./leave-session-policy";
import { requestLeaveSessionConfirm } from "../ui/leave-session-confirm";

/**
 * Execute the leave half of a leaveThenProceed plan (SR §6.3 / Phase 4).
 * Called from the confirm host while the dialog is busy (or by Open after pick).
 */
export async function executeLeaveAction(leaveAction: LeaveAction): Promise<void> {
  if (leaveAction === "endSession") {
    const before = useSessionStore.getState();
    if (!before.sessionId || before.role !== "host" || !before.token) {
      throw new Error("Cannot end session: not hosting an active session");
    }
    await before.endSession();
    if (useSessionStore.getState().sessionId) {
      throw new Error("Session was not cleared after endSession");
    }
    disconnectRealtimeNow();
    return;
  }

  // Guest (or defensive clear): drop WS immediately, then clear store.
  disconnectRealtimeNow();
  useSessionStore.getState().clear();
}

export type EnsureLeaveResult =
  | { ok: true; skippedConfirm: boolean }
  | { ok: false; reason: "cancelled" | "leave_failed" | "busy" };

/** Single-flight: a second New/Join/Open while confirm is open must not share the first intent. */
let leaveFlowInFlight: Promise<EnsureLeaveResult> | null = null;

/** Shared lock for New/Join/Open leave flows (including deferred Open). */
export async function runInLeaveFlowLock(
  work: () => Promise<EnsureLeaveResult>,
): Promise<EnsureLeaveResult> {
  if (leaveFlowInFlight) {
    return { ok: false, reason: "busy" };
  }
  leaveFlowInFlight = work().finally(() => {
    leaveFlowInFlight = null;
  });
  return leaveFlowInFlight;
}

/**
 * Gate → confirm (+ leave inside dialog on OK) → whether caller may run the intent.
 */
export async function ensureLeaveSessionForIntent(
  intent: LeaveIntent,
  translateError?: (key: string) => string,
): Promise<EnsureLeaveResult> {
  return runInLeaveFlowLock(async () => {
    const { sessionId, role } = useSessionStore.getState();
    const gate = decideLeaveGate({ sessionId, role }, intent);

    if (gate.kind === "proceed") {
      return { ok: true, skippedConfirm: true };
    }

    const outcome = await requestLeaveSessionConfirm(gate, { translateError });
    if (outcome.kind === "cancelled") {
      return { ok: false, reason: "cancelled" };
    }
    if (outcome.kind === "leave_failed") {
      return { ok: false, reason: "leave_failed" };
    }
    return { ok: true, skippedConfirm: false };
  });
}

/**
 * Leave (if needed) then run the UI intent. No-ops on cancel / leave failure.
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
