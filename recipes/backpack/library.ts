import { crop, type Image, loadImage, type Point } from "../../src/image.ts";
import { distance, iconAt, signatureIn, signatureOf } from "./names.ts";

const dir = new URL("../../assets/backpack/", import.meta.url);
const iconInTile = { x: 18, y: 8, width: 180, height: 140 };
const shifts = [-9, -6, -3, 0, 3, 6, 9];
const close = 8;

export type Item = { name: string; signature: number[] };

export const itemFrom = (name: string, tile: Image): Item => ({ name, signature: signatureOf(crop(tile, iconInTile)) });

export const loadItems = (): Item[] =>
  [...Deno.readDirSync(dir)]
    .filter((e) => e.name.endsWith(".png"))
    .map((e) => itemFrom(e.name.replace(/(~\d+)?\.png$/, ""), loadImage(new URL(e.name, dir))));

export const nearest = (items: Item[], img: Image, spot: Point) => {
  const at = iconAt(spot);
  const views = shifts.flatMap((dx) => shifts.map((dy) => signatureIn(img, { ...at, x: at.x + dx, y: at.y + dy })));
  return items
    .map((item) => ({ name: item.name, d: Math.min(...views.map((view) => distance(item.signature, view))) }))
    .toSorted((a, b) => a.d - b.d)[0];
};

export const recognise = (items: Item[], img: Image, spot: Point) => {
  const best = nearest(items, img, spot);
  return best && best.d < close ? best.name : undefined;
};
