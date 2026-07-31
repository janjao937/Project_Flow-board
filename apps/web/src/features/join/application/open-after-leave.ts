import { toast } from "sonner";
import { flowPackErrorMessageKey } from "@/features/workflow/lib/flow-pack-error";
import { isUserCancelledError } from "@/shared/lib/is-user-cancelled-error";
import { isEncryptedPackage } from "@/shared/packages/flowpkg";
import { unpackWorkflow } from "@/features/workflow/application/workflow-io";
import { pickOpenFlowPackage } from "@/features/workflow/infrastructure/file-system";
import { requestUnlockPassphrase } from "@/features/workflow/ui/passphrase-prompt";
import { useWorkflowStore } from "@/features/workflow/store/workflow-store";
import { useSessionStore } from "../store/session-store";
import { decideLeaveGate } from "./leave-session-policy";
import { executeLeaveAction, runInLeaveFlowLock } from "./ensure-leave-session";
import { requestLeaveSessionConfirm } from "../ui/leave-session-confirm";

type TranslateError = (key: string) => string;

/**
 * Phase 3/4 fix — Open .flowpkg safely while (optionally) in a live session.
 *
 * Order (avoids leaving before cancel, and avoids syncing a new doc into the room):
 * 1) confirm (leave deferred)
 * 2) pick + unlock + unpack in memory
 * 3) leave session
 * 4) apply package + navigate
 *
 * If the user cancels at confirm / picker / passphrase, the session stays intact.
 */
export async function openWorkflowAfterLeaveSession(input: {
  translateError: TranslateError;
  openFromDisk: () => Promise<void>;
  navigateToWorkspace: () => void;
}): Promise<void> {
  const { translateError, openFromDisk, navigateToWorkspace } = input;

  await runInLeaveFlowLock(async () => {
    const { sessionId, role } = useSessionStore.getState();
    const gate = decideLeaveGate({ sessionId, role }, "open");

    if (gate.kind === "proceed") {
      try {
        await openFromDisk();
        navigateToWorkspace();
        return { ok: true, skippedConfirm: true };
      } catch (error) {
        if (isUserCancelledError(error)) {
          return { ok: false, reason: "cancelled" };
        }
        toast.error(translateError(flowPackErrorMessageKey(error)));
        return { ok: false, reason: "leave_failed" };
      }
    }

    const outcome = await requestLeaveSessionConfirm(gate, {
      translateError,
      executeLeave: false,
    });
    if (outcome.kind === "cancelled") {
      return { ok: false, reason: "cancelled" };
    }
    if (outcome.kind === "leave_failed") {
      return { ok: false, reason: "leave_failed" };
    }

    try {
      const picked = await pickOpenFlowPackage();
      let passphrase: string | undefined;
      if (isEncryptedPackage(picked.bytes)) {
        const unlocked = await requestUnlockPassphrase();
        if (!unlocked) {
          return { ok: false, reason: "cancelled" };
        }
        passphrase = unlocked;
      }
      const opened = await unpackWorkflow(picked.bytes, { passphrase });

      await executeLeaveAction(gate.leaveAction);

      useWorkflowStore.getState().applyOpenedPackage({
        manifest: opened.manifest,
        data: opened.data,
        fileHandle: picked.handle,
        fileName: picked.name,
        encrypted: opened.encrypted,
        passphrase,
      });
      navigateToWorkspace();
      return { ok: true, skippedConfirm: false };
    } catch (error) {
      if (isUserCancelledError(error)) {
        return { ok: false, reason: "cancelled" };
      }
      toast.error(translateError(flowPackErrorMessageKey(error)));
      return { ok: false, reason: "leave_failed" };
    }
  });
}
