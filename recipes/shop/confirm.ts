import type { TextLine } from "../../src/ocr.ts";
import { center, has } from "../../src/screen.ts";

const amount = (text: string) => /^[\d,]+$/.test(text.trim()) ? Number(text.replace(/,/g, "")) : undefined;

export const priceIn = (texts: string[]) => texts.map(amount).find((n) => n !== undefined);

export const priceNear = (lines: TextLine[], spot: { x: number; y: number }) =>
  lines
    .filter((l) => Math.abs(center(l).y - spot.y) < 15 && Math.abs(center(l).x - spot.x) < 60)
    .map((l) => amount(l.text))
    .find((n) => n !== undefined);

export const gemConfirm = (lines: TextLine[]) => {
  const asked = lines
    .map((line) => ({ line, found: line.text.match(/spend\s*([\d,]+)\s*gems/i) }))
    .find((l) => l.found);
  if (!asked?.found || !has(lines, /^Purchase$/i)) return undefined;
  const gems = Number(asked.found[1].replace(/,/g, ""));
  const button = lines.find((l) => amount(l.text) === gems && center(l).y > center(asked.line).y + 60);
  return { gems, button };
};

export const maySpend = (confirm: { gems: number; button?: TextLine }, agreed: (number | undefined)[]) =>
  confirm.button !== undefined && agreed.length > 0 && agreed.every((n) => n === confirm.gems);
