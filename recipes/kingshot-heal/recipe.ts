import { brightText, crop, difference, type Image, loadImage } from "../../src/image.ts";
import type { Phone } from "../../src/phone.ts";
import type { Recipe } from "../../src/recipes.ts";
import { sleep } from "../../src/wda.ts";

const screenWidth = 1206;
const healButton = { x: 267, y: 643 };
const infantryBox = { x: 302, y: 362 };
const infantryBoxRegion = { x: 810, y: 1030, width: 210, height: 90 };
const bannerRegion = { x: 0, y: 830, width: 1206, height: 120 };
const buttons = [
  { name: "heal", img: loadImage(new URL("heal.png", import.meta.url)), x: 786, y: 1919 },
  { name: "help", img: loadImage(new URL("help.png", import.meta.url)), x: 790, y: 1935 },
];

const time = () => new Date().toLocaleTimeString();

const visibleButton = (screen: Image) => buttons.find((b) => difference(screen, b.img, b.x, b.y) < 12)?.name;

const readNumber = async (phone: Phone, screen: Image) =>
  Number((await phone.ocr(crop(screen, infantryBoxRegion))).map((l) => l.text).join("").replace(/\D/g, ""));

const setBatch = async (phone: Phone, troops: number) => {
  await phone.tap(infantryBox);
  await sleep(800);
  await phone.type([..."\b".repeat(6), ...String(troops), "\n"]);
  await sleep(800);
  return readNumber(phone, await phone.screenshot());
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
  description: "Kingshot: presses Heal, then Help, and grows the batch with every ally that helps. Never presses Speed Up or Finish.",
  run: async (phone, settings) => {
    const perAlly = Number(settings.env.TROOPS_PER_ALLY || 60);
    const allyTimeoutMs = Number(settings.env.ALLY_TIMEOUT_SECONDS || 30) * 1000;

    const first = await phone.screenshot();
    if (first.width !== screenWidth) throw new Error(`this recipe only works on an iPhone 17 Pro`);

    type State = { heals: number; batch: number; allies: number; helpedAt?: number; idleSince: number };

    const step = async (s: State): Promise<string> => {
      if (Date.now() - s.idleSince > settings.maxIdleMs) return `nothing to press for ${settings.maxIdleMs / 1000}s`;
      if (s.helpedAt && Date.now() - s.helpedAt > allyTimeoutMs) {
        return `allies stopped helping, heal did not finish within ${allyTimeoutMs / 1000}s`;
      }
      const screen = await phone.screenshot();
      const name = visibleButton(screen);
      const target = s.allies * perAlly;

      if (name === "heal" && s.batch !== target) {
        const batch = await setBatch(phone, target);
        console.log(`${time()} batch set to ${batch}${batch === target ? "" : ` (wanted ${target})`}`);
        return step({ ...s, batch: batch || s.batch, helpedAt: undefined, idleSince: Date.now() });
      }

      if (name === "heal") {
        await phone.tap(healButton);
        console.log(`${time()} heal ${s.heals + 1} (${s.batch} troops)`);
        await sleep(settings.intervalMs);
        return step({ ...s, heals: s.heals + 1, helpedAt: undefined, idleSince: Date.now() });
      }

      if (name === "help" && !s.helpedAt) {
        await phone.tap(healButton);
        const allies = await watchForAllies(phone, Date.now() + 3000);
        console.log(`${time()} help${allies ? `, ${allies} ${allies === 1 ? "ally" : "allies"} helped` : ""}`);
        return step({ ...s, allies: allies ?? s.allies, helpedAt: Date.now(), idleSince: Date.now() });
      }

      await sleep(1000);
      return step(s);
    };

    const reason = await step({ heals: 0, batch: 0, allies: 1, idleSince: Date.now() });
    console.log(`stopped: ${reason}`);
  },
};
