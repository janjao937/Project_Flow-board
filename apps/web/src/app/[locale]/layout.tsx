import { NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { AppProviders } from "@/components/providers/app-providers";
import { AppErrorBoundary } from "@/components/providers/error-boundary";
import { AppHeader } from "@/components/shell/app-header";
import { SessionRealtimeBridge } from "@/features/join/ui/session-realtime-bridge";
import { LeaveSessionConfirmHost } from "@/features/join/ui/leave-session-confirm-host";
import { PassphrasePromptHost } from "@/features/workflow/ui/passphrase-prompt-host";
import { routing } from "@/i18n/routing";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!routing.locales.includes(locale as "en" | "th")) {
    notFound();
  }

  setRequestLocale(locale);
  const messages = await getMessages();

  return (
    <NextIntlClientProvider messages={messages}>
      <AppProviders>
        <AppErrorBoundary>
          <div lang={locale} className="flex min-h-full flex-1 flex-col">
            <AppHeader />
            <div className="flex min-h-0 flex-1 flex-col">{children}</div>
            <SessionRealtimeBridge />
            <LeaveSessionConfirmHost />
            <PassphrasePromptHost />
          </div>
        </AppErrorBoundary>
      </AppProviders>
    </NextIntlClientProvider>
  );
}
