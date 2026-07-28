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

describe("roadmap i18n keys", () => {
  it("keeps en/th roadmap keys in sync", () => {
    const enKeys = flattenKeys(en.roadmap).sort();
    const thKeys = flattenKeys(th.roadmap).sort();
    expect(thKeys).toEqual(enKeys);
  });
});
