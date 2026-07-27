import { toast } from "sonner";
import { isApiError } from "./api-client";

type TranslateFn = (key: string) => string;

export function showErrorToast(error: unknown, t: TranslateFn): void {
  if (isApiError(error)) {
    const key = error.messageKey.replace(/^errors\./, "");
    toast.error(t(key));
    return;
  }

  toast.error(t("unexpected"));
}
