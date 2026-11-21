import { crop, difference, fromPng, type Image, loadImage, type Region, scaleUp, toPng } from "./image.ts";
import { countOn } from "./count.ts";
import type { Phone } from "./phone.ts";
import { sleep } from "./time.ts";

const rewardsDir = new URL("../assets/rewards/", import.meta.url);

const icon = { width: 96, height: 84, up: 62 };

const size = 198;
const layouts = {
  collected: { sets: [[108, 372, 636, 900], [240, 504, 768]], top: 1020, pitch: 264, rows: 5 },
  fight: { sets: [[126, 382, 638, 894]], top: 1182, pitch: 254, rows: 3 },
};

const jump = (img: Image, x: number, y: number) => {
  const p = (y * img.width + x - 5) * img.channels;
  const q = (y * img.width + x + 5) * img.channels;
  return Math.abs(img.data[p] - img.data[q]) + Math.abs(img.data[p + 1] - img.data[q + 1]) +
      Math.abs(img.data[p + 2] - img.data[q + 2]) > 50;
};

const edge = (img: Image, x: number, y0: number) => {
  const ys = Array.from({ length: 35 }, (_, i) => y0 + 30 + i * 4);
  return Math.max(
    ...[-8, -6, -4, -2, 0, 2, 4, 6, 8].map((dx) => ys.filter((y) => jump(img, x + dx, y)).length / ys.length),
  );
};

export const findTiles = (img: Image, fight: boolean): Region[] => {
  const layout = fight ? layouts.fight : layouts.collected;
  return Array.from({ length: layout.rows }, (_, r) => layout.top + r * layout.pitch)
    .filter((y) => y + size < img.height)
    .flatMap((y) =>
      layout.sets.flat().toSorted((m, n) => m - n).map((x) => ({
        x,
        y,
        width: size,
        height: size,
        share: Math.min(edge(img, x, y), edge(img, x + size, y)),
      }))
    )
    .filter((t) => t.share > 0.9);
};

const iconAt = (tile: Region) => ({
  x: Math.round(tile.x + tile.width / 2 - icon.width / 2),
  y: Math.round(tile.y + tile.height / 2 - icon.up),
  width: icon.width,
  height: icon.height,
});

export const iconOf = (img: Image, tile: Region) => crop(img, iconAt(tile));

export const countRegion = (tile: Region) => ({
  x: tile.x + Math.round(tile.width * 0.3),
  y: tile.y + Math.round(tile.height * 0.66),
  width: Math.round(tile.width * 0.7),
  height: Math.round(tile.height * 0.34),
});

export type Library = { name: string; img: Image }[];

export const loadLibrary = (dir: URL): Library =>
  [...Deno.readDirSync(dir)]
    .filter((e) => e.name.endsWith(".png"))
    .map((e) => ({ name: e.name.replace(/(~\d+)?\.png$/, ""), img: loadImage(new URL(e.name, dir)) }));

const shifts = [-12, -9, -6, -3, 0, 3, 6, 9, 12];

export const matchAt = (img: Image, at: { x: number; y: number }, library: Library) => {
  const closest = (dxs: number[], dys: number[]) =>
    library
      .map((entry) => ({
        name: entry.name,
        d: Math.min(...dxs.flatMap((dx) => dys.map((dy) => difference(img, entry.img, at.x + dx, at.y + dy)))),
      }))
      .toSorted((m, n) => m.d - n.d)[0];
  const straight = closest([0], [0]);
  if (straight && straight.d < 16) return straight.name;
  const shifted = closest(shifts, shifts);
  return shifted && shifted.d < 16 ? shifted.name : undefined;
};

export const nameOf = (img: Image, tile: Region, library: Library) => matchAt(img, iconAt(tile), library);

export const amountOf = (text: string) => {
  const m = text.replaceAll(",", "").match(/(\d+(?:\.\d+)?)\s*([KMB])?/i);
  if (!m) return 1;
  const unit = { K: 1e3, M: 1e6, B: 1e9 }[(m[2] ?? "").toUpperCase()] ?? 1;
  return Math.round(Number(m[1]) * unit);
};

export const saveIcon = (dir: URL, name: string, img: Image) => Deno.writeFile(new URL(`${name}.png`, dir), toPng(img));

export const rewardCounter = (phone: Phone) => {
  const library = loadLibrary(rewardsDir);
  const totals = new Map<string, number>();

  const count = async (fight: boolean) => {
    await sleep(1500);
    const shot = fromPng(await phone.snap());
    const tiles = findTiles(shot, fight);
    if (fight && tiles.length > 8) return;
    for (const tile of tiles) {
      const known = nameOf(shot, tile, library);
      const numbers = library.flatMap((entry) => entry.name.match(/^unknown-(\d+)$/)?.[1] ?? []).map(Number);
      const name = known ?? `unknown-${String(Math.max(0, ...numbers) + 1).padStart(2, "0")}`;
      if (!known) {
        const img = iconOf(shot, tile);
        await saveIcon(rewardsDir, name, img);
        library.push({ name, img });
      }
      const text = (await phone.ocr(scaleUp(crop(shot, countRegion(tile)), 3))).map((l) => l.text).join(" ");
      const amount = /\d/.test(text) ? amountOf(text) : countOn(shot, tile) ?? 1;
      const label = known === "speedup"
        ? (await phone.ocr(scaleUp(crop(shot, { x: tile.x, y: tile.y, width: tile.width, height: 70 }), 3))).map((l) =>
          l.text
        ).join(" ").match(/(\d+)\s*(min|hr|h|d)/i)
        : null;
      const named = label ? `${label[1]} ${label[2].toLowerCase()} speedup` : name;
      totals.set(named, (totals.get(named) ?? 0) + amount);
    }
  };

  const print = () => {
    const rewards = [...totals.entries()].toSorted(([a], [b]) =>
      Number(a.startsWith("unknown")) - Number(b.startsWith("unknown")) || a.localeCompare(b)
    );
    if (rewards.length) {
      console.log(
        `rewards:\n${rewards.map(([name, amount]) => `  ${amount.toLocaleString("en-US")} ${name}`).join("\n")}`,
      );
    }
    if (rewards.some(([name]) => name.startsWith("unknown"))) {
      console.log(`to name an unknown reward, rename its picture in ${rewardsDir.pathname}`);
    }
  };

  return { count, print };
};

export type Rewards = ReturnType<typeof rewardCounter>;
