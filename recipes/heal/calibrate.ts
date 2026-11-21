import { requireIphone } from "../../src/flow.ts";
import { difference, fromPng, type Image } from "../../src/image.ts";
import type { TextLine } from "../../src/ocr.ts";
import { on, type Recipe } from "../../src/recipe.ts";
import { saveShot } from "../../src/screen.ts";
import { clock, sleep } from "../../src/time.ts";
import {
  alliesFrom,
  amountIn,
  cancelHeal,
  healButton,
  infantryBox,
  type Ref,
  refs,
  shows,
  tiers,
  typeInto,
  waitFor,
} from "./window.ts";

const envFile = new URL("../../.env", import.meta.url);

export const withSetting = (file: string, name: string, value: number) => {
  const line = `${name}=${value}`;
  const pattern = new RegExp(`^${name}=.*$`, "m");
  const body = pattern.test(file)
    ? file.replace(pattern, line)
    : `${file}${file === "" || file.endsWith("\n") ? "" : "\n"}${line}`;
  return body.endsWith("\n") ? body : `${body}\n`;
};

const buildDir = new URL("../../build/", import.meta.url);
const progressFile = new URL("calibrate.json", buildDir);

type Progress = Record<string, { low: number; high?: number; assists: number }>;

const loadProgress = async () => JSON.parse(await Deno.readTextFile(progressFile).catch(() => "{}")) as Progress;

const saveProgress = async (tier: string, { low, high, assists }: { low: number; high?: number; assists: number }) => {
  await Deno.mkdir(buildDir, { recursive: true });
  await Deno.writeTextFile(
    progressFile,
    `${JSON.stringify({ ...(await loadProgress()), [tier]: { low, high, assists } }, null, 2)}\n`,
  );
};

const rowPixels = 239;
const rows = [0, 1, 2];

const badgeIn = (screen: Image, row: number, wanted: Ref, rest: Ref[]) => {
  const at = (r: Ref, dy: number) => difference(screen, r.img, r.x, r.y + dy);
  const best = Array.from({ length: 13 }, (_, j) => row * rowPixels + j - 6)
    .filter((dy) => dy >= 0)
    .map((dy) => ({ dy, d: at(wanted, dy), other: Math.min(...rest.map((r) => at(r, dy))) }))
    .toSorted((a, b) => a.d - b.d)[0];
  return { ...best, row, found: best.d < 12 && best.d < best.other };
};

const timerIn = (lines: TextLine[]) =>
  lines
    .filter((l) => l.x > 0.5 && l.y > 0.66 && l.y < 0.8)
    .map((l) => l.text.match(/(\d+):(\d\d):(\d\d)/))
    .flatMap((m) => m ? [Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3])] : [])[0];

type Search = { rounds: number; low: number; high?: number; assists: number; reason: string };
type Check = { rounds: number; perAlly: number; passed: number; assists: number; reason: string };

