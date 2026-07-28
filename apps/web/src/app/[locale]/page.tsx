"use client";

import { useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useRouter } from "@/i18n/navigation";
import {
  getRecentServerSnapshot,
  getRecentSnapshot,
  subscribeRecent,
} from "@/features/workflow/infrastructure/recent";
import { useWorkflowStore } from "@/features/workflow/store/workflow-store";
import { flowPackErrorMessageKey } from "@/features/workflow/lib/flow-pack-error";

export default function HomePage() {
  const t = useTranslations("home");
  const tb = useTranslations("brand");
  const tw = useTranslations("workflow");
  const te = useTranslations("errors");
  const router = useRouter();
  const newWorkflow = useWorkflowStore((s) => s.newWorkflow);
  const openFromDisk = useWorkflowStore((s) => s.openFromDisk);
  const recent = useSyncExternalStore(subscribeRecent, getRecentSnapshot, getRecentServerSnapshot);

  return (
    <main className="relative flex flex-1 flex-col overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(15,118,110,0.18),_transparent_55%),linear-gradient(160deg,#f3f6f4_0%,#e7eef0_45%,#d9e4e2_100%)] dark:bg-[radial-gradient(ellipse_at_top,_rgba(45,212,191,0.12),_transparent_50%),linear-gradient(160deg,#0b1214_0%,#121a1c_50%,#0f1718_100%)]" />
      <div className="relative mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center px-6 py-16 md:px-10">
        <p className="font-[family-name:var(--font-display)] text-5xl tracking-tight md:text-7xl">{tb("name")}</p>
        <p className="text-muted-foreground mt-3 max-w-xl text-base md:text-lg">{tb("tagline")}</p>
        <h1 className="mt-10 max-w-2xl text-2xl font-semibold tracking-tight md:text-3xl">{t("headline")}</h1>
        <p className="text-muted-foreground mt-3 max-w-xl text-sm md:text-base">{t("sub")}</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button
            size="lg"
            onClick={() => {
              newWorkflow(tw("untitled"));
              router.push("/workspace");
            }}
          >
            {t("ctaNew")}
          </Button>
          <Button
            size="lg"
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
            {t("ctaOpen")}
          </Button>
        </div>
        {recent.length > 0 ? (
          <section className="mt-14">
            <h2 className="text-sm font-medium tracking-wide uppercase">{t("recent")}</h2>
            <ul className="mt-3 space-y-2">
              {recent.map((item) => (
                <li key={item.id} className="text-muted-foreground text-sm">
                  {item.name}
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </main>
  );
}
