import { brightText, crop, difference, type Image, loadImage } from "../../src/image.ts";
import type { Phone } from "../../src/phone.ts";
import type { Recipe } from "../../src/recipes.ts";
import { sleep } from "../../src/wda.ts";

const screenWidth = 1206;
const healButton = { x: 267, y: 643 };
const cancelButton = { x: 75, y: 659 };
const confirmButton = { x: 285, y: 535 };
const infantryBox = { x: 302, y: 362 };
const infantryBoxRegion = { x: 810, y: 1030, width: 210, height: 90 };
const bannerRegion = { x: 0, y: 830, width: 1206, height: 120 };

const ref = (file: string, x: number, y: number) => ({ img: loadImage(new URL(file, import.meta.url)), x, y });
const refs = {
  heal: ref("heal.png", 786, 1919),
  help: ref("help.png", 790, 1935),
  cancel: ref("cancel.png", 150, 1925),
  confirm: ref("confirm.png", 745, 1570),
};

const time = () => new Date().toLocaleTimeString();

const shows = (screen: Image, r: { img: Image; x: number; y: number }) => difference(screen, r.img, r.x, r.y) < 12;

const visibleButton = (screen: Image) => shows(screen, refs.heal) ? "heal" : shows(screen, refs.help) ? "help" : undefined;

const readNumber = async (phone: Phone, screen: Image) =>
  Number((await phone.ocr(crop(screen, infantryBoxRegion))).map((l) => l.text).join("").replace(/\D/g, ""));

const setBatch = async (phone: Phone, troops: number) => {
  await phone.tap(infantryBox);
  await sleep(800);
  await phone.type([..."\b".repeat(6), ...String(troops), "\n"]);
  await sleep(800);
  return readNumber(phone, await phone.screenshot());
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

const alliesIn = async (phone: Phone, screen: Image) => {
  const banner = crop(screen, bannerRegion);
  const reads = await Promise.all(
    [banner, brightText(banner, 190, 18), brightText(banner, 180, 22)].map(async (img) =>
      (await phone.ocr(img)).map((l) => l.text).join(" ")
    ),
  );
  const helped = reads.some((t) => /help(ed|cd|ad)/i.test(t));
  const counts = reads.flatMap((t) => t.match(/(\d+)\s*All/)?.[1] ?? []).map(Number).filter((n) => n > 0 && n < 100);
  const best = counts.sort((a, b) => counts.filter((c) => c === b).length - counts.filter((c) => c === a).length)[0];
  return best ?? (helped && reads.some((t) => /Ally has/i.test(t)) ? 1 : undefined);
};

const watchForAllies = async (phone: Phone, until: number): Promise<number | undefined> => {
  if (Date.now() > until) return undefined;
  const allies = await alliesIn(phone, await phone.screenshot());
  return allies ?? watchForAllies(phone, until);
};

export const kingshotHeal: Recipe = {
  description:
    "Kingshot: presses Heal, then Help, sizes every batch to the allies helping, and cancels a heal they cannot finish. Never presses Speed Up or Finish.",
  run: async (phone, settings) => {
    const perAlly = Number(settings.env.TROOPS_PER_ALLY || 60);
    const allyTimeoutMs = Number(settings.env.ALLY_TIMEOUT_SECONDS || 240) * 1000;
    const cancelAfterMs = Number(settings.env.CANCEL_AFTER_SECONDS || 10) * 1000;
    const checkEvery = Number(settings.env.CHECK_ALLIES_EVERY || 10);

    const first = await phone.screenshot();
    if (first.width !== screenWidth) throw new Error(`this recipe only works on an iPhone 17 Pro`);

    type State = {
      heals: number;
      batch: number;
      allies: number;
      batchAllies: number;
      helpedAt?: number;
      helpAllies?: number;
      idleSince: number;
    };

    const step = async (previous: State): Promise<string> => {
      const screen = await phone.screenshot();
      const name = visibleButton(screen);
      const checkRound = previous.heals % checkEvery === 0;
      const seen = name === "heal" && checkRound ? await alliesIn(phone, screen) : undefined;
      if (seen && seen !== previous.allies) console.log(`${time()} ${seen} allies helped`);
      const s = seen ? { ...previous, allies: seen } : previous;

      if (Date.now() - s.idleSince > settings.maxIdleMs) return `nothing to press for ${settings.maxIdleMs / 1000}s`;

      const waited = s.helpedAt && name !== "heal" ? Date.now() - s.helpedAt : 0;

      if (s.batchAllies > 1 && waited > cancelAfterMs) {
        const allies = s.helpAllies && s.helpAllies < s.batchAllies ? s.helpAllies : s.batchAllies - 1;
        console.log(`${time()} heal was sized for ${s.batchAllies} allies but did not finish, cancelling`);
        const cancelled = await cancelHeal(phone);
        if (cancelled) console.log(`${time()} cancelled, starting over for ${allies} ${allies === 1 ? "ally" : "allies"}`);
        return step({ ...s, allies, helpedAt: undefined, helpAllies: undefined, idleSince: Date.now() });
      }

      if (waited > allyTimeoutMs) return `allies stopped helping, heal did not finish within ${allyTimeoutMs / 1000}s`;

      const target = s.allies * perAlly;

      if (name === "heal" && s.batch !== target) {
        const batch = await setBatch(phone, target);
        console.log(`${time()} batch set to ${batch}${batch === target ? "" : ` (wanted ${target})`}`);
        return step({ ...s, batch: batch || s.batch, idleSince: Date.now() });
      }

      if (name === "heal") {
        await phone.tap(healButton);
        const batchAllies = Math.max(1, Math.round(s.batch / perAlly));
        console.log(`${time()} heal ${s.heals + 1} (${s.batch} troops for ${batchAllies} ${batchAllies === 1 ? "ally" : "allies"})`);
        await sleep(settings.intervalMs);
        return step({ ...s, heals: s.heals + 1, batchAllies, helpedAt: undefined, helpAllies: undefined, idleSince: Date.now() });
      }

      if (name === "help" && !s.helpedAt) {
        await phone.tap(healButton);
        const allies = s.heals % checkEvery === 1 || checkEvery === 1
          ? await watchForAllies(phone, Date.now() + 3000)
          : undefined;
        console.log(`${time()} help${allies ? `, ${allies} ${allies === 1 ? "ally" : "allies"} helped` : ""}`);
        return step({
          ...s,
          allies: allies ?? s.allies,
          helpAllies: allies,
          helpedAt: Date.now(),
          idleSince: Date.now(),
        });
      }

      await sleep(1000);
      return step(s);
    };

    const startBatch = visibleButton(first) === "heal" ? await readNumber(phone, first) : 0;
    const startAllies = Math.max(1, Math.round(startBatch / perAlly));
    if (startBatch) console.log(`${time()} box shows ${startBatch}, continuing for ${startAllies} ${startAllies === 1 ? "ally" : "allies"}`);
    const reason = await step({
      heals: 0,
      batch: startBatch,
      allies: startAllies,
      batchAllies: startAllies,
      idleSince: Date.now(),
    });
    console.log(`stopped: ${reason}`);
  },
};
