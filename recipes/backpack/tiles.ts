import type { Image } from "../../src/image.ts";
import { hsv, rgbAt, share } from "../../src/pixels.ts";
import { scale } from "../../src/screen.ts";

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
  const most = colours.toSorted((a, b) => count(b) - count(a))[0];
  return count(most) >= 2 ? most : "none";
};

const list = { top: 150, bottom: 840 };
const tileHeight = 76;
const pitch = 93;

export const tileRows = (img: Image) => {
  const ys = Array.from({ length: list.bottom - list.top }, (_, i) => list.top + i);
  const differs = ys.map((y) => {
    const tile = rgbAt(img, columns[0] * scale, y * scale);
    const beside = rgbAt(img, (columns[0] - 46) * scale, y * scale);
    return tile.reduce((sum, n, c) => sum + Math.abs(n - beside[c]), 0) > 45;
  });
  const inside = differs.map((on, i) =>
    on || (differs.slice(Math.max(0, i - 5), i).some((d) => d) && differs.slice(i + 1, i + 6).some((d) => d))
  );
  const starts = ys.filter((_, i) => inside[i] && !inside[i - 1]);
  const rows = starts.flatMap((start) => {
    const length = inside.slice(start - list.top).findIndex((on) => !on);
    return length >= tileHeight - 14 && length <= tileHeight + 14 ? [start + tileHeight / 2 - 1] : [];
  });
  return rows.flatMap((y, i) => {
    const next = rows[i + 1];
    const missing = next === undefined ? 0 : Math.max(0, Math.round((next - y) / pitch) - 1);
    return [y, ...Array.from({ length: missing }, (_, k) => y + (k + 1) * (next - y) / (missing + 1))];
  });
};

export const tileAbovePanel = 61;
const margins = [75, 1100];
const panelRun = 10;

const isCream = (r: number, g: number, b: number) => r > 235 && g > 220 && b > 200 && r - b < 60;

export const panelIn = (img: Image) => {
  const ys = Array.from({ length: Math.floor((list.bottom - list.top) / 2) }, (_, i) => list.top + i * 2);
  const cream = ys.map((y) =>
    margins.every((x) => share(img, { x, y: y * scale, width: 30, height: 3 }, isCream, 3) > 0.8)
  );
  const top = cream.findIndex((_, i) => i + panelRun <= cream.length && cream.slice(i, i + panelRun).every((c) => c));
  return top < 0 ? undefined : { top: ys[top] };
};

const usable = [
  /^[\d,.]+\s*[KM]?\s+(bread|wood|stone|iron)(\s*\(secured\))?$/i,
  /^[\d,]+\s+gems$/i,
  /^[\d,.]+\s*K?\s+hero xp$/i,
];
const resource = /bread|wood|stone|iron/i;
const tiers: Record<number, string> = { 100: "grey", 1000: "green", 10000: "blue", 100000: "blue", 1000000: "purple" };

export const usableTitle = (title: string) => usable.some((t) => t.test(title.trim()));

export const tierOf = (title: string) => {
  const m = title.trim().match(/^([\d,.]+)\s*([KM])?\s+(bread|wood|stone|iron)\b/i);
  if (!m) return undefined;
  const unit = { K: 1e3, M: 1e6 }[(m[2] ?? "").toUpperCase()] ?? 1;
  return tiers[Number(m[1].replaceAll(",", "")) * unit];
};

export const isResource = (title: string) => resource.test(title);

export const defaultItems = [
  "governor gear materials chest",
  "trial chest",
  "badland treasure",
  "reserve chest",
  "countess chest",
  "10 vip xp",
  "100 vip xp",
];

export type Wanted = { colours: string[]; items: string[] };

export const base = (name: string) => name.toLowerCase().replace(/\s*\(secured\)$/, "").trim();

export const unwanted = (name: string | undefined, wanted: Wanted) => {
  if (!name) return "its name is not known";
  if (wanted.items.includes(base(name))) return undefined;
  if (!usableTitle(name)) return "it is not on the list of things to use";
  if (!resource.test(name)) return undefined;
  const tier = tierOf(name);
  if (!tier) return "the size in its name is not one it knows";
  if (!wanted.colours.includes(tier)) return `it is ${tier} and only ${wanted.colours.join(", ")} may be used`;
  return undefined;
};

export const refusal = (title: string | undefined, before: string, open: string, wanted: Wanted) => {
  const byName = unwanted(title, wanted);
  if (byName || !title || wanted.items.includes(base(title)) || !resource.test(title)) return byName;
  const tier = tierOf(title);
  if (before !== tier) return `its name says ${tier} but the tile looked ${before} before it was opened`;
  if (open !== tier) return `its name says ${tier} but the open tile looks ${open}`;
  return undefined;
};

export const mayUse = (title: string, seen: string, colours: string[], items: string[] = []) =>
  refusal(title, seen, seen, { colours, items }) === undefined;
