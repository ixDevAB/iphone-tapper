import type { Image } from "../../src/image.ts";
import type { TextLine } from "../../src/ocr.ts";
import { hsv, rgbAt } from "../../src/pixels.ts";
import { center, scale } from "../../src/screen.ts";

export const columns = [60, 155, 249, 343];

const colours = ["green", "grey", "blue", "purple", "orange", "none"];

export const colourAt = (img: Image, x: number, y: number) => {
  const votes = [[-92, -84], [-98, 0], [-92, -60]].map(([dx, dy]) => {
    const [r, g, b] = rgbAt(img, x * scale + dx, Math.round(y * scale) + dy);
    const [h, s, v] = hsv(r, g, b);
    if (v > 80 && s < 14 && r > 215) return "none";
    if (s < 16) return "grey";
    if (h >= 110 && h < 175) return "green";
    if (h >= 185 && h < 232) return "blue";
    if (h >= 232 && h < 300) return "purple";
    if (h >= 15 && h < 50 && s > 45) return "orange";
    return "none";
  });
  const count = (colour: string) => votes.filter((v) => v === colour).length;
  return colours.toSorted((a, b) => count(b) - count(a))[0];
};

export const rowsIn = (lines: TextLine[]) =>
  lines
    .filter((l) =>
      /^[\d,.]+$/.test(l.text.trim()) && columns.some((c) => center(l).x - c >= 5 && center(l).x - c <= 34)
    )
    .map((l) => center(l).y - 26)
    .toSorted((a, b) => a - b)
    .reduce<number[][]>(
      (rows, y) => rows.length && y - rows[rows.length - 1][0] < 40
        ? [...rows.slice(0, -1), [...rows[rows.length - 1], y]]
        : [...rows, [y]],
      [],
    )
    .filter((row, i, all) => row.length >= 2 || i === all.length - 1)
    .map((row) => row[0]);
