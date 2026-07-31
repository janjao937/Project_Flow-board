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

  function finish(choice: "ok" | "cancel") {
    if (!request || busy) {
      return;
    }
    request.resolve(choice);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && request && !busy) {
          finish("cancel");
        }
      }}
    >
      <DialogContent showCloseButton={false} className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{body}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" disabled={busy} onClick={() => finish("cancel")}>
            {t("leaveConfirmCancel")}
          </Button>
          <Button
            variant="destructive"
            disabled={busy}
            onClick={() => {
              setBusy(true);
              finish("ok");
            }}
          >
            {t("leaveConfirmOk")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Exported for tests / typing of message keys used by the host. */
export type LeaveConfirmDecisionView = ConfirmDecision;
