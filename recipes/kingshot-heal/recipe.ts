import { clock } from "../../src/clock.ts";
import { difference, type Image, loadImage, toPng } from "../../src/image.ts";
import type { TextLine } from "../../src/ocr.ts";
import type { Phone } from "../../src/phone.ts";
import type { Recipe } from "../../src/recipes.ts";
import { sleep } from "../../src/wda.ts";

export const screenWidth = 1206;
export const healButton = { x: 267, y: 643 };
const cancelButton = { x: 75, y: 659 };
const confirmButton = { x: 285, y: 535 };
export const infantryBox = { x: 302, y: 362 };
const otherBoxes = [{ x: 302, y: 441 }, { x: 302, y: 523 }];

const ref = (file: string, x: number, y: number) => ({ img: loadImage(new URL(file, import.meta.url)), x, y });
export const refs = {
  heal: ref("heal.png", 786, 1919),
  help: ref("help.png", 790, 1935),
  cancel: ref("cancel.png", 150, 1925),
  confirm: ref("confirm.png", 745, 1570),
};
export const tiers = [
  { name: "XI", ref: ref("tier-xi.png", 203, 1098), setting: "TROOPS_PER_ALLY_XI", troops: 60 },
  { name: "X", ref: ref("tier-x.png", 203, 1098), setting: "TROOPS_PER_ALLY_X", troops: 140 },
];


export const shows = (screen: Image, r: { img: Image; x: number; y: number }) => difference(screen, r.img, r.x, r.y) < 12;

const visibleButton = (screen: Image) => shows(screen, refs.heal) ? "heal" : shows(screen, refs.help) ? "help" : undefined;

const buildDir = new URL("../../build/", import.meta.url);
export const saveShot = (name: string, img: Image) => Deno.writeFile(new URL(name, buildDir), toPng(img)).catch(() => undefined);

export const amountIn = (lines: TextLine[], down = 0) => {
  const box = lines.find((l) => l.x > 0.65 && l.y > 0.39 + down && l.y < 0.43 + down && /^[\d,.\s]+$/.test(l.text));
  return box ? Number(box.text.replace(/\D/g, "")) : undefined;
};

export const typeInto = async (phone: Phone, box: { x: number; y: number }, troops: number, shot?: string) => {
  await phone.tap(box);
  await sleep(800);
  if (shot) await saveShot(shot, await phone.screenshot());
  await phone.type([..."\b".repeat(6), ...String(troops), "\n"]);
  await sleep(800);
};

export const setBatch = async (phone: Phone, troops: number, shot?: string) => {
  await typeInto(phone, infantryBox, troops, shot);
  for (const box of otherBoxes) {
    await typeInto(phone, box, 0).catch(() => undefined);
  }
};

export const waitFor = async (phone: Phone, r: { img: Image; x: number; y: number }, until: number): Promise<boolean> => {
  if (Date.now() > until) return false;
  if (shows(await phone.screenshot(), r)) return true;
  await sleep(300);
  return waitFor(phone, r, until);
};

const setAndRead = async (phone: Phone, troops: number, tries: number): Promise<number | undefined> => {
  await setBatch(phone, troops, tries <= 1 ? "batch-keyboard.png" : undefined);
  const screen = await phone.screenshot();
  const shown = amountIn(await phone.ocr(screen));
  if (shown === troops || shown === undefined) return shown;
  if (tries > 1) return setAndRead(phone, troops, tries - 1);
  await saveShot("batch-not-set.png", screen);
  return shown;
};

export const cancelHeal = async (phone: Phone) => {
  if (!(await waitFor(phone, refs.cancel, Date.now() + 2000))) return false;
  await phone.tap(cancelButton);
  if (!(await waitFor(phone, refs.confirm, Date.now() + 3000))) {
    throw new Error("the cancel healing popup did not show up, stopping to be safe");
  }
  await phone.tap(confirmButton);
  return waitFor(phone, refs.heal, Date.now() + 5000);
};

export const alliesFrom = (lines: { text: string }[]) => {
  const text = lines.map((l) => l.text).join(" ");
  const count = text.match(/(\d+)\s*All[a-z1]{2,4}\b/i)?.[1];
  return count ? Number(count) : /Ally has help/i.test(text) ? 1 : undefined;
};

const alliesIn = async (phone: Phone, screen: Image) => alliesFrom(await phone.ocr(screen));

const watchForAllies = async (phone: Phone, until: number): Promise<number | undefined> => {
  if (Date.now() > until) return undefined;
  const allies = await alliesIn(phone, await phone.screenshot());
  return allies ?? watchForAllies(phone, until);
};