export const calibrate: Recipe = {
  description:
    "Finds how many troops of a tier one helping ally heals. Heals 10, then 20, then 30, narrows in on the limit, then confirms it with 5 heals. Heals that do not finish are cancelled.",
  flags: {
    "--start": "CALIBRATE_START",
    "-s": "CALIBRATE_START",
    "--tier": "CALIBRATE_TIER",
    "-t": "CALIBRATE_TIER",
    "--increment": "CALIBRATE_STEP",
    "-i": "CALIBRATE_STEP",
  },
  switches: { "--save": "CALIBRATE_SAVE", "--fresh": "CALIBRATE_FRESH" },
  run: async (phone, settings) => {
    const time = clock(settings.env.CLOCK);
    const start = Number(settings.env.CALIBRATE_START || 10);
    const increment = Number(settings.env.CALIBRATE_STEP || 10);
    const most = Number(settings.env.CALIBRATE_MAX || 2000);
    const maxRounds = Number(settings.env.CALIBRATE_MAX_ROUNDS || 40);
    const confirmations = Number(settings.env.CALIBRATE_CONFIRM || 5);
    const leftSeconds = Number(settings.env.CALIBRATE_LEFT_SECONDS || 15);
    const settleMs = Number(settings.env.CALIBRATE_SETTLE_SECONDS || 2) * 1000;
    const waitMs = Number(settings.env.FAST_FINISH_SECONDS || 3) * 1000;

    const first = await requireIphone(phone);
    if (!shows(first, refs.heal)) console.log(`${time()} waiting for the Heal button`);
    if (!(await waitFor(phone, refs.heal, Date.now() + 30000))) {
      await saveShot("calibrate-no-heal-button.png", await phone.screenshot());
      throw new Error(
        "the Heal button did not show up within 30s, open the Heal Injured window and wait for any running heal to finish (screenshot in build/calibrate-no-heal-button.png)",
      );
    }

    const ready = await phone.screenshot();
    const asked = (settings.env.CALIBRATE_TIER || "XI").toUpperCase();
    const wanted = tiers.find((t) => t.name === asked);
    if (!wanted) throw new Error(`unknown tier ${asked}, pick one of ${tiers.map((t) => t.name).join(", ")}`);
    await saveShot("calibrate-start.png", ready);
    const rest = tiers.filter((t) => t !== wanted).map((t) => t.ref);
    const badges = rows.map((k) => badgeIn(ready, k, wanted.ref, rest));
    console.log(
      `${time()} tier ${wanted.name} badge: ${
        badges.map((b) =>
          `troop ${b.row + 1} ${b.found ? "yes" : "no"} (${b.d.toFixed(1)} against ${b.other.toFixed(1)})`
        ).join(", ")
      }`,
    );
    const offset = badges.find((b) => b.found)?.dy;
    if (offset === undefined) {
      throw new Error(
        `tier ${asked} is not among the first three troops in the Heal Injured window, pick another with --tier`,
      );
    }
    const row = Math.round(offset / rowPixels);
    const box = { x: infantryBox.x, y: infantryBox.y + offset / 3 };
    const others = rows.filter((k) => k !== row).map((k) => ({
      x: infantryBox.x,
      y: infantryBox.y + (k * rowPixels) / 3,
    }));
    const setting = wanted.setting;
    console.log(`${time()} measuring tier ${wanted.name} on troop ${row + 1} (${setting})`);

    type Frame = { allies?: number; timer?: number };

    const watch = async (
      until: number,
      reads: Promise<Frame>[] = [],
      finishedAt?: number,
    ): Promise<{ finished: boolean; allies?: number; left?: number }> => {
      const png = await phone.snap();
      const healShown = shows(fromPng(png), refs.heal);
      const previous: Promise<unknown> = reads.at(-1) ?? Promise.resolve();
      const read = previous
        .then(() => phone.ocrPng(png))
        .then(
          (lines): Frame => ({ allies: alliesFrom(lines), timer: healShown ? undefined : timerIn(lines) }),
          (): Frame => ({}),
        );
      const doneAt = finishedAt ?? (healShown ? Date.now() : undefined);
      const over = doneAt ? Date.now() - doneAt > settleMs : Date.now() > until;
      if (!over) return watch(until, [...reads, read], doneAt);
      const frames = await Promise.all([...reads, read]);
      const counts = frames.flatMap((f) => f.allies ? [f.allies] : []);
      const lefts = frames.flatMap((f) => f.timer !== undefined && f.timer <= leftSeconds ? [f.timer] : []);
      return {
        finished: doneAt !== undefined,
        allies: counts.length ? Math.max(...counts) : undefined,
        left: lefts.length ? Math.max(...lefts) : undefined,
      };
    };

    for (const other of others) await typeInto(phone, other, 0).catch(() => undefined);
    console.log(`${time()} set the other troops to 0`);

    const heal = async (troops: number) => {
      console.log(`${time()} trying ${troops} troops`);
      await typeInto(phone, box, troops);
      const shown = amountIn(await phone.ocr(await phone.screenshot()), offset / ready.height);
      if (shown !== troops) return { stop: `the box shows ${shown ?? "nothing readable"} instead of ${troops}` };

      await phone.tap(healButton);
      await sleep(400);
      await phone.tap(healButton);
      const { finished: done, allies, left } = await watch(Date.now() + waitMs);
      const cancelled = done || await cancelHeal(phone).catch(() => false);
      const back = cancelled || await waitFor(phone, refs.heal, Date.now() + 3000);
      const finished = done && left === undefined;
      const outcome = finished
        ? "finished"
        : done
        ? `was not finished by the assists, ${left}s were left on the timer`
        : cancelled
        ? "did not finish, cancelled"
        : back
        ? "finished late"
        : "did not finish and could not be cancelled";
      const helped = allies
        ? `${allies} ${allies === 1 ? "assist" : "assists"} (${(troops / allies).toFixed(1)} per assist)`
        : "assists not readable";
      return {
        finished,
        allies,
        text: `${troops} troops ${outcome} with ${helped}`,
        stop: back ? undefined : "could not cancel the heal, check the phone",
      };
    };

    const settled = (s: Search) => s.high !== undefined && s.low > 0 && Math.ceil(s.high) - 1 <= Math.floor(s.low);

    const current = Number(settings.env[wanted.setting] || wanted.troops);

    const fallback = (s: Search, troops: number) => {
      const guess = Math.round(current * s.assists);
      return guess < troops ? guess : troops - increment;
    };

    const following = (s: Search, troops: number) =>
      s.high === undefined
        ? troops + increment
        : !s.low
        ? fallback(s, troops)
        : Math.round(((s.low + s.high) / 2) * s.assists);

    const search = async (troops: number, last: Search): Promise<Search> => {
      if (settled(last)) return { ...last, reason: "found the limit" };
      if (last.rounds >= maxRounds) return { ...last, reason: `gave up after ${maxRounds} heals` };
      if (troops > most) return { ...last, reason: `reached ${most} troops` };
      if (troops < 1) return { ...last, reason: "no amount finished" };
      const { finished, allies, text, stop } = await heal(troops);
      if (!text) return { ...last, reason: stop ?? "" };
      const misread = finished && allies !== undefined && last.high !== undefined && troops / allies >= last.high;
      const counted = misread ? undefined : allies;
      const low = finished && counted ? Math.max(last.low, troops / counted) : last.low;
      const high = !finished && counted ? Math.min(last.high ?? Infinity, troops / counted) : last.high;
      const next = { ...last, rounds: last.rounds + 1, low, high, assists: counted ?? last.assists };
      const known = `one assist heals ${low ? `at least ${low.toFixed(1)}` : "?"} and ${
        high ? `less than ${high.toFixed(1)}` : "no upper limit yet"
      }`;
      console.log(
        `${time()} ${text}, ${
          misread
            ? `does not count, ${
              last.high?.toFixed(1)
            } per assist already failed so the assist count must be wrong, still ${known}`
            : known
        }`,
      );
      await saveProgress(wanted.name, next);
      if (stop) return { ...next, reason: stop };
      return search(counted ? following(next, troops) : troops, next);
    };

    const check = async (last: Check): Promise<Check> => {
      if (last.passed >= confirmations) return { ...last, reason: `confirmed with ${confirmations} heals` };
      if (last.rounds >= maxRounds) return { ...last, reason: `gave up confirming after ${maxRounds} heals` };
      if (last.perAlly < 1) return { ...last, reason: "nothing left to confirm" };
      const troops = last.perAlly * last.assists;
      const { finished, allies, text, stop } = await heal(troops);
      if (!text) return { ...last, reason: stop ?? "" };
      const exact = allies === last.assists;
      const fewer = allies !== undefined && allies < last.assists;
      const tooMany = !finished && allies !== undefined && allies >= last.assists;
      const next = {
        ...last,
        rounds: last.rounds + 1,
        perAlly: tooMany ? last.perAlly - 1 : last.perAlly,
        passed: tooMany ? 0 : finished && exact ? last.passed + 1 : last.passed,
        assists: allies === undefined || (finished && fewer) ? last.assists : allies,
      };
      const verdict = tooMany
        ? `${last.perAlly} per assist is too many, trying ${next.perAlly}`
        : finished && exact
        ? `confirmed ${next.passed} of ${confirmations}`
        : finished && fewer
        ? `does not count, fewer assists were read than the ${last.assists} it was sized for, so the assist count is probably wrong`
        : "does not count, the number of assists changed";
      console.log(`${time()} ${text}, ${verdict}`);
      if (tooMany) await saveProgress(wanted.name, { low: next.perAlly, high: last.perAlly, assists: next.assists });
      if (stop) return { ...next, reason: stop };
      return check(next);
    };

    const saved = on(settings.env, "CALIBRATE_FRESH") ? undefined : (await loadProgress())[wanted.name];
    if (saved?.low) {
      console.log(
        `${time()} continuing from the last run: one assist heals at least ${saved.low.toFixed(1)}${
          saved.high ? ` and less than ${saved.high.toFixed(1)}` : ""
        } (add --fresh to start over)`,
      );
    }
    const resumed = { rounds: 0, low: saved?.low ?? 0, high: saved?.high, assists: saved?.assists ?? 0, reason: "" };
    const opening = resumed.low && resumed.assists && !settings.given.includes("CALIBRATE_START")
      ? following(resumed, Math.round(resumed.low * resumed.assists))
      : start;
    const found = await search(opening, resumed);
    console.log(`${time()} stopped searching: ${found.reason}`);
    if (!found.low) {
      console.log("no heal finished with a readable assist count, try again when allies are online");
      return;
    }
    if (found.high === undefined) console.log("no heal failed, so the real value may be higher");
    if (found.high !== undefined && found.high <= found.low) console.log("the readings disagree, using the lower one");
    const candidate = Math.min(Math.floor(found.low), Math.ceil(found.high ?? Infinity) - 1);
    if (candidate < 1) {
      console.log("less than one troop per assist, the reading looks wrong, try again");
      return;
    }

    const unchecked = {
      rounds: 0,
      perAlly: candidate,
      passed: 0,
      assists: found.assists,
      reason: "skipped, the search did not finish",
    };
    if (settled(found)) console.log(`${time()} confirming ${candidate} per assist with ${confirmations} heals`);
    const checked = settled(found) ? await check({ ...unchecked, reason: "" }) : unchecked;
    console.log(`${time()} stopped confirming: ${checked.reason}`);
    const perAlly = checked.perAlly;
    if (perAlly < 1) {
      console.log("no amount could be confirmed, try again");
      return;
    }
    console.log(
      `${setting}=${perAlly}${
        checked.passed >= confirmations ? "" : ` (only ${checked.passed} of ${confirmations} confirmed)`
      }`,
    );
    const safer = Math.max(1, perAlly - 1);
    console.log(`${perAlly} may have been lucky rounds, ${setting}=${safer} is the safer choice`);

    if (on(settings.env, "CALIBRATE_SAVE")) {
      const file = await Deno.readTextFile(envFile).catch(() => "");
      await Deno.writeTextFile(envFile, withSetting(file, setting, safer));
      console.log(`saved ${setting}=${safer} to .env`);
    } else {
      console.log(`add --save to write ${setting}=${safer} to .env`);
    }
  },
};
