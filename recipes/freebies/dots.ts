import { isRed } from "../../src/dots.ts";
import type { Image } from "../../src/image.ts";
import { bounds, regions, rgbAt } from "../../src/pixels.ts";
import { scale } from "../../src/screen.ts";

const step = 2;
const top = 300;
const bottom = 2500;
const tabBand = [105, 127];
const bubbleBand = [108, 140];
const content = [170, 800];

const within = (n: number, [low, high]: number[]) => n >= low && n <= high;

export const redShapes = (img: Image) => {
  const columns = Math.floor(img.width / step);
  const rows = Math.floor((Math.min(bottom, img.height) - top) / step);
  const grid = Uint8Array.from({ length: columns * rows }, (_, i) => {
    const [r, g, b] = rgbAt(img, (i % columns) * step, top + Math.floor(i / columns) * step);
    return isRed(r, g, b) ? 1 : 0;
  });
  return regions(grid, columns, true)
    .filter((cells) => cells.length >= 30)
    .map((cells) => {
      const box = bounds(cells, columns);
      const width = (box.right - box.left + 1) * step;
      const height = (box.bottom - box.top + 1) * step;
      return {
        x: Math.round((box.left + box.right) / 2 * step / scale),
        y: Math.round((top + (box.top + box.bottom) / 2 * step) / scale),
        width,
        height,
        fill: cells.length * step * step / (width * height),
      };
    });
};

type Shape = ReturnType<typeof redShapes>[number];

const isDot = (s: Shape) =>
  within(s.width, [20, 32]) && within(s.height, [20, 32]) && Math.abs(s.width - s.height) <= 6 && s.fill >= 0.68;

const isBubble = (s: Shape) =>
  within(s.width, [50, 70]) && within(s.height, [50, 70]) && s.fill < 0.66 && within(s.y, bubbleBand);

export const tabDots = (shapes: Shape[]) =>
  shapes.filter((s) => isDot(s) && within(s.y, tabBand) && s.x >= 40).map((s) => s.x).toSorted((a, b) => a - b);

export const contentDots = (shapes: Shape[]) =>
  shapes.filter((s) => isDot(s) && within(s.y, content)).map((s) => ({ x: s.x, y: s.y }));

export const moreTo = (shapes: Shape[], side: "left" | "right") =>
  shapes.some((s) => isBubble(s) && (side === "left" ? s.x < 45 : s.x > 355));

export const plain = (text: string) => text.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();

export const isFreeLabel = (text: string) => /^(free|claimable|claim)$/.test(plain(text));
