import { changes, decide } from "./decisions.ts";
import { fromPng, type Image, type Point } from "./image.ts";
import type { TextLine } from "./ocr.ts";
import type { Phone } from "./phone.ts";
import type { Rewards } from "./rewards.ts";
import { center, exact, matching, saveShot, screenWidth } from "./screen.ts";
import { sleep } from "./time.ts";

export type Seen = { png: Uint8Array; lines: TextLine[]; img: () => Image };

export type Next<S> = Promise<S | string | undefined>;

export type Flow<S> = {
  name: string;
  lostMs: number;
  start: S;
  screen: (s: S, seen: Seen) => Next<S>;
  lost?: (s: S) => string;
  rewards?: Rewards;
};

export const look = async (phone: Phone): Promise<Seen> => {
  const png = await phone.snap();
  const lines = await phone.ocrPng(png);
  const cache: { img?: Image } = {};
  return { png, lines, img: () => cache.img ??= fromPng(png) };
};

export const requireIphone = async (phone: Phone) => {
  const first = await phone.screenshot();
  if (first.width !== screenWidth) throw new Error("this recipe only works on an iPhone 17 Pro");
  return first;
};

export const press = async (phone: Phone, line: TextLine) => {
  await phone.tap(center(line));
  await sleep(1500);
};

export const exitLine = (lines: TextLine[]) => matching(lines, /tap anywhere to exit/i);

export const leaveRewards = async (phone: Phone, lines: TextLine[], rewards?: Rewards, fight = false) => {
  const exit = exitLine(lines);
  if (!exit) return false;
  if (rewards && exact(lines, "Rewards").length) await rewards.count(fight);
  await press(phone, exit);
  return true;
};

export const openFromWorld = async <S extends { opens: number; leaving: boolean }>(
  phone: Phone,
  s: S,
  button: Point,
  waitMs: number,
  done: string,
  failed: string,
): Promise<S | string> => {
  if (s.leaving) return done;
  if (s.opens >= 4) throw new Error(failed);
  await phone.tap(button);
  await sleep(waitMs);
  return { ...s, opens: s.opens + 1 };
};

export const runFlow = async <S extends object>(phone: Phone, flow: Flow<S>) => {
  await requireIphone(phone);

  const step = async (s: S, knownAt: number): Promise<string> => {
    const seen = await look(phone);
    const next = await flow.screen(s, seen);
    if (typeof next === "string") {
      await decide("finished", { reason: next });
      return next;
    }
    if (next !== undefined) {
      await decide("knew the screen", { changed: changes(s, next) });
      return step(next, Date.now());
    }
    await decide("did not know the screen, waiting");
    if (Date.now() - knownAt > flow.lostMs) {
      await saveShot(`${flow.name}-lost.png`, seen.png);
      const rest = flow.lost ? `, ${flow.lost(s)}` : "";
      await decide("gave up", {
        why: "no screen it knows",
        picture: `build/${flow.name}-lost.png`,
        read: seen.lines.map((l) => l.text).slice(0, 30),
      });
      throw new Error(`did not recognise the screen, see build/${flow.name}-lost.png${rest}`);
    }
    await sleep(1000);
    return step(s, knownAt);
  };

  try {
    const reason = await step(flow.start, Date.now());
    console.log(`stopped: ${reason}`);
    return reason;
  } finally {
    flow.rewards?.print();
  }
};
