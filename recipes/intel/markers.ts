import type { Image } from "../../src/image.ts";
import { hsv, regions, rgbAt } from "../../src/pixels.ts";
import { scale } from "../../src/screen.ts";

const top = 600;
const bottom = 2250;
const reach = 28;

type Kind = { name: string; hue: number[]; saturation: number[]; value: number[]; piece: number; cells: number };

const pinKinds: Kind[] = [
  { name: "blue", hue: [203, 215], saturation: [80, 100], value: [50, 66], piece: 10, cells: 25 },
  { name: "purple", hue: [250, 262], saturation: [70, 90], value: [38, 52], piece: 10, cells: 25 },
  { name: "gold", hue: [29, 37], saturation: [82, 96], value: [46, 58], piece: 10, cells: 25 },
  { name: "flame", hue: [26, 48], saturation: [78, 100], value: [88, 100], piece: 10, cells: 100 },
];
const checkKinds: Kind[] = [
  { name: "check", hue: [100, 118], saturation: [55, 90], value: [60, 85], piece: 12, cells: 12 },
];

const within = (n: number, [low, high]: number[]) => n >= low && n <= high;

const scan = (img: Image, kinds: Kind[], step: number) => {
  const columns = Math.floor(img.width / step);
  const rows = Math.floor((Math.min(bottom, img.height) - top) / step);
  const grid = Uint8Array.from({ length: columns * rows }, (_, i) => {
    const [r, g, b] = rgbAt(img, (i % columns) * step, top + Math.floor(i / columns) * step);
    const [h, s, v] = hsv(r, g, b);
    return kinds.findIndex((k) => within(h, k.hue) && within(s, k.saturation) && within(v, k.value)) + 1;
  });

  return regions(grid, columns)
    .map((cells) => ({ cells, kind: kinds[grid[cells[0]] - 1] }))
    .filter(({ cells, kind }) => cells.length >= kind.piece)
    .map(({ cells, kind }) => ({
      kind,
      size: cells.length,
      x: cells.reduce((sum, i) => sum + (i % columns) * step, 0) / cells.length / scale,
      y: cells.reduce((sum, i) => sum + top + Math.floor(i / columns) * step, 0) / cells.length / scale,
    }));
};

type Piece = ReturnType<typeof scan>[number];

const joined = (pieces: Piece[]) =>
  pieces.reduce<Piece[][]>((groups, p) => {
    const i = groups.findIndex((g) => g.some((q) => q.kind === p.kind && Math.hypot(q.x - p.x, q.y - p.y) < reach));
    return i < 0 ? [...groups, [p]] : groups.with(i, [...groups[i], p]);
  }, []);

const whole = (group: Piece[]) => {
  const size = group.reduce((sum, p) => sum + p.size, 0);
  return {
    kind: group[0].kind,
    size,
    x: group.reduce((sum, p) => sum + p.x * p.size, 0) / size,
    y: group.reduce((sum, p) => sum + p.y * p.size, 0) / size,
  };
};

export const findMarkers = (img: Image) =>
  [...joined(scan(img, pinKinds, 6)), ...joined(scan(img, checkKinds, 3))]
    .map(whole)
    .filter((m) => m.size >= m.kind.cells)
    .map((m) => ({ kind: m.kind.name, size: m.size, x: Math.round(m.x), y: Math.round(m.y) }))
    .toSorted((a, b) => a.y - b.y);

export const findPins = (img: Image) => {
  const found = findMarkers(img);
  const checks = found.filter((m) => m.kind === "check");
  return found
    .filter((m) => m.kind !== "check")
    .map((pin) => ({
      x: pin.x,
      y: pin.y,
      colour: pin.kind,
      done: checks.some((c) => within(c.x - pin.x, [4, 30]) && within(pin.y - c.y, [2, 30])),
    }));
};
