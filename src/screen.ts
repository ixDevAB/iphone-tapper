import { type Image, toPng } from "./image.ts";
import type { TextLine } from "./ocr.ts";

export const scale = 3;
export const points = { width: 402, height: 874 };
export const screenWidth = points.width * scale;

export const backArrow = { x: 30, y: 77 };
export const closeDialog = { x: 373, y: 175 };

export const center = (l: TextLine) => ({
  x: Math.round((l.x + l.width / 2) * points.width),
  y: Math.round((l.y + l.height / 2) * points.height),
});
export const exact = (lines: TextLine[], text: string) =>
  lines.filter((l) => l.text.trim().toLowerCase() === text.toLowerCase());
export const has = (lines: TextLine[], pattern: RegExp) => lines.some((l) => pattern.test(l.text));
export const matching = (lines: TextLine[], pattern: RegExp) => lines.find((l) => pattern.test(l.text));

const buildDir = new URL("../build/", import.meta.url);

export const saveShot = (name: string, shot: Uint8Array | Image) =>
  Deno.mkdir(buildDir, { recursive: true })
    .then(() => Deno.writeFile(new URL(name, buildDir), shot instanceof Uint8Array ? shot : toPng(shot)))
    .catch(() => undefined);

export const like = (text: string, whole = false) => {
  const body = text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/[il1]/gi, "[il1|]").replace(/ /g, "\\s*");
  return new RegExp(whole ? `^\\s*${body}\\s*$` : body, "i");
};
