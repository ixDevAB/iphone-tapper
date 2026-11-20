import type { Image } from "../../src/image.ts";

const step = 6;
const top = 600;
const bottom = 2250;

const kinds = [
  { name: "blue", hue: [203, 215], saturation: [80, 100], value: [50, 66], cells: 25 },
  { name: "purple", hue: [250, 262], saturation: [70, 90], value: [38, 52], cells: 25 },
  { name: "gold", hue: [29, 37], saturation: [82, 96], value: [46, 58], cells: 25 },
  { name: "check", hue: [100, 118], saturation: [55, 90], value: [60, 85], cells: 6 },
];

const hsv = (r: number, g: number, b: number) => {
  const max = Math.max(r, g, b);
  const d = max - Math.min(r, g, b);
  const h = d === 0 ? 0 : max === r ? ((g - b) / d + 6) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, max ? (d / max) * 100 : 0, max / 2.55];
};

const within = (n: number, [low, high]: number[]) => n >= low && n <= high;

const kindAt = (img: Image, x: number, y: number) => {
  const p = (y * img.width + x) * img.channels;
  const [h, s, v] = hsv(img.data[p], img.data[p + 1], img.data[p + 2]);
  return kinds.findIndex((k) => within(h, k.hue) && within(s, k.saturation) && within(v, k.value));
};

export const findMarkers = (img: Image) => {
  const columns = Math.floor(img.width / step);
  const rowsCount = Math.floor((Math.min(bottom, img.height) - top) / step);
  const grid = Int8Array.from({ length: columns * rowsCount }, (_, i) => kindAt(img, (i % columns) * step, top + Math.floor(i / columns) * step));
  const seen = new Uint8Array(grid.length);

  const fill = (start: number) => {
    const kind = grid[start];
    const stack = [start];
    const cells: number[] = [];
    seen[start] = 1;
    while (stack.length) {
      const i = stack.pop() as number;
      cells.push(i);
      const cx = i % columns;
      const cy = Math.floor(i / columns);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = cx + dx;
        const ny = cy + dy;
        const n = ny * columns + nx;
        if (nx < 0 || ny < 0 || nx >= columns || ny >= rowsCount || seen[n] || grid[n] !== kind) continue;
        seen[n] = 1;
        stack.push(n);
      }
    }
    return cells;
  };

  return Array.from(grid.keys())
    .filter((i) => grid[i] >= 0)
    .flatMap((i) => seen[i] ? [] : [fill(i)])
    .filter((cells) => cells.length >= kinds[grid[cells[0]]].cells)
    .map((cells) => ({
      kind: kinds[grid[cells[0]]].name,
      size: cells.length,
      x: Math.round(cells.reduce((sum, i) => sum + (i % columns) * step, 0) / cells.length / 3),
      y: Math.round(cells.reduce((sum, i) => sum + top + Math.floor(i / columns) * step, 0) / cells.length / 3),
    }))
    .toSorted((a, b) => a.y - b.y);
};
