import { decide } from "../../src/decisions.ts";
import { leaveRewards, look, type Next, runFlow, type Seen } from "../../src/flow.ts";
import { crop, type Image, type Point, scaleUp } from "../../src/image.ts";
import type { TextLine } from "../../src/ocr.ts";
import type { Env, Recipe } from "../../src/recipe.ts";
import { backArrow, center, exact, has, like, scale } from "../../src/screen.ts";
import { clock, sleep } from "../../src/time.ts";
import { findRow, panel, secondsLeft, toWorld } from "../../src/town.ts";

export const trials = [
  { name: "Coliseum", setting: "TRIAL_COLISEUM", match: /coliseum/i },
  { name: "Forest of Life", setting: "TRIAL_FOREST_OF_LIFE", match: /forest of life/i },
  { name: "Crystal Cave", setting: "TRIAL_CRYSTAL_CAVE", match: /crystal cave/i },
  { name: "Knowledge Nexus", setting: "TRIAL_KNOWLEDGE_NEXUS", match: /knowledge nexus/i },
  { name: "Molten Fort", setting: "TRIAL_MOLTEN_FORT", match: /molten fort/i },
  { name: "Radiant Spire", setting: "TRIAL_RADIANT_SPIRE", match: /radiant spire/i },
];

const kinds = ["Infantry", "Cavalry", "Archer"];
const done = { x: 361, y: 481 };
const ratioLine = { x: 20, y: 730, width: 380, height: 35 };
const mostFights = 60;
const readAllLabel = like("Read All", true);
const quickDeployX = 110;

export const ratioFrom = (text: string) => {
  const parts = text.split("/").map((p) => Number(p.trim()));
  const ok = parts.length === 3 && parts.every((n) => Number.isInteger(n) && n >= 0) &&
    parts.reduce((sum, n) => sum + n, 0) === 100;
  return ok ? parts : undefined;
};

export const ratiosFrom = (env: Env) =>
  trials.map((trial) => {
    const text = env[trial.setting];
    const ratio = text ? ratioFrom(text) : undefined;
    if (text && !ratio) {
      throw new Error(`${trial.setting} in .env must be infantry/cavalry/archer adding up to 100, like 50/10/40`);
    }
    return { ...trial, ratio };
  });

export const percentsIn = (texts: string[]) => [...texts.join(" ").matchAll(/(\d+)\s*%/g)].map((m) => Number(m[1]));

export const order = (current: number[], wanted: number[]) =>
  wanted
    .map((want, i) => ({ i, change: want - current[i] }))
    .filter((c) => c.change !== 0)
    .toSorted((a, b) => a.change - b.change)
    .map((c) => c.i);

const titleOf = (lines: TextLine[]) => lines.find((l) => center(l).y < 95 && center(l).x > 50 && center(l).x < 260);

type State = {
  finished: string[];
  reported: string[];
  readAll: boolean;
  fights: number;
  balances: number;
  opens: number;
  raids: number;
  quicks: number;
  formed: number;
  closes: number;
  current?: string;
};

