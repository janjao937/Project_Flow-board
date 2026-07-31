export type ConnectorBox = {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
};

/** Point on the border of an axis-aligned box, from its center toward (dx, dy) in local space. */
function borderFromCenter(halfW: number, halfH: number, dx: number, dy: number): { x: number; y: number } {
  if (dx === 0 && dy === 0) {
    return { x: halfW, y: 0 };
  }

  let t = Infinity;
  if (dx !== 0) {
    const tx = (dx > 0 ? halfW : -halfW) / dx;
    if (tx > 0) {
      const y = dy * tx;
      if (Math.abs(y) <= halfH + 1e-6) {
        t = Math.min(t, tx);
      }
    }
  }
  if (dy !== 0) {
    const ty = (dy > 0 ? halfH : -halfH) / dy;
    if (ty > 0) {
      const x = dx * ty;
      if (Math.abs(x) <= halfW + 1e-6) {
        t = Math.min(t, ty);
      }
    }
  }

  if (!Number.isFinite(t)) {
    return { x: 0, y: 0 };
  }
  return { x: dx * t, y: dy * t };
}

/** Intersection of the line toward a world point with the (possibly rotated) box edge. */
export function connectorAnchor(box: ConnectorBox, towardX: number, towardY: number): { x: number; y: number } {
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const rotationDeg = box.rotation ?? 0;
  const rad = (rotationDeg * Math.PI) / 180;
  const cos = Math.cos(-rad);
  const sin = Math.sin(-rad);
  const wx = towardX - cx;
  const wy = towardY - cy;
  const local = borderFromCenter(box.width / 2, box.height / 2, wx * cos - wy * sin, wx * sin + wy * cos);
  const cosR = Math.cos(rad);
  const sinR = Math.sin(rad);
  return {
    x: cx + local.x * cosR - local.y * sinR,
    y: cy + local.x * sinR + local.y * cosR,
  };
}

/** Line endpoints that sit on each object's edge, aimed at the other object's center. */
export function connectorEndpoints(
  from: ConnectorBox,
  to: ConnectorBox,
): { x1: number; y1: number; x2: number; y2: number } {
  const fromCenter = { x: from.x + from.width / 2, y: from.y + from.height / 2 };
  const toCenter = { x: to.x + to.width / 2, y: to.y + to.height / 2 };
  const start = connectorAnchor(from, toCenter.x, toCenter.y);
  const end = connectorAnchor(to, fromCenter.x, fromCenter.y);
  return { x1: start.x, y1: start.y, x2: end.x, y2: end.y };
}
