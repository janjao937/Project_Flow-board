"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRouter } from "@/i18n/navigation";
import { useWorkflowStore } from "@/features/workflow/store/workflow-store";
import { showErrorToast } from "@/shared/api-client/show-error-toast";
import { useSessionStore } from "@/features/join/store/session-store";
import { isSessionApiReady, useSessionApiStatus } from "@/shared/runtime-config/use-session-api-status";

export default function JoinPage() {
  const t = useTranslations("session");
  const te = useTranslations("errors");
  const router = useRouter();
  const joinSession = useSessionStore((s) => s.joinSession);
  const applyRemote = useWorkflowStore((s) => s.applyRemote);
  const { status, refresh } = useSessionApiStatus();
  const sessionReady = isSessionApiReady(status);
  const [code, setCode] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-12">
      <h1 className="font-[family-name:var(--font-display)] text-3xl tracking-tight">{t("joinTitle")}</h1>
      <p className="text-muted-foreground mt-2 text-sm">{t("joinSub")}</p>
      {!sessionReady ? (
        <p className="text-muted-foreground mt-6 text-sm">
          {status === "loading" ? t("retryConnectivity") : t("sessionUnavailable")}
        </p>
      ) : null}
      <form
        className="mt-8 space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (!sessionReady || submitting) {
            return;
          }
          setSubmitting(true);
          void refresh()
            .then(() => joinSession(code, displayName.trim() || "Guest"))
            .then((response) => {
              if (response.snapshot?.manifest && response.snapshot.data) {
                applyRemote(response.snapshot.manifest, response.snapshot.data);
              }
              toast.success(t("joined"));
              router.push("/workspace");
            })
            .catch((error) => showErrorToast(error, te))
            .finally(() => setSubmitting(false));
        }}
      >
        <div className="space-y-1">
          <Label htmlFor="join-code">{t("joinCode")}</Label>
          <Input
            id="join-code"
            value={code}
            onChange={(event) => setCode(event.target.value.toUpperCase())}
            className="font-mono tracking-[0.25em]"
            maxLength={8}
            required
            disabled={!sessionReady}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="join-name">{t("displayName")}</Label>
          <Input
            id="join-name"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            required
            disabled={!sessionReady}
          />
        </div>
        <Button type="submit" className="w-full" disabled={!sessionReady || submitting}>
          {t("joinAction")}
        </Button>
      </form>
    </main>
  );
}
