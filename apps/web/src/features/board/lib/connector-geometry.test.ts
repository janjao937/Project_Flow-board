import { describe, expect, it } from "vitest";
import { connectorAnchor, connectorEndpoints } from "./connector-geometry";

describe("connectorAnchor", () => {
  it("hits the right edge when targeting east", () => {
    const point = connectorAnchor({ x: 0, y: 0, width: 100, height: 80 }, 200, 40);
    expect(point.x).toBeCloseTo(100);
    expect(point.y).toBeCloseTo(40);
  });

  it("hits the top edge when targeting north", () => {
    const point = connectorAnchor({ x: 0, y: 0, width: 100, height: 80 }, 50, -100);
    expect(point.x).toBeCloseTo(50);
    expect(point.y).toBeCloseTo(0);
  });
});

describe("connectorEndpoints", () => {
  it("connects facing edges between side-by-side boxes", () => {
    const line = connectorEndpoints(
      { x: 0, y: 0, width: 100, height: 100 },
      { x: 200, y: 0, width: 100, height: 100 },
    );
    expect(line.x1).toBeCloseTo(100);
    expect(line.y1).toBeCloseTo(50);
    expect(line.x2).toBeCloseTo(200);
    expect(line.y2).toBeCloseTo(50);
  });
});
