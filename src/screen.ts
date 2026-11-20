import type { TextLine } from "./ocr.ts";

export const screenWidth = 1206;
const points = { width: 402, height: 874 };

export const center = (l: TextLine) => ({ x: Math.round((l.x + l.width / 2) * points.width), y: Math.round((l.y + l.height / 2) * points.height) });
export const exact = (lines: TextLine[], text: string) => lines.filter((l) => l.text.trim().toLowerCase() === text.toLowerCase());
export const has = (lines: TextLine[], pattern: RegExp) => lines.some((l) => pattern.test(l.text));
export const matching = (lines: TextLine[], pattern: RegExp) => lines.find((l) => pattern.test(l.text));
