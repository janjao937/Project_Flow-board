"use client";

import { useTranslations } from "next-intl";
import { useSessionApiStatus } from "./use-session-api-status";

export function SessionConnectivityBanner() {
  const t = useTranslations("session");
  const { status, refresh } = useSessionApiStatus();

  if (status === "ready" || status === "loading") {
    return null;
  }

  const message = status === "offline" ? t("offlineBanner") : t("apiUnavailableBanner");

  return (
    <div
      role="status"
      className="border-border bg-amber-50 text-amber-950 dark:bg-amber-950/40 dark:text-amber-50 border-b px-3 py-2 text-center text-sm"
    >
      <span>{message}</span>
      {status === "unavailable" ? (
        <button
          type="button"
          className="ml-3 underline underline-offset-2"
          onClick={() => {
            void refresh();
          }}
        >
          {t("retryConnectivity")}
        </button>
      ) : null}
    </div>
  );
}
