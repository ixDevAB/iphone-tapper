import type { TextLine } from "./ocr.ts";
import type { Phone } from "./phone.ts";
import { backArrow, center, has } from "./screen.ts";
import { sleep } from "./time.ts";

export const neverAttack = /gilded\s*baron|rebel\s*bounty/i;

export const atTown = (lines: TextLine[]) => has(lines, /^Town$/i);

export const onWorld = (lines: TextLine[]) => atTown(lines) || has(lines, /^Conquest$/i);

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

export const goHome = async (phone: Phone, tries: number): Promise<boolean> => {
  const lines = await phone.ocrPng(await phone.snap());
  if (atTown(lines)) return true;
  if (tries <= 0) return false;
  await phone.tap(backArrow);
  await sleep(1500);
  return goHome(phone, tries - 1);
};
