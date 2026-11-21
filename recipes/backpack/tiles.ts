import type { Image } from "../../src/image.ts";
import type { TextLine } from "../../src/ocr.ts";
import { center } from "../../src/screen.ts";

export const columns = [60, 155, 249, 343];

const hsv = (r: number, g: number, b: number) => {
  const max = Math.max(r, g, b);
  const d = max - Math.min(r, g, b);
  const h = d === 0 ? 0 : max === r ? ((g - b) / d + 6) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, max ? (d / max) * 100 : 0, max / 2.55];
};

export const colourAt = (img: Image, x: number, y: number) => {
  const votes = [[-92, -84], [-98, 0], [-92, -60]].map(([dx, dy]) => {
    const p = ((Math.round(y * 3) + dy) * img.width + x * 3 + dx) * img.channels;
    const [h, s, v] = hsv(img.data[p], img.data[p + 1], img.data[p + 2]);
    if (v > 80 && s < 14 && img.data[p] > 215) return "none";
    if (s < 16) return "grey";
    if (h >= 110 && h < 175) return "green";
    if (h >= 185 && h < 232) return "blue";
    if (h >= 232 && h < 300) return "purple";
    if (h >= 15 && h < 50 && s > 45) return "orange";
    return "none";
  });
  return ["green", "grey", "blue", "purple", "orange", "none"].toSorted((a, b) => votes.filter((v) => v === b).length - votes.filter((v) => v === a).length)[0];
};

export const rowsIn = (lines: TextLine[]) =>
  lines
    .filter((l) => /^[\d,.]+$/.test(l.text.trim()) && columns.some((c) => center(l).x - c >= 5 && center(l).x - c <= 34))
    .map((l) => center(l).y - 26)
    .toSorted((a, b) => a - b)
    .reduce<number[][]>((rows, y) => rows.length && y - rows[rows.length - 1][0] < 40 ? [...rows.slice(0, -1), [...rows[rows.length - 1], y]] : [...rows, [y]], [])
    .filter((row, i, all) => row.length >= 2 || i === all.length - 1)
    .map((row) => row[0]);
