"use client";

import { Component, type ReactNode } from "react";
import { useTranslations } from "next-intl";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

function Fallback() {
  const t = useTranslations("errors");
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-2 p-8 text-center">
      <p className="text-lg font-medium">{t("unexpected")}</p>
    </div>
  );
}

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error): void {
    console.error(error);
  }

  render() {
    if (this.state.hasError) {
      return <Fallback />;
    }
    return this.props.children;
  }
}
