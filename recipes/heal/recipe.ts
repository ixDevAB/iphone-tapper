import { requireIphone } from "../../src/flow.ts";
import type { Image } from "../../src/image.ts";
import type { Phone } from "../../src/phone.ts";
import { on, type Recipe } from "../../src/recipe.ts";
import { center, exact, has, saveShot } from "../../src/screen.ts";
import { clock, sleep } from "../../src/time.ts";
import type { TextLine } from "../../src/ocr.ts";
import { atTown, goHome } from "../../src/world.ts";
import { alliesFrom, amountIn, cancelHeal, healButton, refs, setBatch, shows, tiers } from "./window.ts";

const visibleButton = (screen: Image) =>
  shows(screen, refs.heal) ? "heal" : shows(screen, refs.help) ? "help" : undefined;

const setAndRead = async (phone: Phone, troops: number, tries: number): Promise<number | undefined> => {
  await setBatch(phone, troops, tries <= 1 ? "batch-keyboard.png" : undefined);
  const screen = await phone.screenshot();
  const shown = amountIn(await phone.ocr(screen));
  if (shown === troops || shown === undefined) return shown;
  if (tries > 1) return setAndRead(phone, troops, tries - 1);
  await saveShot("batch-not-set.png", screen);
  return shown;
};

const alliesIn = async (phone: Phone, screen: Image) => alliesFrom(await phone.ocr(screen));

const watchForAllies = async (phone: Phone, until: number): Promise<number | undefined> => {
  if (Date.now() > until) return undefined;
  const allies = await alliesIn(phone, await phone.screenshot());
  return allies ?? watchForAllies(phone, until);
};

const injuredButton = (lines: TextLine[]) =>
  lines.find((l) => /^\d+%$/.test(l.text.trim()) && center(l).x > 250 && center(l).y > 650 && center(l).y < 790);

const healOnce = async (phone: Phone, log: (text: string) => void) => {
  const opened = async (tries: number): Promise<Image | undefined> => {
    const screen = await phone.screenshot();
    if (visibleButton(screen)) return screen;
    const lines = await phone.ocr(screen);
    const injured = injuredButton(lines);
    if (tries <= 0 || !injured || !atTown(lines)) return undefined;
    await phone.tap({ x: center(injured).x, y: center(injured).y - 19 });
    await sleep(1500);
    return opened(tries - 1);
  };
  const screen = await opened(2);
  if (!screen) {
    log("no injured troops button on the world map, nothing to heal");
    return;
  }
  if (visibleButton(screen) === "help") {
    await phone.tap(healButton);
    log("a heal is already running, pressed Help");
  } else {
    await phone.tap(healButton);
    await sleep(700);
    const helping = shows(await phone.screenshot(), refs.help);
    if (helping) await phone.tap(healButton);
    log(`pressed Heal for the troops the window had selected${helping ? ", then Help" : ""}`);
  }
  await sleep(800);
  await goHome(phone, 4);
};