export const kingshotHeal: Recipe = {
  description:
    "Kingshot: presses Heal, then Help, grows the batch while allies finish every heal, and cancels a heal they cannot finish. Never presses Speed Up or Finish.",
  run: async (phone, settings) => {
    const time = clock(settings.env.CLOCK);
    const fallbackPerAlly = Number(settings.env.TROOPS_PER_ALLY || 60);
    const perAllyOn = (screen: Image, last: number) => {
      const tier = tiers.find((t) => shows(screen, t.ref));
      return tier ? Number(settings.env[tier.setting] || tier.troops) : last;
    };
    const allyTimeoutMs = Number(settings.env.ALLY_TIMEOUT_SECONDS || 240) * 1000;
    const cancelAfterMs = Number(settings.env.CANCEL_AFTER_SECONDS || 10) * 1000;
    const growAfter = Number(settings.env.GROW_AFTER_ROUNDS || 10);
    const checkEvery = Number(settings.env.CHECK_ALLIES_EVERY || 10);
    const startAllies = Number(settings.env.START_ALLIES || 1);
    const fastMs = Number(settings.env.FAST_FINISH_SECONDS || 3) * 1000;
    const maxAllies = Number(settings.env.MAX_ALLIES || 20);
    const holdMs = Number(settings.env.HOLD_AFTER_CANCEL_SECONDS || 300) * 1000;

    const first = await phone.screenshot();
    if (first.width !== screenWidth) throw new Error(`this recipe only works on an iPhone 17 Pro`);

    type State = {
      heals: number;
      batch: number;
      allies: number;
      batchAllies: number;
      healedAt: number;
      helpedAt?: number;
      holdUntil: number;
      finished: number;
      perAlly: number;
      idleSince: number;
      toldAt?: number;
    };

    const step = async (previous: State): Promise<string> => {
      const screen = await phone.screenshot();
      const name = visibleButton(screen);
      const justFinished = name === "heal" && previous.helpedAt !== undefined;
      const fast = justFinished && Date.now() - (previous.helpedAt ?? 0) < fastMs;
      const finished = fast ? previous.finished + 1 : justFinished ? 0 : previous.finished;
      const grow = finished >= growAfter && Date.now() >= previous.holdUntil && previous.allies < maxAllies;
      if (grow) console.log(`${time()} ${growAfter} heals in a row finished fast, trying ${previous.allies + 1} allies`);
      const s = {
        ...previous,
        allies: grow ? previous.allies + 1 : previous.allies,
        finished: grow ? 0 : finished,
        helpedAt: justFinished ? undefined : previous.helpedAt,
      };

      if (Date.now() - s.idleSince > settings.maxIdleMs) return `nothing to press for ${settings.maxIdleMs / 1000}s`;

      const waited = s.helpedAt && name !== "heal" ? Date.now() - s.helpedAt : 0;

      if (s.batchAllies > 1 && waited > cancelAfterMs) {
        const allies = s.batchAllies - 1;
        console.log(`${time()} heal was sized for ${s.batchAllies} allies but did not finish, cancelling`);
        const cancelled = await cancelHeal(phone);
        if (cancelled) console.log(`${time()} cancelled, starting over for ${allies} ${allies === 1 ? "ally" : "allies"}`);
        return step({
          ...s,
          allies,
          helpedAt: undefined,
          holdUntil: Date.now() + holdMs,
          finished: 0,
          idleSince: Date.now(),
        });
      }

      if (waited > allyTimeoutMs) return `allies stopped helping, heal did not finish within ${allyTimeoutMs / 1000}s`;

      const perAlly = name === "heal" ? perAllyOn(screen, s.perAlly) : s.perAlly;
      const target = s.allies * perAlly;

      if (name === "heal" && s.batch !== target) {
        const shown = await setAndRead(phone, target, 2);
        if (shown === undefined || shown === target) {
          console.log(`${time()} batch set to ${target}${shown ? "" : " (could not read it back)"}`);
          return step({ ...s, batch: target, perAlly, idleSince: Date.now() });
        }
        const allies = Math.max(1, Math.floor(shown / perAlly));
        console.log(`${time()} could not set the batch to ${target}, the box shows ${shown}, continuing for ${allies} ${allies === 1 ? "ally" : "allies"} (screenshots in build/)`);
        return step({ ...s, allies, batch: allies * perAlly, perAlly, holdUntil: Date.now() + holdMs, finished: 0, idleSince: Date.now() });
      }

      if (name === "heal" && Date.now() - s.healedAt < 500) {
        await sleep(200);
        return step(s);
      }

      if (name === "heal") {
        await phone.tap(healButton);
        await sleep(400);
        await phone.tap(healButton);
        const batchAllies = Math.max(1, Math.round(s.batch / perAlly));
        console.log(`${time()} heal ${s.heals + 1} + help (${s.batch} troops for ${batchAllies} ${batchAllies === 1 ? "ally" : "allies"})`);
        const helpedAt = Date.now();
        const seen = s.heals === 0 || (s.heals + 1) % checkEvery === 0 ? await watchForAllies(phone, Date.now() + 3000) : undefined;
        const holding = Date.now() < s.holdUntil;
        const allies = seen && seen <= maxAllies && !(holding && seen > s.allies) ? seen : s.allies;
        if (seen) console.log(`${time()} ${seen} ${seen === 1 ? "ally" : "allies"} helped${allies === seen ? "" : ", holding after a cancel"}`);
        await sleep(settings.intervalMs);
        return step({
          ...s,
          allies,
          finished: allies === s.allies ? s.finished : 0,
          heals: s.heals + 1,
          healedAt: Date.now(),
          batchAllies,
          helpedAt,
          idleSince: Date.now(),
        });
      }

      if (name === "help" && (!s.helpedAt || Date.now() - s.healedAt > 1500)) {
        await phone.tap(healButton);
        console.log(`${time()} help`);
        return step({ ...s, helpedAt: Date.now(), idleSince: Date.now() });
      }

      if (!name && !s.helpedAt && s.toldAt !== s.idleSince && Date.now() - s.idleSince > 3000) {
        console.log(`${time()} no Heal or Help button on the screen, waiting for the Heal Injured window`);
        return step({ ...s, toldAt: s.idleSince });
      }

      await sleep(200);
      return step(s);
    };

    const reason = await step({
      heals: 0,
      batch: 0,
      allies: startAllies,
      batchAllies: startAllies,
      healedAt: 0,
      holdUntil: 0,
      finished: 0,
      perAlly: fallbackPerAlly,
      idleSince: Date.now(),
    });
    console.log(`stopped: ${reason}`);
  },
};
