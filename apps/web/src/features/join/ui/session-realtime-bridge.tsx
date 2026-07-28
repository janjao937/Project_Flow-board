"use client";

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useRouter } from "@/i18n/navigation";
import { useWorkflowStore } from "@/features/workflow/store/workflow-store";
import { RealtimeClient } from "../infrastructure/realtime-client";
import { useSessionStore } from "../store/session-store";
import { Button } from "@/components/ui/button";

export function SessionRealtimeBridge() {
  const t = useTranslations("session");
  const router = useRouter();
  const token = useSessionStore((s) => s.token);
  const sessionId = useSessionStore((s) => s.sessionId);
  const role = useSessionStore((s) => s.role);
  const endedReason = useSessionStore((s) => s.endedReason);
  const activePageId = useWorkflowStore((s) => s.activePageId);
  const applyRemote = useWorkflowStore((s) => s.applyRemote);
  const manifest = useWorkflowStore((s) => s.manifest);
  const data = useWorkflowStore((s) => s.data);
  const dirty = useWorkflowStore((s) => s.dirty);
  const clientRef = useRef<RealtimeClient | null>(null);
  const applyingRemote = useRef(false);

  useEffect(() => {
    if (!token || !sessionId) {
      clientRef.current?.disconnect();
      clientRef.current = null;
      return;
    }

    const client = new RealtimeClient({
      onDoc: ({ manifest: nextManifest, data: nextData }) => {
        applyingRemote.current = true;
        applyRemote(nextManifest, nextData);
        applyingRemote.current = false;
      },
      onSessionEnded: (reason) => {
        toast.error(reason === "host_left" ? t("hostLeft") : t("hostEnded"));
      },
    });
    client.connect(token);
    clientRef.current = client;

    return () => {
      client.disconnect();
      clientRef.current = null;
    };
  }, [token, sessionId, applyRemote, t]);

  useEffect(() => {
    if (!token || !sessionId || role !== "host") {
      return;
    }
    void useSessionStore.getState().heartbeat();
    const timer = window.setInterval(() => {
      void useSessionStore.getState().heartbeat();
    }, 10_000);
    return () => window.clearInterval(timer);
  }, [token, sessionId, role]);

  useEffect(() => {
    clientRef.current?.sendPresence(activePageId, null);
  }, [activePageId]);

  useEffect(() => {
    if (!clientRef.current || !manifest || !data || applyingRemote.current) {
      return;
    }
    if (!dirty && role !== "host") {
      return;
    }
    const canEdit = useSessionStore.getState().canEdit;
    if (!canEdit) {
      return;
    }
    const timer = window.setTimeout(() => {
      const revision = useSessionStore.getState().bumpRevision();
      clientRef.current?.sendDoc(revision, manifest, data);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [manifest, data, dirty, role]);

  if (!endedReason) {
    return null;
  }

  return (
    <div className="bg-background/95 fixed inset-0 z-50 flex items-center justify-center p-6 backdrop-blur">
      <div className="border-border max-w-md rounded-2xl border p-6 shadow-lg">
        <h2 className="text-xl font-semibold">{t("endedTitle")}</h2>
        <p className="text-muted-foreground mt-2 text-sm">
          {endedReason === "host_left" ? t("hostLeft") : t("hostEnded")}
        </p>
        <div className="mt-6 flex gap-2">
          <Button
            onClick={() => {
              useSessionStore.getState().clear();
              router.push("/");
            }}
          >
            {t("backHome")}
          </Button>
          <Button
            onClick={() => {
              useSessionStore.getState().clear();
              router.push("/join");
            }}
          >
            {t("joinAgain")}
          </Button>
        </div>
      </div>
    </div>
  );
}
