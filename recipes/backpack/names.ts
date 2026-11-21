import { look, requireIphone, type Seen } from "../../src/flow.ts";
import { crop, type Image, type Point, toPng } from "../../src/image.ts";
import { latin, type TextLine } from "../../src/ocr.ts";
import { rgbAt } from "../../src/pixels.ts";
import type { Recipe } from "../../src/recipe.ts";
import { backArrow, center, exact, has, saveShot, scale } from "../../src/screen.ts";
import { clock, sleep } from "../../src/time.ts";
import { atTown } from "../../src/world.ts";
import { columns, panelIn, tileAbovePanel, tileRows } from "./tiles.ts";

const backpackButton = { x: 170, y: 825 };
const tabY = 121;
const tabs = [
  { name: "resources", x: 49 },
  { name: "speedups", x: 126 },
  { name: "bonuses", x: 200 },
  { name: "gear", x: 277 },
  { name: "other", x: 353 },
];
const dir = new URL("../../assets/backpack/", import.meta.url);
const listTop = 150;
const cells = { columns: 6, rows: 5, step: 5 };
const label = /^([\d,.]+|\W*lv\S*\s*\d+)$/i;
const misread: Record<string, string> = {
  "hunting arrowa": "hunting arrow",
  "crusader battle boots": "crusader's battle boots",
};

export const iconAt = (spot: Point) => ({
  x: spot.x * scale - 90,
  y: Math.round(spot.y * scale) - 100,
  width: 180,
  height: 140,
});

export const tileAt = (spot: Point) => ({
  x: spot.x * scale - 108,
  y: Math.round(spot.y * scale) - 108,
  width: 216,
  height: 216,
});

export const signatureIn = (img: Image, region: { x: number; y: number; width: number; height: number }) =>
  Array.from({ length: cells.columns * cells.rows }, (_, i) => {
    const width = Math.floor(region.width / cells.columns);
    const height = Math.floor(region.height / cells.rows);
    const across = Math.floor(width / cells.step);
    const x0 = region.x + (i % cells.columns) * width;
    const y0 = region.y + Math.floor(i / cells.columns) * height;
    const samples = Array.from(
      { length: across * Math.floor(height / cells.step) },
      (_, k) => rgbAt(img, x0 + (k % across) * cells.step, y0 + Math.floor(k / across) * cells.step),
    );
    return [0, 1, 2].map((c) => samples.reduce((sum, rgb) => sum + rgb[c], 0) / samples.length);
  }).flat();

export const signatureOf = (icon: Image) => signatureIn(icon, { x: 0, y: 0, width: icon.width, height: icon.height });

export const distance = (a: number[], b: number[]) => a.reduce((sum, n, i) => sum + Math.abs(n - b[i]), 0) / a.length;

export const alike = (a: number[], b: number[]) => distance(a, b) < 12;

export const blank = (signature: number[]) =>
  [0, 1, 2].every((c) => {
    const values = signature.filter((_, i) => i % 3 === c);
    return Math.max(...values) - Math.min(...values) < 30;
  });

export const gearTitle = (lines: TextLine[], top: number) =>
  latin(
    lines
      .filter((l) => center(l).y > top + 22 && center(l).y < top + 48 && center(l).x > 110 && center(l).x < 270)
      .filter((l) => /\p{L}/u.test(l.text))
      .toSorted((a, b) => center(a).y - center(b).y)[0]?.text.trim() ?? "",
  );

const gearDetails = (lines: TextLine[]) => exact(lines, "Gear Details")[0];

export const countAt = (lines: TextLine[], spot: Point) =>
  lines.find((l) =>
    label.test(l.text.trim()) && center(l).x - spot.x >= 5 && center(l).x - spot.x <= 34 &&
    Math.abs(center(l).y - spot.y - 26) < 12
  )?.text.trim() ?? "";

export const listSample = (img: Image) =>
  Array.from(
    { length: 16 * 28 },
    (_, i) => rgbAt(img, 60 + (i % 16) * 72, (listTop + 40 + Math.floor(i / 16) * 23) * scale),
  ).flat();

export const sameList = (a: number[], b: number[]) =>
  a.length === b.length && a.filter((n, i) => Math.abs(n - b[i]) > 24).length < a.length * 0.03;

export const titleIn = (lines: TextLine[], panel: { top: number }) => {
  const lowest = panel.top + 45;
  const inside = lines
    .filter((l) => center(l).y > panel.top && center(l).y < lowest && /\p{L}/u.test(l.text))
    .toSorted((a, b) => center(a).y - center(b).y);
  const top = inside[0];
  if (!top) return "";
  const parts = inside.filter((l) => center(l).y - center(top).y < 9).toSorted((a, b) => center(a).x - center(b).x);
  return latin(parts.map((l) => l.text.trim()).join(" "));
};

