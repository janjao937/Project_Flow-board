import { describe, expect, it } from "vitest";
import en from "@/messages/en.json";
import th from "@/messages/th.json";

function flattenKeys(value: unknown, prefix = ""): string[] {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return prefix ? [prefix] : [];
  }
  return Object.entries(value as Record<string, unknown>).flatMap(([key, nested]) =>
    flattenKeys(nested, prefix ? `${prefix}.${key}` : key),
  );
}

describe("session leave-confirm i18n", () => {
  it("keeps en/th leaveConfirm keys in sync", () => {
    const enKeys = flattenKeys(en.session)
      .filter((key) => key.includes("leaveConfirm"))
      .sort();
    const thKeys = flattenKeys(th.session)
      .filter((key) => key.includes("leaveConfirm"))
      .sort();
    expect(thKeys).toEqual(enKeys);
    expect(enKeys.length).toBeGreaterThan(0);
  });
});
