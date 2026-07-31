import { toast } from "sonner";
import { flowPackErrorMessageKey } from "@/features/workflow/lib/flow-pack-error";
import { runAfterLeaveSession } from "./ensure-leave-session";

type TranslateError = (key: string) => string;

/**
 * Phase 3 — Open .flowpkg after leave-session gate (SR §11).
 *
 * Ordering (intentional):
 * 1) confirm + leave active session (if any)
 * 2) native file picker / unpack via openFromDisk
 * 3) navigate workspace on success
 *
 * Note: if the user cancels the file picker after leave succeeded,
 * the session is already ended/cleared and is NOT restored.
 */
export async function openWorkflowAfterLeaveSession(input: {
  translateError: TranslateError;
  openFromDisk: () => Promise<void>;
  navigateToWorkspace: () => void;
}): Promise<void> {
  const { translateError, openFromDisk, navigateToWorkspace } = input;

  await runAfterLeaveSession("open", translateError, async () => {
    try {
      await openFromDisk();
      navigateToWorkspace();
    } catch (error) {
      if ((error as Error)?.message === "cancelled") {
        return;
      }
      toast.error(translateError(flowPackErrorMessageKey(error)));
    }
  });
}
