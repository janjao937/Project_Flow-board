"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Link, useRouter } from "@/i18n/navigation";
import { LocaleSwitcher, ThemeSwitcher } from "@/components/shell/preference-switchers";
import { useWorkflowStore } from "@/features/workflow/store/workflow-store";
import { useSessionStore } from "@/features/join/store/session-store";
import { flowPackErrorMessageKey } from "@/features/workflow/lib/flow-pack-error";

export function AppHeader() {
  const t = useTranslations("nav");
  const tw = useTranslations("workflow");
  const te = useTranslations("errors");
  const tb = useTranslations("brand");
  const router = useRouter();
  const manifest = useWorkflowStore((s) => s.manifest);
  const dirty = useWorkflowStore((s) => s.dirty);
  const activePageId = useWorkflowStore((s) => s.activePageId);
  const setActivePage = useWorkflowStore((s) => s.setActivePage);
  const newWorkflow = useWorkflowStore((s) => s.newWorkflow);
  const openFromDisk = useWorkflowStore((s) => s.openFromDisk);
  const save = useWorkflowStore((s) => s.save);
  const saveAs = useWorkflowStore((s) => s.saveAs);
  const fileHandle = useWorkflowStore((s) => s.fileHandle);
  const role = useSessionStore((s) => s.role);
  const canSave = !role || role === "host";

  useEffect(() => {
    if (!manifest || !dirty || !fileHandle) {
      return;
    }
    const timer = window.setTimeout(() => {
      void save()
        .then(() => toast.success(tw("autoSaved")))
        .catch(() => toast.error(tw("saveFailed")));
    }, 1500);
    return () => window.clearTimeout(timer);
  }, [dirty, fileHandle, manifest, save, tw]);

  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!dirty) {
        return;
      }
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  return (
    <header className="border-border/60 bg-background/75 sticky top-0 z-30 border-b backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-[1600px] items-center gap-2 px-3 md:px-4">
        <Link href="/" className="font-[family-name:var(--font-display)] text-lg tracking-tight">
          {tb("name")}
        </Link>
        <div className="ml-2 hidden items-center gap-1 md:flex">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              newWorkflow(tw("untitled"));
              router.push("/workspace");
            }}
          >
            {t("new")}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => router.push("/join")}>
            {t("join")}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              void openFromDisk()
                .then(() => router.push("/workspace"))
                .catch((error) => {
                  if ((error as Error)?.message === "cancelled") {
                    return;
                  }
                  toast.error(te(flowPackErrorMessageKey(error)));
                });
            }}
          >
            {t("open")}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={!manifest || !canSave}
            onClick={() => {
              void save()
                .then(() => toast.success(tw("saved")))
                .catch(() => toast.error(tw("saveFailed")));
            }}
          >
            {t("save")}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={!manifest || !canSave}
            onClick={() => {
              void saveAs()
                .then(() => toast.success(tw("saved")))
                .catch((error) => {
                  toast.error(te(flowPackErrorMessageKey(error)));
                });
            }}
          >
            {t("saveAs")}
          </Button>
        </div>
        {manifest ? (
          <div className="mx-auto hidden max-w-md truncate text-sm text-muted-foreground md:block">
            {manifest.name}
            {dirty ? ` · ${tw("dirty")}` : ""}
          </div>
        ) : (
          <div className="flex-1" />
        )}
        {manifest ? (
          <div className="mr-2 flex items-center gap-1">
            {manifest.pages.map((page) => (
              <Button
                key={page.id}
                size="sm"
                variant={activePageId === page.id ? "default" : "ghost"}
                onClick={() => {
                  setActivePage(page.id);
                  router.push("/workspace");
                }}
              >
                {page.kind === "board"
                  ? t("board")
                  : page.kind === "tasks"
                    ? t("tasks")
                    : page.kind === "roadmap"
                      ? t("roadmap")
                      : page.kind === "plan"
                        ? t("plan")
                        : page.title}
              </Button>
            ))}
          </div>
        ) : null}
        <LocaleSwitcher />
        <ThemeSwitcher />
      </div>
      <MobileActions />
    </header>
  );
}

function MobileActions() {
  const t = useTranslations("nav");
  const tw = useTranslations("workflow");
  const te = useTranslations("errors");
  const router = useRouter();
  const manifest = useWorkflowStore((s) => s.manifest);
  const newWorkflow = useWorkflowStore((s) => s.newWorkflow);
  const openFromDisk = useWorkflowStore((s) => s.openFromDisk);
  const save = useWorkflowStore((s) => s.save);

  return (
    <div className="border-border/60 flex gap-1 overflow-x-auto border-t px-3 py-2 md:hidden">
      <Button
        size="sm"
        variant="outline"
        onClick={() => {
          newWorkflow(tw("untitled"));
          router.push("/workspace");
        }}
      >
        {t("new")}
      </Button>
      <Button
        size="sm"
        variant="outline"
        onClick={() => {
          void openFromDisk()
            .then(() => router.push("/workspace"))
            .catch((error) => {
              if ((error as Error)?.message === "cancelled") {
                return;
              }
              toast.error(te(flowPackErrorMessageKey(error)));
            });
        }}
      >
        {t("open")}
      </Button>
      <Button
        size="sm"
        variant="outline"
        disabled={!manifest}
        onClick={() => {
          void save()
            .then(() => toast.success(tw("saved")))
            .catch(() => toast.error(tw("saveFailed")));
        }}
      >
        {t("save")}
      </Button>
    </div>
  );
}
