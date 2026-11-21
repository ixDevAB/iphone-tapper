import type { Image } from "../../src/image.ts";
import { hsv, regions, rgbAt } from "../../src/pixels.ts";
import { scale } from "../../src/screen.ts";

const step = 6;
const top = 600;
const bottom = 2250;

const kinds = [
  { name: "blue", hue: [203, 215], saturation: [80, 100], value: [50, 66], cells: 25 },
  { name: "purple", hue: [250, 262], saturation: [70, 90], value: [38, 52], cells: 25 },
  { name: "gold", hue: [29, 37], saturation: [82, 96], value: [46, 58], cells: 25 },
  { name: "check", hue: [100, 118], saturation: [55, 90], value: [60, 85], cells: 6 },
];

const within = (n: number, [low, high]: number[]) => n >= low && n <= high;

const kindAt = (img: Image, x: number, y: number) => {
  const [r, g, b] = rgbAt(img, x, y);
  const [h, s, v] = hsv(r, g, b);
  return kinds.findIndex((k) => within(h, k.hue) && within(s, k.saturation) && within(v, k.value));
};

export const findMarkers = (img: Image) => {
  const columns = Math.floor(img.width / step);
  const rows = Math.floor((Math.min(bottom, img.height) - top) / step);
  const grid = Uint8Array.from(
    { length: columns * rows },
    (_, i) => kindAt(img, (i % columns) * step, top + Math.floor(i / columns) * step) + 1,
  );

  return regions(grid, columns)
    .map((cells) => ({ cells, kind: kinds[grid[cells[0]] - 1] }))
    .filter(({ cells, kind }) => cells.length >= kind.cells)
    .map(({ cells, kind }) => ({
      kind: kind.name,
      size: cells.length,
      x: Math.round(cells.reduce((sum, i) => sum + (i % columns) * step, 0) / cells.length / scale),
      y: Math.round(cells.reduce((sum, i) => sum + top + Math.floor(i / columns) * step, 0) / cells.length / scale),
    }))
    .toSorted((a, b) => a.y - b.y);
};
