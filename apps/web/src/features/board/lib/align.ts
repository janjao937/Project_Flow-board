export interface Alignable {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export type AlignMode = "left" | "center" | "right" | "top" | "middle" | "bottom";
export type DistributeMode = "horizontal" | "vertical";

export function alignItems(items: Alignable[], mode: AlignMode): Alignable[] {
  if (items.length < 2) {
    return items;
  }
  const minX = Math.min(...items.map((item) => item.x));
  const maxX = Math.max(...items.map((item) => item.x + item.width));
  const minY = Math.min(...items.map((item) => item.y));
  const maxY = Math.max(...items.map((item) => item.y + item.height));
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;

  return items.map((item) => {
    switch (mode) {
      case "left":
        return { ...item, x: minX };
      case "center":
        return { ...item, x: centerX - item.width / 2 };
      case "right":
        return { ...item, x: maxX - item.width };
      case "top":
        return { ...item, y: minY };
      case "middle":
        return { ...item, y: centerY - item.height / 2 };
      case "bottom":
        return { ...item, y: maxY - item.height };
      default:
        return item;
    }
  });
}

export function distributeItems(items: Alignable[], mode: DistributeMode): Alignable[] {
  if (items.length < 3) {
    return items;
  }
  const sorted = [...items].sort((a, b) => (mode === "horizontal" ? a.x - b.x : a.y - b.y));
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  if (!first || !last) {
    return items;
  }

  if (mode === "horizontal") {
    const start = first.x;
    const end = last.x + last.width;
    const totalWidth = sorted.reduce((sum, item) => sum + item.width, 0);
    const gap = (end - start - totalWidth) / (sorted.length - 1);
    let cursor = start;
    return sorted.map((item) => {
      const next = { ...item, x: cursor };
      cursor += item.width + gap;
      return next;
    });
  }

  const start = first.y;
  const end = last.y + last.height;
  const totalHeight = sorted.reduce((sum, item) => sum + item.height, 0);
  const gap = (end - start - totalHeight) / (sorted.length - 1);
  let cursor = start;
  return sorted.map((item) => {
    const next = { ...item, y: cursor };
    cursor += item.height + gap;
    return next;
  });
}
