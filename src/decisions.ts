import type { Phone } from "./phone.ts";
import { center } from "./screen.ts";

const file = new URL("../decisions.log", import.meta.url);
const older = new URL("../decisions.1.log", import.meta.url);
const context = { task: "" };
const largest = 20_000_000;

const now = () => new Date().toLocaleString("sv-SE");

const plain = (_key: string, value: unknown) => ArrayBuffer.isView(value) ? "[bytes]" : value;

const text = (value: unknown) => JSON.stringify(value, plain);

export const during = (task: string) => {
  const outer = context.task;
  context.task = task;
  return outer;
};

export const decide = (decision: string, details: Record<string, unknown> = {}) =>
  Deno.writeTextFile(file, `${text({ at: now(), task: context.task, decision, ...details })}\n`, { append: true })
    .catch(() => undefined);

export const changes = (before: object, after: object) =>
  Object.fromEntries(
    Object.entries(after).filter(([key, value]) => text(value) !== text((before as Record<string, unknown>)[key])),
  );

export const rotate = async () => {
  const size = await Deno.stat(file).then((s) => s.size, () => 0);
  if (size > largest) await Deno.rename(file, older).catch(() => undefined);
};

export const traced = (phone: Phone): Phone => ({
  ...phone,
  tap: async (point) => {
    await decide("tapped", { x: Math.round(point.x), y: Math.round(point.y) });
    return phone.tap(point);
  },
  drag: async (from, to, seconds) => {
    await decide("dragged", { from, to });
    return phone.drag(from, to, seconds);
  },
  type: async (keys) => {
    await decide("typed", { keys: keys.join("") });
    return phone.type(keys);
  },
  ocrPng: async (png) => {
    const lines = await phone.ocrPng(png);
    await decide("read the screen", { texts: lines.map((l) => `${l.text.trim()} @${center(l).x},${center(l).y}`) });
    return lines;
  },
  ocr: async (img) => {
    const lines = await phone.ocr(img);
    await decide("read a part", { texts: lines.map((l) => l.text.trim()) });
    return lines;
  },
});
