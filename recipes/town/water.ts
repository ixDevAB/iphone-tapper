import { decide } from "../../src/decisions.ts";
import { look, requireIphone, type Seen } from "../../src/flow.ts";
import type { Image, Point } from "../../src/image.ts";
import type { TextLine } from "../../src/ocr.ts";
import type { Phone } from "../../src/phone.ts";
import { count } from "../../src/pixels.ts";
import type { Recipe } from "../../src/recipe.ts";
import { center, exact, scale } from "../../src/screen.ts";
import { clock, sleep } from "../../src/time.ts";
import { panel, row, tapUntil, toWorld } from "../../src/town.ts";
import { withSetting } from "../heal/calibrate.ts";

const envFile = new URL("../../.env", import.meta.url);
const setting = "ISLAND_PURIFIER";
const fountain = { x: 201, y: 340 };
const bubble = [{ x: 201, y: 209 }, { x: 201, y: 225 }, { x: 201, y: 193 }];
const hideBox = { x: 234, y: 560 };
const dragFrom = { x: 200, y: 420 };
const below = [55, 35, 75];

export const views = [
  { name: "around the fountain", drag: { x: 0, y: 0 } },
  { name: "to the right of the fountain", drag: { x: -150, y: 0 } },
  { name: "further to the right", drag: { x: -300, y: 0 } },
  { name: "to the left of the fountain", drag: { x: 150, y: 0 } },
  { name: "further to the left", drag: { x: 300, y: 0 } },
  { name: "below the fountain", drag: { x: 0, y: -150 } },
  { name: "above the fountain", drag: { x: 0, y: 150 } },
  { name: "below and to the right", drag: { x: -150, y: -150 } },
  { name: "above and to the right", drag: { x: -150, y: 150 } },
  { name: "below and to the left", drag: { x: 150, y: -150 } },
  { name: "above and to the left", drag: { x: 150, y: 150 } },
];

export type Place = { drag: Point; label: Point };

export const placeFrom = (text = ""): Place | undefined => {
  const n = text.split(",").map((part) => Number(part.trim()));
  return n.length === 4 && n.every((v) => Number.isFinite(v))
    ? { drag: { x: n[0], y: n[1] }, label: { x: n[2], y: n[3] } }
    : undefined;
};

export const placeText = (place: Place) => [place.drag.x, place.drag.y, place.label.x, place.label.y].join(",");

const isTick = (r: number, g: number, b: number) => g > 185 && g - r > 110 && g - b > 60;

const hideTicked = (img: Image) =>
  count(img, { x: (hideBox.x - 20) * scale, y: (hideBox.y - 15) * scale, width: 120, height: 90 }, isTick) > 200;

const labelled = (lines: TextLine[], name: RegExp) => lines.find((l) => name.test(l.text) && center(l).y > 110);

const waterOn = (lines: TextLine[]) => {
  const shown = lines.find((l) => /^[\d,]+$/.test(l.text.trim()) && center(l).y < 95 && center(l).x > 280);
  return shown ? Number(shown.text.replace(/\D/g, "")) : undefined;
};

const picked = (lines: TextLine[]) => {
  const details = labelled(lines, /^Details/i);
  const retrieve = labelled(lines, /^Retrieve/i);
  return details && retrieve
    ? { x: Math.round((center(details).x + center(retrieve).x) / 2), y: center(details).y - 155 }
    : undefined;
};

const collectButton = (lines: TextLine[]) => lines.find((l) => /Collect/i.test(l.text) && center(l).y > 200);

const moveMap = async (phone: Phone, drag: Point) => {
  if (!drag.x && !drag.y) return;
  await phone.drag(
    { x: dragFrom.x - drag.x / 2, y: dragFrom.y - drag.y / 2 },
    { x: dragFrom.x + drag.x / 2, y: dragFrom.y + drag.y / 2 },
    1.2,
  );
  await sleep(1500);
};

const setHide = async (phone: Phone, wanted: boolean, tries = 3): Promise<void> => {
  if (hideTicked((await look(phone)).img()) === wanted) return;
  if (tries <= 0) throw new Error("could not switch the hide option of the town list");
  await phone.tap(hideBox);
  await sleep(1500);
  return setHide(phone, wanted, tries - 1);
};

export const openIsland = async (phone: Phone) => {
  const first = await panel(phone, "Daily");
  const ticked = hideTicked(first.img());
  const shown = async (seen: Seen, scrolls: number): Promise<Point | undefined> => {
    const found = row(seen.lines, "Fountain of Life");
    if (found) return found.button;
    if (scrolls <= 0) return undefined;
    await phone.drag({ x: 120, y: 480 }, { x: 120, y: 435 }, 1.5);
    await sleep(1000);
    return shown(await look(phone), scrolls - 1);
  };
  const direct = row(first.lines, "Fountain of Life")?.button;
  if (!direct && ticked) {
    await decide("showing the finished rows of the list to reach the fountain");
    await setHide(phone, false);
  }
  if (!direct) {
    for (const _ of [1, 2, 3]) {
      await phone.drag({ x: 120, y: 330 }, { x: 120, y: 520 }, 0.6);
      await sleep(700);
    }
  }
  const button = direct ?? await shown(await look(phone), 16);
  const restore = async () => {
    if (direct || !ticked) return;
    await panel(phone, "Daily");
    await setHide(phone, true);
  };
  if (!button) {
    await restore();
    throw new Error("the Fountain of Life is not in the list at the side of the town map");
  }
  await phone.tap(button);
  const island = async (tries: number): Promise<boolean> => {
    await sleep(1500);
    if (exact((await look(phone)).lines, "My Island").length) return true;
    return tries > 0 ? island(tries - 1) : false;
  };
  if (!(await island(8))) {
    await restore();
    throw new Error("the island did not open");
  }
  await sleep(4000);
  return restore;
};

