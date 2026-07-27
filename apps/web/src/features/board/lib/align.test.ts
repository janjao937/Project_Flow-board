import { describe, expect, it } from "vitest";
import { alignItems, distributeItems } from "./align";

describe("align and distribute", () => {
  it("aligns items to the left", () => {
    const result = alignItems(
      [
        { id: "a", x: 40, y: 10, width: 20, height: 20 },
        { id: "b", x: 10, y: 40, width: 20, height: 20 },
      ],
      "left",
    );
    expect(result.every((item) => item.x === 10)).toBe(true);
  });

  it("distributes items horizontally", () => {
    const result = distributeItems(
      [
        { id: "a", x: 0, y: 0, width: 10, height: 10 },
        { id: "b", x: 20, y: 0, width: 10, height: 10 },
        { id: "c", x: 90, y: 0, width: 10, height: 10 },
      ],
      "horizontal",
    );
    expect(result[0]?.x).toBe(0);
    expect(result[2]?.x).toBe(90);
    expect(result[1]?.x).toBe(45);
  });
});
