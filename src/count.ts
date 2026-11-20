import type { Image } from "./image.ts";
import templates from "./digits.json" with { type: "json" };

const grid = { width: 10, height: 14 };

type Glyph = { left: number; width: number; height: number; bits: string };

export const glyphsIn = (img: Image, tile: { x: number; y: number; width: number; height: number }): Glyph[] => {
  const area = { x: tile.x + 40, y: tile.y + 136, width: tile.width - 40, height: 56 };
  const lit = Uint8Array.from({ length: area.width * area.height }, (_, i) => {
    const p = ((area.y + Math.floor(i / area.width)) * img.width + area.x + (i % area.width)) * img.channels;
    const max = Math.max(img.data[p], img.data[p + 1], img.data[p + 2]);
    const min = Math.min(img.data[p], img.data[p + 1], img.data[p + 2]);
    return min >= 185 && max - min <= 40 ? 1 : 0;
  });
  const seen = new Uint8Array(lit.length);

  const fill = (start: number) => {
    const stack = [start];
    const cells: number[] = [];
    seen[start] = 1;
    while (stack.length) {
      const i = stack.pop() as number;
      cells.push(i);
      const cx = i % area.width;
      const cy = Math.floor(i / area.width);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
        const nx = cx + dx;
        const ny = cy + dy;
        const n = ny * area.width + nx;
        if (nx < 0 || ny < 0 || nx >= area.width || ny >= area.height || seen[n] || !lit[n]) continue;
        seen[n] = 1;
        stack.push(n);
      }
    }
    return cells;
  };

  return Array.from(lit.keys())
    .flatMap((i) => lit[i] && !seen[i] ? [fill(i)] : [])
    .map((cells) => {
      const xs = cells.map((i) => i % area.width);
      const ys = cells.map((i) => Math.floor(i / area.width));
      const box = { left: Math.min(...xs), right: Math.max(...xs), top: Math.min(...ys), bottom: Math.max(...ys) };
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

export const countOn = (img: Image, tile: { x: number; y: number; width: number; height: number }) => {
  const digits = glyphsIn(img, tile).map(digitOf);
  return digits.length && digits.every((d) => d !== undefined) ? Number(digits.join("")) : undefined;
};
