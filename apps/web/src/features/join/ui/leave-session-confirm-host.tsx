"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { showErrorToast } from "@/shared/api-client/show-error-toast";
import { executeLeaveAction } from "../application/ensure-leave-session";
import {
  leaveConfirmMessageKey,
  type ConfirmDecision,
} from "../application/leave-session-policy";
import {
  subscribeLeaveSessionConfirm,
  type LeaveSessionConfirmRequest,
} from "./leave-session-confirm";

export function LeaveSessionConfirmHost() {
  const t = useTranslations("session");
  const [request, setRequest] = useState<LeaveSessionConfirmRequest | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => subscribeLeaveSessionConfirm(setRequest), []);

  useEffect(() => {
    if (!request) {
      setBusy(false);
    }
  }, [request]);

  const decision = request?.decision ?? null;
  const open = request !== null;

  const title = decision ? t(`leaveConfirmTitle_${decision.intent}` as const) : "";
  const body = decision
    ? t(`leaveConfirmBody_${leaveConfirmMessageKey(decision.intent, decision.role)}` as const)
    : "";

  function cancel() {
    if (!request || busy) {
      return;
    }
    request.resolve({ kind: "cancelled" });
  }

  async function confirmLeave() {
    if (!request || busy) {
      return;
    }
    setBusy(true);
    try {
      await executeLeaveAction(request.decision.leaveAction);
      request.resolve({ kind: "left" });
    } catch (error) {
      if (request.translateError) {
        showErrorToast(error, request.translateError);
      }
      setBusy(false);
      request.resolve({ kind: "leave_failed" });
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && request && !busy) {
          cancel();
        }
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="sm:max-w-md"
        data-testid="leave-session-confirm"
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{body}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="outline"
            disabled={busy}
            data-testid="leave-session-confirm-cancel"
            onClick={cancel}
          >
            {t("leaveConfirmCancel")}
          </Button>
          <Button
            variant="destructive"
            disabled={busy}
            data-testid="leave-session-confirm-ok"
            onClick={() => {
              void confirmLeave();
            }}
          >
            {busy ? t("leaveConfirmLeaving") : t("leaveConfirmOk")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Exported for tests / typing of message keys used by the host. */
export type LeaveConfirmDecisionView = ConfirmDecision;
