import { clock } from "../../src/clock.ts";
import { difference, type Image, loadImage } from "../../src/image.ts";
import type { Phone } from "../../src/phone.ts";
import type { Recipe } from "../../src/recipes.ts";
import { sleep } from "../../src/wda.ts";

const screenWidth = 1206;
const healButton = { x: 267, y: 643 };
const cancelButton = { x: 75, y: 659 };
const confirmButton = { x: 285, y: 535 };
const infantryBox = { x: 302, y: 362 };
const otherBoxes = [{ x: 302, y: 441 }, { x: 302, y: 523 }];

const ref = (file: string, x: number, y: number) => ({ img: loadImage(new URL(file, import.meta.url)), x, y });
const refs = {
  heal: ref("heal.png", 786, 1919),
  help: ref("help.png", 790, 1935),
  cancel: ref("cancel.png", 150, 1925),
  confirm: ref("confirm.png", 745, 1570),
};
const tiers = [
  { name: "XI", ref: ref("tier-xi.png", 203, 1098), setting: "TROOPS_PER_ALLY_XI", troops: 60 },
  { name: "X", ref: ref("tier-x.png", 203, 1098), setting: "TROOPS_PER_ALLY_X", troops: 140 },
];


const shows = (screen: Image, r: { img: Image; x: number; y: number }) => difference(screen, r.img, r.x, r.y) < 12;

const visibleButton = (screen: Image) => shows(screen, refs.heal) ? "heal" : shows(screen, refs.help) ? "help" : undefined;

const typeInto = async (phone: Phone, box: { x: number; y: number }, troops: number) => {
  await phone.tap(box);
  await sleep(800);
  await phone.type([..."\b".repeat(6), ...String(troops), "\n"]);
  await sleep(800);
};

const setBatch = async (phone: Phone, troops: number) => {
  await typeInto(phone, infantryBox, troops);
  for (const box of otherBoxes) {
    await typeInto(phone, box, 0).catch(() => undefined);
  }
};

const waitFor = async (phone: Phone, r: { img: Image; x: number; y: number }, until: number): Promise<boolean> => {
  if (Date.now() > until) return false;
  if (shows(await phone.screenshot(), r)) return true;
  await sleep(300);
  return waitFor(phone, r, until);
};

const cancelHeal = async (phone: Phone) => {
  if (!(await waitFor(phone, refs.cancel, Date.now() + 2000))) return false;
  await phone.tap(cancelButton);
  if (!(await waitFor(phone, refs.confirm, Date.now() + 3000))) {
    throw new Error("the cancel healing popup did not show up, stopping to be safe");
  }
  await phone.tap(confirmButton);
  return waitFor(phone, refs.heal, Date.now() + 5000);
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
        await setBatch(phone, target);
        console.log(`${time()} batch set to ${target}`);
        return step({ ...s, batch: target, perAlly, idleSince: Date.now() });
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
        await sleep(settings.intervalMs);
        return step({ ...s, heals: s.heals + 1, healedAt: Date.now(), batchAllies, helpedAt: Date.now(), idleSince: Date.now() });
      }

      if (name === "help" && (!s.helpedAt || Date.now() - s.healedAt > 1500)) {
        await phone.tap(healButton);
        console.log(`${time()} help`);
        return step({ ...s, helpedAt: Date.now(), idleSince: Date.now() });
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