export const heal: Recipe = {
  description:
    "Presses Heal, then Help, grows the batch while allies finish every heal, and cancels a heal they cannot finish. With --all it opens the Heal Injured window, presses Heal once for what the window has selected, presses Help and leaves. Never presses Speed Up or Finish.",
  flags: { "--allies": "START_ALLIES", "-a": "START_ALLIES" },
  switches: { "--all": "HEAL_ALL" },
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
    const helpDelayMs = Number(settings.env.HELP_DELAY_MS ?? 100);
    const holdMs = Number(settings.env.HOLD_AFTER_CANCEL_SECONDS || 300) * 1000;

    await requireIphone(phone);
    if (on(settings.env, "HEAL_ALL")) return healOnce(phone, (text) => console.log(`${time()} ${text}`));

    const progress: { left?: number; at: number } = { at: Date.now() };

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
      openedAt?: number;
    };

    const step = async (previous: State): Promise<string> => {
      const screen = await phone.screenshot();
      const name = visibleButton(screen);
      const justFinished = name === "heal" && previous.helpedAt !== undefined;
      const fast = justFinished && Date.now() - (previous.helpedAt ?? 0) < fastMs;
      const finished = fast ? previous.finished + 1 : justFinished ? 0 : previous.finished;
      const grow = finished >= growAfter && Date.now() >= previous.holdUntil && previous.allies < maxAllies;
      if (grow) {
        console.log(`${time()} ${growAfter} heals in a row finished fast, trying ${previous.allies + 1} allies`);
      }
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
        if (cancelled) {
          console.log(`${time()} cancelled, starting over for ${allies} ${allies === 1 ? "ally" : "allies"}`);
        }
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
      const tier = name === "heal" ? tiers.find((t) => shows(screen, t.ref))?.name : undefined;
      const kind = tier ? `${tier} troops` : "troops";

      if (name === "heal" && s.batch !== target) {
        const shown = await setAndRead(phone, target, 2);
        if (shown === undefined || shown === target) {
          console.log(`${time()} batch set to ${target} ${kind}${shown ? "" : " (could not read it back)"}`);
          return step({ ...s, batch: target, perAlly, idleSince: Date.now() });
        }
        const allies = Math.max(1, Math.floor(shown / perAlly));
        console.log(
          `${time()} could not set the batch to ${target} ${kind}, the box shows ${shown}, continuing for ${allies} ${
            allies === 1 ? "ally" : "allies"
          } (screenshots in build/)`,
        );
        return step({
          ...s,
          allies,
          batch: allies * perAlly,
          perAlly,
          holdUntil: Date.now() + holdMs,
          finished: 0,
          idleSince: Date.now(),
        });
      }

      if (name === "heal" && Date.now() - s.healedAt < 500) {
        await sleep(200);
        return step(s);
      }

      if (name === "heal") {
        await phone.tap(healButton);
        await sleep(helpDelayMs);
        await phone.tap(healButton);
        const batchAllies = Math.max(1, Math.round(s.batch / perAlly));
        console.log(
          `${time()} heal ${s.heals + 1} + help (${s.batch} ${kind} for ${batchAllies} ${
            batchAllies === 1 ? "ally" : "allies"
          })`,
        );
        const helpedAt = Date.now();
        const seen = s.heals === 0 || (s.heals + 1) % checkEvery === 0
          ? await watchForAllies(phone, Date.now() + 3000)
          : undefined;
        const holding = Date.now() < s.holdUntil;
        const allies = seen && seen <= maxAllies && !(holding && seen > s.allies) ? seen : s.allies;
        if (seen) {
          console.log(
            `${time()} ${seen} ${seen === 1 ? "ally" : "allies"} helped${
              allies === seen ? "" : ", holding after a cancel"
            }`,
          );
        }
        if (s.heals === 0 || (s.heals + 1) % checkEvery === 0) {
          const text = (await phone.ocr(await phone.screenshot())).map((l) => l.text).join(" ");
          const injured = text.match(/(\d{1,3}(?:[,. ]\d{3})*)\s*\/\s*(\d{1,3}(?:[,. ]\d{3})+)/);
          const count = injured ? Number(injured[1].replace(/\D/g, "")) : undefined;
          const capacity = injured ? Number(injured[2].replace(/\D/g, "")) : 0;
          const jumped = count !== undefined && progress.left !== undefined &&
            progress.left - count > progress.left * 0.5 && progress.left > 5000;
          const now = count !== undefined && count <= capacity && !jumped ? count : undefined;
          if (now !== undefined) {
            const healed = progress.left !== undefined ? progress.left - now : 0;
            const minutes = healed > 0 ? Math.round(now / (healed / ((Date.now() - progress.at) / 60000))) : undefined;
            const eta = minutes === undefined
              ? ""
              : `, about ${
                minutes >= 60 ? `${Math.floor(minutes / 60)}h ${minutes % 60}m` : `${minutes}m`
              } at this pace`;
            console.log(`${time()} ${now.toLocaleString("en-US")} injured troops left${eta}`);
            progress.left = now;
            progress.at = Date.now();
          }
        }
        await sleep(settings.intervalMs);
        return step({
          ...s,
          allies,
          finished: seen ? 0 : s.finished,
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

      if (!name && !s.helpedAt && Date.now() - (s.openedAt ?? 0) > 5000) {
        const lines = await phone.ocr(screen);
        const done = exact(lines, "Done").find((l) => center(l).x > 300 && center(l).y > 400 && center(l).y < 560);
        if (done && has(lines, /^Heal Injured$/i)) {
          console.log(`${time()} the keyboard is still open, pressing Done`);
          await phone.tap(center(done));
          await sleep(1200);
          return step({ ...s, openedAt: Date.now() });
        }
        const injured = injuredButton(lines);
        if (injured && atTown(lines)) {
          console.log(`${time()} opening the Heal Injured window`);
          await phone.tap({ x: center(injured).x, y: center(injured).y - 19 });
          await sleep(1500);
          return step({ ...s, openedAt: Date.now() });
        }
        if (s.toldAt === s.idleSince) return step({ ...s, openedAt: Date.now() });
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
