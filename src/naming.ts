import { type Image, loadImage } from "./image.ts";

export type Pictured = { name: string; img: Image };

const shrink = 0.9;
const sample = 3;
const offsets = [45, 48, 51, 54].flatMap((x) => [36, 39, 42, 45, 48, 51].map((y) => ({ x, y })));
const sure = 18;
const apart = 8;
const likely = 26;
const farApart = 20;

export const shrunk = (tile: Image): Image => {
  const width = Math.round(tile.width * shrink);
  const height = Math.round(tile.height * shrink);
  return {
    ...tile,
    width,
    height,
    channels: 3,
    data: new Uint8Array(width * height * 3).map((_, k) => {
      const p = Math.floor(k / 3);
      const x = Math.min(tile.width - 1, Math.floor((p % width) * tile.width / width));
      const y = Math.min(tile.height - 1, Math.floor(Math.floor(p / width) * tile.height / height));
      return tile.data[(y * tile.width + x) * tile.channels + (k % 3)];
    }),
  };
};

const sampled = (tile: Image, icon: Image, x0: number, y0: number) => {
  const columns = Math.floor(icon.width / sample);
  const rows = Math.floor(icon.height / sample);
  const total = Array.from({ length: columns * rows }).reduce<number>((sum, _, i) => {
    const x = (i % columns) * sample;
    const y = Math.floor(i / columns) * sample;
    const t = ((y0 + y) * tile.width + x0 + x) * tile.channels;
    const c = (y * icon.width + x) * icon.channels;
    return sum + Math.abs(tile.data[t] - icon.data[c]) + Math.abs(tile.data[t + 1] - icon.data[c + 1]) +
      Math.abs(tile.data[t + 2] - icon.data[c + 2]);
  }, 0);
  return total / (columns * rows * 3);
};

export const likeness = (tile: Image, icon: Image) => {
  const fits = offsets.filter((o) => o.x + icon.width <= tile.width && o.y + icon.height <= tile.height);
  return fits.length ? Math.min(...fits.map((o) => sampled(tile, icon, o.x, o.y))) : Infinity;
};

export const pick = (scores: { name: string; d: number }[]) => {
  const [best, ...rest] = scores.toSorted((a, b) => a.d - b.d);
  const other = rest.find((s) => s.name !== best?.name);
  const gap = other ? other.d - best.d : Infinity;
  return best && ((best.d < sure && gap >= apart) || (best.d < likely && gap >= farApart)) ? best.name : undefined;
};

export const nameFor = (icon: Image, tiles: Pictured[]) =>
  pick(tiles.map((t) => ({ name: t.name, d: likeness(t.img, icon) })));

const baseName = (file: string) => file.replace(/(~\d+)?\.png$/, "");

export const loadTiles = (dir: URL): Pictured[] =>
  [...Deno.readDirSync(dir)]
    .filter((e) => e.name.endsWith(".png"))
    .map((e) => ({ name: baseName(e.name), img: shrunk(loadImage(new URL(encodeURIComponent(e.name), dir))) }));

export const freeName = (taken: string[], name: string) => {
  if (!taken.includes(name)) return name;
  const number = Array.from({ length: taken.length + 2 }, (_, i) => i + 2).find((n) => !taken.includes(`${name}~${n}`));
  return `${name}~${number}`;
};

export const nameUnknowns = async (rewardsDir: URL, tiles: Pictured[], only?: Pictured) => {
  const files = [...Deno.readDirSync(rewardsDir)].map((e) => e.name).filter((n) => n.endsWith(".png"));
  const unknown = files.filter((n) => /^unknown-\d+\.png$/.test(n)).toSorted();
  const named: { from: string; to: string }[] = [];
  for (const file of unknown) {
    const icon = loadImage(new URL(file, rewardsDir));
    if (only && likeness(only.img, icon) >= sure) continue;
    const name = nameFor(icon, tiles);
    if (!name) continue;
    const taken = [...files, ...named.map((n) => `${n.to}.png`)].map((n) => n.replace(/\.png$/, ""));
    const to = freeName(taken, name);
    await Deno.rename(new URL(file, rewardsDir), new URL(`${encodeURIComponent(to)}.png`, rewardsDir));
    named.push({ from: file.replace(/\.png$/, ""), to });
  }
  return named;
};