export const locate = (phone: Phone, log: (text: string) => void, shown?: (view: number) => Promise<void>) => {
  const each = async (index: number): Promise<Place | undefined> => {
    const view = views[index];
    if (!view) return undefined;
    const restore = await openIsland(phone);
    await moveMap(phone, view.drag);
    log(`view ${index + 1} of ${views.length}, ${view.name}: if you see your Purifier, tap it until its buttons show`);
    if (shown) await shown(index);
    const watch = async (polls: number): Promise<Point | undefined> => {
      const label = picked((await look(phone)).lines);
      if (label) return label;
      if (polls <= 0) return undefined;
      await sleep(1000);
      return watch(polls - 1);
    };
    const label = await watch(9);
    await restore();
    return label ? { drag: view.drag, label } : each(index + 1);
  };
  return each(0);
};

export const locateWater: Recipe = {
  description:
    "Finds where your Purifier is on the island, with your help: it shows the island piece by piece and you tap the Purifier when you see it. It writes ISLAND_PURIFIER to .env for collect-water. It presses nothing on the island itself.",
  run: async (phone, settings) => {
    const time = clock(settings.env.CLOCK);
    const log = (text: string) => console.log(`${time()} ${text}`);
    await requireIphone(phone);
    const place = await locate(phone, log);
    await toWorld(phone);
    if (!place) throw new Error("no Purifier was tapped in any of the views, start it again and tap it when asked");
    const file = await Deno.readTextFile(envFile).catch(() => "");
    await Deno.writeTextFile(envFile, withSetting(file, setting, placeText(place)));
    await decide("saved where the purifier is", { place });
    console.log(`stopped: saved ${setting}=${placeText(place)} to .env`);
  },
};

export const collectWater: Recipe = {
  description:
    "Collects the water on your island: from the Fountain of Life, and from the Purifier when ISLAND_PURIFIER says where it is (see island-locate-water). Starts on the world map or the town map and ends on the world map.",
  run: async (phone, settings) => {
    const time = clock(settings.env.CLOCK);
    const log = (text: string) => console.log(`${time()} ${text}`);
    const place = placeFrom(settings.env[setting]);
    if (settings.env[setting] && !place) throw new Error(`${setting} in .env is not as island-locate-water writes it`);
    await requireIphone(phone);

    const restore = await openIsland(phone);
    const press = async (name: string) => {
      const button = collectButton((await look(phone)).lines);
      if (!button) return false;
      await decide("pressed Collect", { on: name });
      await phone.tap({ x: center(button).x, y: center(button).y - 33 });
      await sleep(2500);
      return true;
    };

    const start = await look(phone);
    const before = waterOn(start.lines);
    if (!labelled(start.lines, /Fountain of Life/i)) {
      await tapUntil(phone, bubble, (seen) => (waterOn(seen.lines) ?? 0) > (before ?? Infinity), 3000);
      await phone.tap(fountain);
      await sleep(1500);
    }
    const selected = labelled((await look(phone)).lines, /Fountain of Life/i);
    if (selected) await press("Fountain of Life");
    const afterFountain = waterOn((await look(phone)).lines);
    await decide("collected at the fountain", { before, after: afterFountain, selected: Boolean(selected) });

    const purifier = async (): Promise<string> => {
      if (!place) return `no ${setting} in .env, run just island-locate-water to collect there too`;
      await moveMap(phone, place.drag);
      const had = waterOn((await look(phone)).lines);
      for (const dy of below) {
        await phone.tap({ x: place.label.x, y: place.label.y + dy });
        await sleep(2500);
        const seen = await look(phone);
        if (labelled(seen.lines, /Purifier/i) || picked(seen.lines)) {
          return (await press("Purifier")) ? "collected" : "it has no Collect button right now";
        }
        if (had !== undefined && (waterOn(seen.lines) ?? 0) > had) return "collected";
      }
      return `it is not where ${setting} says, run just island-locate-water again`;
    };
    const fromPurifier = await purifier();
    const after = waterOn((await look(phone)).lines);
    await decide("looked for the purifier", { result: fromPurifier, water: after });
    log(`purifier: ${fromPurifier}`);

    await restore();
    await toWorld(phone);
    const gained = before !== undefined && after !== undefined ? after - before : undefined;
    console.log(
      `stopped: ${
        gained === undefined
          ? "collected, could not read how much water it gave"
          : `${gained.toLocaleString("en-US")} water collected`
      }`,
    );
  },
};
