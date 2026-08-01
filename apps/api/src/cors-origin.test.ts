import { describe, expect, it } from "vitest";
import { resolveCorsOrigin } from "./cors-origin";

describe("resolveCorsOrigin", () => {
  it("reflects all origins in development", () => {
    expect(resolveCorsOrigin("development", "https://example.com")).toBe(true);
  });

  it("treats * as allow-all", () => {
    expect(resolveCorsOrigin("staging", "*")).toBe(true);
  });

  it("returns a single origin string", () => {
    expect(resolveCorsOrigin("staging", "https://flowboard.example.workers.dev")).toBe(
      "https://flowboard.example.workers.dev",
    );
  });

  it("supports comma-separated origins as an array", () => {
    expect(
      resolveCorsOrigin("staging", "https://flowboard.example.workers.dev, http://localhost:3000"),
    ).toEqual(["https://flowboard.example.workers.dev", "http://localhost:3000"]);
  });
});
