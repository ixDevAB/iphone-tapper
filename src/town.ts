import { decide } from "./decisions.ts";
import { look, type Seen } from "./flow.ts";
import type { Point } from "./image.ts";
import type { TextLine } from "./ocr.ts";
import type { Phone } from "./phone.ts";
import { backArrow, center, exact } from "./screen.ts";
import { sleep } from "./time.ts";

const mapButton = { x: 361, y: 825 };
const panelHandle = { x: 8, y: 401 };
const tabs = { Town: 44, Wilderness: 126, Daily: 205 };
const tabY = 245;
const buttonX = 226;
const rowFullyShown = 520;

const inBar = (lines: TextLine[], text: string) => exact(lines, text).some((l) => center(l).y > 820);

export const onTownMap = (lines: TextLine[]) => inBar(lines, "World");

export const onWorldMap = (lines: TextLine[]) => inBar(lines, "Town") && !exact(lines, "My Island").length;

const panelOpen = (lines: TextLine[]) => exact(lines, "Wilderness").some((l) => Math.abs(center(l).y - tabY) < 15);

export const toTown = async (phone: Phone, tries = 6): Promise<Seen> => {
  const seen = await look(phone);
  if (onTownMap(seen.lines)) return seen;
  if (tries <= 0) throw new Error("could not get to the town map");
  const fromWorld = inBar(seen.lines, "Town");
  await decide(fromWorld ? "going to the town map" : "going back a screen");
  await phone.tap(fromWorld ? mapButton : backArrow);
  await sleep(fromWorld ? 3000 : 1500);
  return toTown(phone, tries - 1);
};

export const toWorld = async (phone: Phone, tries = 6): Promise<boolean> => {
  const seen = await look(phone);
  if (onWorldMap(seen.lines)) return true;
  if (tries <= 0) return false;
  const fromTown = onTownMap(seen.lines);
  await decide(fromTown ? "going to the world map" : "going back a screen");
  await phone.tap(fromTown ? mapButton : backArrow);
  await sleep(fromTown ? 3000 : 1500);
  return toWorld(phone, tries - 1);
};

export const panel = async (phone: Phone, tab: keyof typeof tabs): Promise<Seen> => {
  const seen = await toTown(phone);
  if (!panelOpen(seen.lines)) {
    await phone.tap(panelHandle);
    await sleep(1200);
  }
  const opened = panelOpen(seen.lines) ? seen : await look(phone);
  if (!panelOpen(opened.lines)) throw new Error("the list at the side of the town map did not open");
  await phone.tap({ x: tabs[tab], y: tabY });
  await sleep(1000);
  return look(phone);
};

export const row = (lines: TextLine[], title: string) => {
  const name = exact(lines, title).find((l) =>
    center(l).x > 90 && center(l).x < 200 && center(l).y > 260 && center(l).y < 600
  );
  if (!name) return undefined;
  const status = lines.find((l) =>
    l !== name && Math.abs(center(l).x - center(name).x) < 60 &&
    center(l).y - center(name).y > 8 && center(l).y - center(name).y < 28
  );
  return { status: status?.text.trim() ?? "", button: { x: buttonX, y: center(name).y + 9 } };
};

export const findRow = async (phone: Phone, first: Seen, titles: string[], scrolls = 16) => {
  const here = (seen: Seen) => titles.map((title) => row(seen.lines, title)).find((found) => found);
  const further = async (seen: Seen, left: number, lastY?: number): Promise<ReturnType<typeof row>> => {
    const found = here(seen);
    const stuck = found !== undefined && lastY !== undefined && Math.abs(found.button.y - lastY) < 3;
    if (left <= 0 || (found && (found.button.y <= rowFullyShown || stuck))) return found;
    await phone.drag({ x: 120, y: 480 }, { x: 120, y: 435 }, 1.5);
    await sleep(1000);
    return further(await look(phone), left - 1, found?.button.y);
  };
  const direct = here(first);
  if (direct) return direct;
  await decide("scrolling the list at the side of the town map", { for: titles });
  for (const _ of [1, 2, 3]) {
    await phone.drag({ x: 120, y: 330 }, { x: 120, y: 520 }, 0.6);
    await sleep(700);
  }
  return further(await look(phone), scrolls);
};

export const tapUntil = async (
  phone: Phone,
  spots: Point[],
  done: (seen: Seen) => boolean,
  waitMs = 2000,
): Promise<Seen | undefined> => {
  for (const spot of spots) {
    await phone.tap(spot);
    await sleep(waitMs);
    const seen = await look(phone);
    if (done(seen)) return seen;
  }
  return undefined;
};

export const secondsLeft = (text: string) => {
  const m = text.match(/(?:(\d+)d\s*)?(\d{1,2}):(\d\d):(\d\d)/);
  return m ? Number(m[1] ?? 0) * 86400 + Number(m[2]) * 3600 + Number(m[3]) * 60 + Number(m[4]) : undefined;
};
