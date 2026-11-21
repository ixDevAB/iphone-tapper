import type { Image, Region } from "./image.ts";
import { bounds, hits, regions } from "./pixels.ts";
import templates from "./digits.json" with { type: "json" };

const grid = { width: 10, height: 14 };

type Glyph = { left: number; width: number; height: number; bits: string };

const isWhite = (r: number, g: number, b: number) =>
  Math.min(r, g, b) >= 185 && Math.max(r, g, b) - Math.min(r, g, b) <= 40;

export const glyphsIn = (img: Image, tile: Region): Glyph[] => {
  const area = { x: tile.x + 40, y: tile.y + 136, width: tile.width - 40, height: 56 };

  return regions(hits(img, area, isWhite), area.width, true)
    .map((cells) => {
      const box = bounds(cells, area.width);
      const width = box.right - box.left + 1;
      const height = box.bottom - box.top + 1;
      const inside = new Set(cells);
      const bits = Array.from({ length: grid.width * grid.height }, (_, k) => {
        const x = box.left + Math.floor(((k % grid.width) + 0.5) * width / grid.width);
        const y = box.top + Math.floor((Math.floor(k / grid.width) + 0.5) * height / grid.height);
        return inside.has(y * area.width + x) ? "1" : "0";
      }).join("");
      return { left: box.left, top: box.top, width, height, bits };
    })
    .filter((g) => g.height >= 20 && g.height <= 34 && g.width >= 5 && g.width <= 30 && g.top >= 4 && g.top <= 22)
    .toSorted((a, b) => a.left - b.left);
};

const distance = (a: string, b: string) => [...a].reduce((sum, c, i) => sum + (c === b[i] ? 0 : 1), 0);

export const digitOf = (glyph: Glyph) => {
  const best = (templates as { digit: string; aspect: number; bits: string }[])
    .filter((t) => Math.abs(t.aspect - glyph.width / glyph.height) < 0.22)
    .map((t) => ({ digit: t.digit, d: distance(t.bits, glyph.bits) }))
    .toSorted((a, b) => a.d - b.d)[0];
  return best && best.d <= 26 ? best.digit : undefined;
};

export const countOn = (img: Image, tile: Region) => {
  const digits = glyphsIn(img, tile).map(digitOf);
  return digits.length && digits.every((d) => d !== undefined) ? Number(digits.join("")) : undefined;
};
