import type { Phone } from "./phone.ts";
import { center } from "./screen.ts";
import { acted, type Action, fresh, said, sawScreen } from "./stuck.ts";

const file = new URL("../decisions.log", import.meta.url);
const context = { task: "" };
const keptHours = 7;

const stamp = (date: Date) => date.toLocaleString("sv-SE");

const now = () => stamp(new Date());

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
  const cutoff = stamp(new Date(Date.now() - keptHours * 60 * 60 * 1000));
  const lines = await Deno.readTextFile(file).then((all) => all.split("\n").filter((l) => l), () => []);
  const kept = lines.filter((l) => (l.match(/^\{"at":"([^"]+)"/)?.[1] ?? "") >= cutoff);
  if (kept.length < lines.length) await Deno.writeTextFile(file, kept.map((l) => `${l}\n`).join(""));
};

export const traced = (phone: Phone, repeats: (task: string) => number | undefined = () => undefined): Phone => {
  const state = { watch: fresh };
  const check = async (action: Action) => {
    state.watch = acted(state.watch, action);
    if (state.watch.repeats <= (repeats(context.task) ?? 40)) return;
    const why = said(action, state.watch.repeats);
    state.watch = fresh;
    await decide("stuck", { why });
    throw new Error(why);
  };
  return {
    ...phone,
    tap: async (point) => {
      await decide("tapped", { x: Math.round(point.x), y: Math.round(point.y) });
      await check({ kind: "tapped", at: [point.x, point.y] });
      return phone.tap(point);
    },
    drag: async (from, to, seconds) => {
      await decide("dragged", { from, to });
      await check({ kind: "dragged", at: [from.x, from.y, to.x, to.y] });
      return phone.drag(from, to, seconds);
    },
    slide: async (from, to, seconds) => {
      await decide("slid", { from, to });
      await check({ kind: "slid", at: [from.x, from.y, to.x, to.y] });
      return phone.slide(from, to, seconds);
    },
    type: async (keys) => {
      await decide("typed", { keys: keys.join("") });
      return phone.type(keys);
    },
    ocrPng: async (png) => {
      const lines = await phone.ocrPng(png);
      await decide("read the screen", { texts: lines.map((l) => `${l.text.trim()} @${center(l).x},${center(l).y}`) });
      state.watch = sawScreen(state.watch, lines.map((l) => l.text));
      return lines;
    },
    ocr: async (img) => {
      const lines = await phone.ocr(img);
      await decide("read a part", { texts: lines.map((l) => l.text.trim()) });
      return lines;
    },
  };
};
