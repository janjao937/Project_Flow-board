import { FlowPackError } from "@/shared/packages/flowpkg";

export function flowPackErrorMessageKey(error: unknown): string {
  if (!(error instanceof FlowPackError)) {
    return "unexpected";
  }
  switch (error.message) {
    case "decrypt_failed":
      return "wrongPassphrase";
    case "missing_passphrase":
    case "encrypted":
      return "passphraseRequired";
    case "crypto_unavailable":
      return "cryptoUnavailable";
    default:
      return "workflowPackInvalid";
  }
}
