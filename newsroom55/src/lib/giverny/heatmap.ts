import type { HeatmapHolding } from "@/lib/giverny/types";

export type HeatmapRect = HeatmapHolding & {
  x: number;
  y: number;
  w: number;
  h: number;
};

function split(
  items: HeatmapHolding[],
  x: number,
  y: number,
  width: number,
  height: number,
): HeatmapRect[] {
  if (items.length === 0) return [];
  if (items.length === 1) {
    const [item] = items;
    return [{ ...item, x, y, w: width, h: height }];
  }
  const total = items.reduce((sum, item) => sum + item.weight, 0);
  if (!(total > 0)) return [];
  let acc = 0;
  let cut = 1;
  for (let index = 0; index < items.length - 1; index += 1) {
    acc += items[index].weight;
    cut = index + 1;
    if (acc >= total / 2) break;
  }
  const first = items.slice(0, cut);
  const rest = items.slice(cut);
  const firstShare = first.reduce((sum, item) => sum + item.weight, 0) / total;
  if (width >= height) {
    const firstWidth = width * firstShare;
    return [
      ...split(first, x, y, firstWidth, height),
      ...split(rest, x + firstWidth, y, width - firstWidth, height),
    ];
  }
  const firstHeight = height * firstShare;
  return [
    ...split(first, x, y, width, firstHeight),
    ...split(rest, x, y + firstHeight, width, height - firstHeight),
  ];
}

export function layoutHeatmap(cells: HeatmapHolding[], width = 100, height = 100): HeatmapRect[] {
  const positive = cells.filter((cell) => cell.weight > 0);
  return split(positive, 0, 0, width, height);
}
