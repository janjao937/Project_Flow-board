"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useWorkflowStore } from "@/features/workflow/store/workflow-store";
import { showErrorToast } from "@/shared/api-client/show-error-toast";
import { useSessionStore } from "../store/session-store";

export function HostSessionPanel() {
  const t = useTranslations("session");
  const te = useTranslations("errors");
  const manifest = useWorkflowStore((s) => s.manifest);
  const data = useWorkflowStore((s) => s.data);
  const role = useSessionStore((s) => s.role);
  const joinCode = useSessionStore((s) => s.joinCode);
  const guestsCanEdit = useSessionStore((s) => s.guestsCanEdit);
  const participants = useSessionStore((s) => s.participants);
  const startHostSession = useSessionStore((s) => s.startHostSession);
  const setGuestsCanEdit = useSessionStore((s) => s.setGuestsCanEdit);
  const endSession = useSessionStore((s) => s.endSession);
  const [displayName, setDisplayName] = useState("Host");
  const [open, setOpen] = useState(false);
  const [starting, setStarting] = useState(false);

  if (!manifest || !data) {
    return null;
  }

  if (role === "guest") {
    return (
      <div className="border-border/60 bg-background/80 rounded-xl border px-3 py-2 text-sm backdrop-blur">
        <p className="font-medium">{t("guestMode")}</p>
        <ul className="text-muted-foreground mt-1 space-y-0.5 text-xs">
          {participants.map((participant) => (
            <li key={participant.participantId}>
              {participant.displayName}
              {participant.role === "host" ? ` (${t("host")})` : ""}
            </li>
          ))}
        </ul>
      </div>
    );
  }

  if (role === "host" && joinCode) {
    return (
      <div className="border-border/60 bg-background/80 w-full max-w-sm rounded-xl border p-3 backdrop-blur">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{t("joinCode")}</p>
            <p className="font-mono text-2xl tracking-[0.2em]">{joinCode}</p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={async () => {
              await navigator.clipboard.writeText(joinCode);
              toast.success(t("copied"));
            }}
          >
            {t("copy")}
          </Button>
        </div>
        <div className="mt-3 flex items-center justify-between gap-3">
          <Label htmlFor="guests-can-edit">{t("guestsCanEdit")}</Label>
          <Switch
            id="guests-can-edit"
            checked={guestsCanEdit}
            onCheckedChange={(checked) => {
              void setGuestsCanEdit(Boolean(checked)).catch((error) => showErrorToast(error, te));
            }}
          />
        </div>
        <div className="mt-3">
          <p className="text-xs text-muted-foreground">{t("online")}</p>
          <ul className="mt-1 space-y-1 text-sm">
            {participants.map((participant) => (
              <li key={participant.participantId}>
                {participant.displayName}
                {participant.role === "host" ? ` · ${t("host")}` : ""}
              </li>
            ))}
          </ul>
        </div>
        <Button
          className="mt-3 w-full"
          variant="destructive"
          size="sm"
          onClick={() => {
            void endSession()
              .then(() => toast.success(t("hostEnded")))
              .catch((error) => showErrorToast(error, te));
          }}
        >
          {t("endSession")}
        </Button>
      </div>
    );
  }

  return (
    <div className="border-border/60 bg-background/80 rounded-xl border p-3 backdrop-blur">
      {!open ? (
        <Button size="sm" onClick={() => setOpen(true)}>
          {t("startSession")}
        </Button>
      ) : (
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="host-name">{t("displayName")}</Label>
            <Input id="host-name" value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
          </div>
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="start-guests-edit">{t("guestsCanEdit")}</Label>
            <Switch id="start-guests-edit" checked={guestsCanEdit} onCheckedChange={(checked) => useSessionStore.setState({ guestsCanEdit: Boolean(checked) })} />
          </div>
          <Button
            className="w-full"
            disabled={starting}
            onClick={() => {
              setStarting(true);
              void startHostSession({
                displayName: displayName.trim() || "Host",
                guestsCanEdit: useSessionStore.getState().guestsCanEdit,
                manifest,
                data,
              })
                .then(() => toast.success(t("sessionStarted")))
                .catch((error) => showErrorToast(error, te))
                .finally(() => setStarting(false));
            }}
          >
            {t("startSession")}
          </Button>
        </div>
      )}
    </div>
  );
}
