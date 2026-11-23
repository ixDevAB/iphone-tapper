import { decide } from "./decisions.ts";
import type { TextLine } from "./ocr.ts";
import type { Phone } from "./phone.ts";
import { backArrow, center, closeDialog, exact, has } from "./screen.ts";
import { sleep } from "./time.ts";

export const neverAttack = /gilded\s*baron|rebel\s*bounty/i;

export const mapButton = { x: 361, y: 825 };

const inBar = (lines: TextLine[], text: string) => exact(lines, text).some((l) => center(l).y > 820);

export const onTownMap = (lines: TextLine[]) => inBar(lines, "World");

export const onWorldMap = (lines: TextLine[]) => inBar(lines, "Town") && !exact(lines, "My Island").length;

export const atTown = onWorldMap;

export const onWorld = (lines: TextLine[]) =>
  onWorldMap(lines) || (has(lines, /^Conquest$/i) && !onTownMap(lines) && !exact(lines, "My Island").length);

export const marchesOn = (lines: TextLine[]) => {
  const m = lines
    .map((l) =>
      center(l).y > 160 && center(l).y < 190 && center(l).x < 260
        ? l.text.match(/(?:^|\s)(\d)\s*\/\s*(\d)(?!\d)/)
        : null
    )
    .find((x) => x);
  return m ? { used: Number(m[1]), total: Number(m[2]) } : undefined;
};

const look = (lines: TextLine[]) => lines.map((l) => l.text.replace(/\d/g, "")).join("|");

export const goHome = async (phone: Phone, tries: number, last = ""): Promise<boolean> => {
  const lines = await phone.ocrPng(await phone.snap());
  if (onWorldMap(lines)) return true;
  if (tries <= 0) return false;
  if (onTownMap(lines)) {
    await decide("on the town map, going to the world map");
    await phone.tap(mapButton);
    await sleep(3000);
    return goHome(phone, tries - 1);
  }
  const seen = look(lines);
  const stuck = seen === last;
  await decide(stuck ? "the back arrow changed nothing, pressing the close cross" : "going back a screen");
  await phone.tap(stuck ? closeDialog : backArrow);
  await sleep(1500);
  return goHome(phone, tries - 1, stuck ? "" : seen);
};