export const fileName = (title: string) => {
  const name = title
    .toLowerCase()
    .replace(/^[til]([khm])\b/, "1$1")
    .replace(/[\/:*?"<>|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return misread[name] ?? name;
};

export const backpackNames: Recipe = {
  description:
    "Goes through the Backpack, taps every item to read its name and saves its picture under that name in assets/backpack. Uses nothing. Pick tabs with --tabs resources,speedups,bonuses,gear,other.",
  flags: { "--tabs": "NAMES_TABS" },
  run: async (phone, settings) => {
    const time = clock(settings.env.CLOCK);
    const log = (text: string) => console.log(`${time()} ${text}`);
    const all = tabs.map((t) => t.name);
    const wanted = (settings.env.NAMES_TABS || all.join(",")).toLowerCase().split(",").map((t) => t.trim());
    const wrong = wanted.filter((name) => !all.includes(name));
    if (wrong.length) throw new Error(`unknown tab ${wrong.join(", ")}, use ${all.join(", ")}`);

    await Deno.mkdir(dir, { recursive: true });
    const saved = new Set([...Deno.readDirSync(dir)].map((e) => e.name.replace(/\.png$/, "")));
    const tapped: { count: string; signature: number[] }[] = [];
    const named = new Set<string>();
    const unread: string[] = [];

    const closed = async (spot: Point, panel: { top: number }, tries: number): Promise<Seen> => {
      await phone.tap({ x: spot.x, y: panel.top - tileAbovePanel });
      await sleep(900);
      const after = await look(phone);
      const still = panelIn(after.img());
      if (!still) return after;
      if (tries <= 0) throw new Error("an item panel did not close, stopping to be safe");
      return closed(spot, still, tries - 1);
    };

    const closedGear = async (top: number, tries: number): Promise<Seen> => {
      await phone.tap({ x: 357, y: top });
      await sleep(900);
      const after = await look(phone);
      const still = gearDetails(after.lines);
      if (!still) return after;
      if (tries <= 0) throw new Error("the gear details did not close, stopping to be safe");
      return closedGear(center(still).y, tries - 1);
    };

    const visit = async (tab: string, seen: Seen, spot: Point): Promise<Seen> => {
      const icon = crop(seen.img(), iconAt(spot));
      const count = countAt(seen.lines, spot);
      tapped.push({ count, signature: signatureOf(icon) });
      await phone.tap(spot);
      await sleep(1000);
      const open = await look(phone);
      const gear = gearDetails(open.lines);
      const panel = gear ? undefined : panelIn(open.img());
      if (!gear && !panel) return open;
      const title = gear ? gearTitle(open.lines, center(gear).y) : panel ? titleIn(open.lines, panel) : "";
      const name = fileName(title);
      if (!name) {
        const shot = `backpack-${tab}-${unread.length + 1}.png`;
        unread.push(shot);
        await saveShot(shot, open.png);
        log(`${tab}: could not read a name, see build/${shot}`);
      }
      if (name && !named.has(name)) {
        named.add(name);
        if (!saved.has(name)) await Deno.writeFile(new URL(`${name}.png`, dir), toPng(crop(seen.img(), tileAt(spot))));
        log(`${tab}: ${title}${count ? ` (${count})` : ""}${saved.has(name) ? ", already saved" : ""}`);
        saved.add(name);
      }
      return gear ? closedGear(center(gear).y, 2) : panel ? closed(spot, panel, 2) : open;
    };

    const page = async (tab: string, seen: Seen, lowest: number, taps: number): Promise<void> => {
      if (gearDetails(seen.lines) || panelIn(seen.img())) {
        throw new Error("an item panel is open when it should not be, stopping to be safe");
      }
      const spots = tileRows(seen.img())
        .filter((y) => y >= 185 && y <= lowest)
        .flatMap((y) => columns.map((x) => ({ x, y })));
      const next = spots.find((spot) => {
        const signature = signatureOf(crop(seen.img(), iconAt(spot)));
        if (blank(signature)) return false;
        const count = countAt(seen.lines, spot);
        return !tapped.some((t) => t.count === count && alike(t.signature, signature));
      });
      if (!next || taps >= 40) return;
      return page(tab, await visit(tab, seen, next), lowest, taps + 1);
    };

    const pages = async (tab: string, number: number, last: number[]): Promise<void> => {
      const seen = await look(phone);
      const sample = listSample(seen.img());
      if (sameList(sample, last) || number >= 40) return page(tab, seen, 800, 0);
      await page(tab, seen, 560, 0);
      await phone.drag({ x: 200, y: 600 }, { x: 200, y: 330 }, 1);
      await sleep(1500);
      return pages(tab, number + 1, sample);
    };

    await requireIphone(phone);
    const inBackpack = (lines: TextLine[]) => has(lines, /Backpack/i) && has(lines, /Speedups|Bonuses|Resources/i);
    const start = await look(phone);
    if (!atTown(start.lines) && !inBackpack(start.lines)) throw new Error("start on the world map or in the backpack");
    if (inBackpack(start.lines)) {
      await phone.tap(backArrow);
      await sleep(1500);
    }
    await phone.tap(backpackButton);
    await sleep(2000);
    if (!inBackpack((await look(phone)).lines)) throw new Error("the backpack did not open");
    for (const tab of tabs.filter((t) => wanted.includes(t.name))) {
      await phone.tap({ x: tab.x, y: tabY });
      await sleep(1500);
      await pages(tab.name, 0, []);
    }
    await phone.tap(backArrow);
    await sleep(1500);
    console.log(`stopped: ${named.size} items named, pictures in ${dir.pathname}`);
    if (unread.length) console.log(`${unread.length} names could not be read, see build/backpack-*.png`);
  },
};