export const mysticTrial: Recipe = {
  description:
    "Mystic Trial: in every trial that is open today it presses Raid and claims the raid rewards when they are offered, then sets your troop ratio with Balance and presses Challenge and Deploy until no attempts are left, and marks the battle reports as read. Starts on the world map or the town map and ends on the world map.",
  run: async (phone, settings) => {
    const time = clock(settings.env.CLOCK);
    const log = (text: string) => console.log(`${time()} ${text}`);
    const ratios = ratiosFrom(settings.env);
    const trialIn = (text: string) => ratios.find((t) => t.match.test(text));
    const later: { seconds?: number } = {};

    const part = async (img: Image, at: { x: number; y: number; width: number; height: number }) => {
      const region = { x: at.x * scale, y: at.y * scale, width: at.width * scale, height: at.height * scale };
      return (await phone.ocr(scaleUp(crop(img, region), 2))).map((l) => l.text.trim());
    };

    const percents = async (boxes: Point[]) => {
      const img = (await look(phone)).img();
      const read: number[] = [];
      for (const box of boxes) {
        const texts = await part(img, { x: box.x - 42, y: box.y - 20, width: 90, height: 40 });
        read.push(Number(texts.join(" ").match(/\d+/)?.[0] ?? NaN));
      }
      return read;
    };

    const screen = async (s: State, { lines, img }: Seen): Next<State> => {
      const skip = lines.find((l) => /^Skip/i.test(l.text.trim()) && center(l).y < 200);
      if (skip) {
        await phone.tap(center(skip));
        await sleep(2500);
        return s;
      }
      if (await leaveRewards(phone, lines)) return s;

      const confirm = exact(lines, "Confirm")[0];
      if (confirm && exact(lines, "Balance").some((l) => center(l).y < 320)) {
        const wanted = ratios.find((t) => t.name === s.current)?.ratio;
        const labels = kinds.map((kind) => exact(lines, kind)[0]);
        if (!wanted || labels.some((l) => !l)) throw new Error("the Balance window is not as expected, stopping");
        const boxes = labels.map((l) => ({ x: 332, y: center(l).y + 28 }));
        const before = await percents(boxes);
        for (const i of order(before, wanted)) {
          await phone.tap(boxes[i]);
          await sleep(900);
          await phone.type([..."\b".repeat(4), ...String(wanted[i])]);
          const key = exact((await look(phone)).lines, "Done").find((l) => center(l).x > 300);
          await phone.tap(key ? center(key) : done);
          await sleep(900);
          if (exact((await look(phone)).lines, "Done").some((l) => center(l).x > 300)) {
            throw new Error("the keyboard did not close after typing a troop ratio, stopping");
          }
        }
        const after = await percents(boxes);
        await decide("set the troop ratio", { trial: s.current, before, wanted, after });
        if (after.join("/") !== wanted.join("/")) {
          throw new Error(`could not set ${s.current} to ${wanted.join("/")}, it shows ${after.join("/")}`);
        }
        await phone.tap(center(confirm));
        await sleep(1500);
        return s;
      }

      if (exact(lines, "Squad Config").some((l) => center(l).y < 95)) {
        const start = exact(lines, "Deploy").find((l) => center(l).y > 700);
        if (!start) return undefined;
        const filled = lines.some((l) => /\d[\d,]{3,}\s*\/\s*\d[\d,]{3,}/.test(l.text));
        if (!filled) {
          if (s.quicks >= 3) throw new Error("Quick Deploy did not fill the squads, stopping");
          await decide("pressed Quick Deploy", { trial: s.current });
          await phone.tap({ x: quickDeployX, y: center(start).y });
          await sleep(2500);
          return { ...s, quicks: s.quicks + 1 };
        }
        const squads = exact(lines, "Edit Formation").toSorted((a, b) => center(a).y - center(b).y);
        if (s.formed < squads.length) {
          await decide("opening a squad to set its troop ratio", { squad: s.formed + 1, of: squads.length });
          await phone.tap(center(squads[s.formed]));
          await sleep(2500);
          return s;
        }
        await decide("deploying the squads", { trial: s.current, squads: s.formed });
        await phone.tap(center(start));
        await sleep(3000);
        return { ...s, quicks: 0, formed: 0 };
      }

      const squad = exact(lines, "Edit Formation").find((l) => center(l).y > 780);
      const deploy = exact(lines, "Deploy")[0] ?? squad;
      const balance = exact(lines, "Balance")[0];
      if (deploy && balance && has(lines, /^Troop Ratio/i)) {
        const trial = trialIn(titleOf(lines)?.text ?? "") ?? ratios.find((t) => t.name === s.current);
        if (!trial?.ratio) throw new Error("could not tell which trial this is, stopping");
        const shown = percentsIn(await part(img(), ratioLine));
        if (shown.join("/") === trial.ratio.join("/")) {
          await decide(deploy === squad ? "the squad has its troop ratio" : "deploying", {
            trial: trial.name,
            ratio: shown,
          });
          await phone.tap(center(deploy));
          await sleep(3000);
          return { ...s, current: trial.name, balances: 0, formed: deploy === squad ? s.formed + 1 : s.formed };
        }
        if (s.balances >= 2) {
          throw new Error(`${trial.name} still shows ${shown.join("/")} instead of ${trial.ratio.join("/")}`);
        }
        await phone.tap({ x: center(balance).x, y: center(balance).y - 35 });
        await sleep(1500);
        return { ...s, current: trial.name, balances: s.balances + 1 };
      }

      if (has(lines, /^.?Victory!?$/i) && has(lines, /^Next (Stage|Chapter)/i)) {
        await sleep(1000);
        return s;
      }

      const retry = exact(lines, "Retry")[0];
      if (retry && has(lines, /^Failed!?$/i)) {
        const left = Number(
          lines.map((l) => l.text.match(/Remaining attempts today:\s*(\d+)/i)).find((m) => m)?.[1] ?? 0,
        );
        if (left > 0 && s.fights < mostFights) {
          log(`${s.current ?? "trial"}: lost, ${left} ${left === 1 ? "attempt" : "attempts"} left, trying again`);
          await decide("pressed Retry after a lost fight", { trial: s.current, left });
          await phone.tap(center(retry));
          await sleep(2500);
          return { ...s, fights: s.fights + 1, formed: 0, quicks: 0, closes: 0 };
        }
        const report = exact(lines, "View Battle Report")[0];
        if (report && s.current && !s.reported.includes(s.current)) {
          log(`${s.current}: lost, no attempts left`);
          await phone.tap(center(report));
          await sleep(2500);
          return { ...s, reported: [...s.reported, s.current], readAll: false };
        }
        if (s.closes >= 3) throw new Error("could not leave the screen of the lost fight, stopping");
        await phone.tap(backArrow);
        await sleep(2000);
        return { ...s, closes: s.closes + 1 };
      }

      if (exact(lines, "Battle Report").some((l) => center(l).y < 95)) {
        const readAll = lines.find((l) => readAllLabel.test(l.text) && center(l).y > 780);
        if (readAll && !s.readAll) {
          log("battle report: Read All");
          await decide("pressed Read All in the battle report");
          await phone.tap(center(readAll));
          await sleep(2000);
          return { ...s, readAll: true };
        }
        await phone.tap(backArrow);
        await sleep(2000);
        return { ...s, readAll: false };
      }

      const raidClaim = exact(lines, "Claim")[0];
      if (raidClaim && exact(lines, "Raid Rewards").length && has(lines, /After raiding/i)) {
        const best = lines.map((l) => l.text.match(/best result is (Stage [\d-]+)/i)).find((m) => m)?.[1];
        log(`claiming the raid rewards${best ? `, best result ${best.toLowerCase()}` : ""}`);
        await decide("claimed the raid rewards", { best });
        await phone.tap(center(raidClaim));
        await sleep(2500);
        return s;
      }

      const raid = lines.find((l) => /^Raid cleared stag/i.test(l.text.trim()) && center(l).y > 700);
      if (raid && trialIn(titleOf(lines)?.text ?? "")) {
        if (s.raids >= 3) throw new Error("the Raid button did not open the raid rewards, stopping");
        await decide("pressed Raid", { trial: titleOf(lines)?.text.trim() });
        await phone.tap({ x: 201, y: center(raid).y + 31 });
        await sleep(2500);
        return { ...s, raids: s.raids + 1 };
      }

      const attempts = lines.map((l) => l.text.match(/Remaining attempts today:\s*(\d+)/i)).find((m) => m);
      const challenge = exact(lines, "Challenge")[0];
      const used = has(lines, /Attempts refresh/i);
      if (challenge && (attempts || used)) {
        const trial = trialIn(titleOf(lines)?.text ?? "");
        if (!trial) throw new Error("could not tell which trial this is, stopping");
        const stage = lines.find((l) => /^Stage\s/i.test(l.text.trim()))?.text.trim().toLowerCase() ?? "";
        const left = attempts ? Number(attempts[1]) : 0;
        const report = exact(lines, "Battle Report").find((l) => center(l).y > 300);
        if ((left <= 0 || s.fights >= mostFights) && report && !s.reported.includes(trial.name)) {
          await phone.tap({ x: center(report).x, y: center(report).y - 22 });
          await sleep(2500);
          return { ...s, reported: [...s.reported, trial.name], readAll: false };
        }
        if (left <= 0 || s.fights >= mostFights) {
          log(`${trial.name}: no attempts left${stage ? `, at ${stage}` : ""}`);
          await phone.tap(backArrow);
          await sleep(2000);
          return { ...s, finished: [...s.finished, trial.name], current: undefined };
        }
        log(`${trial.name}: ${stage || "challenge"}, ${left} ${left === 1 ? "attempt" : "attempts"} left`);
        await phone.tap(center(challenge));
        await sleep(2000);
        return { ...s, current: trial.name, fights: s.fights + 1, formed: 0, quicks: 0 };
      }

      if (exact(lines, "Mystic Trial").some((l) => center(l).y < 95)) {
        const open = ratios.flatMap((trial) => {
          const label = lines.find((l) => trial.match.test(l.text) && center(l).y > 100);
          const closed = label &&
            lines.some((l) =>
              /Opens in/i.test(l.text) && Math.abs(center(l).x - center(label).x) < 90 &&
              center(l).y - center(label).y > 0 && center(l).y - center(label).y < 30
            );
          return label && !closed && !s.finished.includes(trial.name) ? [{ trial, label }] : [];
        });
        const unset = open.find((o) => !o.trial.ratio);
        if (unset) {
          log(`${unset.trial.name}: skipped, add ${unset.trial.setting}=infantry/cavalry/archer to .env`);
          return { ...s, finished: [...s.finished, unset.trial.name] };
        }
        const next = open[0];
        await decide("looked at the trials", { open: open.map((o) => o.trial.name), finished: s.finished });
        if (!next || s.opens >= 14) {
          const waits = lines.flatMap((l) => /Opens in/i.test(l.text) ? [secondsLeft(l.text) ?? 0] : []).filter((n) =>
            n
          );
          if (waits.length) later.seconds = Math.min(...waits) + 60;
          const where = s.finished.length ? ` in ${s.finished.join(", ")}` : "";
          return `${s.fights} ${s.fights === 1 ? "fight" : "fights"}${where}`;
        }
        await phone.tap({ x: center(next.label).x, y: center(next.label).y - 62 });
        await sleep(2500);
        return { ...s, opens: s.opens + 1 };
      }
    };

    const list = await panel(phone, "Daily");
    const entry = await findRow(phone, list, ratios.map((trial) => trial.name));
    await decide("looked for the mystic trial", { found: Boolean(entry) });
    if (!entry) {
      await toWorld(phone);
      console.log("stopped: no Mystic Trial in the list, nothing left to do there today");
      return;
    }
    await phone.tap(entry.button);
    await sleep(2500);
    await runFlow<State>(phone, {
      name: "trials",
      lostMs: 60000,
      start: {
        finished: [],
        reported: [],
        readAll: false,
        fights: 0,
        balances: 0,
        opens: 0,
        raids: 0,
        quicks: 0,
        formed: 0,
        closes: 0,
      },
      screen,
    }).finally(() => toWorld(phone));
    return later.seconds;
  },
};
