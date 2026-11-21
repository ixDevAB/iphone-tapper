import { type Next, press, runFlow, type Seen } from "../../src/flow.ts";
import { crop, type Image, type Point } from "../../src/image.ts";
import type { TextLine } from "../../src/ocr.ts";
import type { Recipe } from "../../src/recipe.ts";
import { loadLibrary, matchAt, saveIcon } from "../../src/rewards.ts";
import { backArrow, center, exact, has, matching, scale } from "../../src/screen.ts";
import { refill, refillsFrom, staminaDialog, staminaFlags, staminaSwitches } from "../../src/stamina.ts";
import { clock, sleep } from "../../src/time.ts";
import { marchesOn, onWorld } from "../../src/world.ts";

const searchButton = { x: 25, y: 625 };
const terrorTab = { x: 137, y: 640 };
const levelMinus = { x: 39, y: 724 };
const levelPlus = { x: 271, y: 724 };
const closeHeroes = { x: 359, y: 177 };
const tileColumns = [79, 159, 240, 320];
const heroesDir = new URL("../../assets/heroes/", import.meta.url);
const faceAt = (spot: Point) => ({
  x: spot.x * scale - 55,
  y: Math.round(spot.y * scale) - 29,
  width: 110,
  height: 70,
});

const slots = [
  { flag: "HUNT_ARCH", kind: "archer", card: { x: 92, y: 287 }, hero: { x: 95, y: 290 } },
  { flag: "HUNT_INF", kind: "infantry", card: { x: 200, y: 287 }, hero: { x: 200, y: 290 } },
  { flag: "HUNT_CAV", kind: "cavalry", card: { x: 310, y: 287 }, hero: { x: 305, y: 290 } },
];

const tileRows = (lines: TextLine[]) =>
  lines
    .filter((l) => center(l).y > 430 && center(l).y < 590 && /Lv|80|70|60|50/i.test(l.text))
    .map((l) => center(l).y + 18)
    .toSorted((a, b) => a - b)
    .reduce<number[]>((rows, y) => rows.length && y - rows[rows.length - 1] < 30 ? rows : [...rows, y], [])
    .filter((y) => y > 448 && y < 600);

const heroName = (lines: TextLine[]) =>
  lines.find((l) => center(l).y < 95 && center(l).x > 120 && center(l).x < 290 && /^[A-Za-z]{3,}/.test(l.text.trim()))
    ?.text.trim().split(/\s+/)[0] ?? "";

const distance = (a: string, b: string): number =>
  a.length === 0 || b.length === 0 ? Math.max(a.length, b.length) : Math.min(
    distance(a.slice(1), b) + 1,
    distance(a, b.slice(1)) + 1,
    distance(a.slice(1), b.slice(1)) + (a[0] === b[0] ? 0 : 1),
  );

export const terrorHunt: Recipe = {
  description:
    "Holds Terror rallies: searches for a Terror, presses Rally, Hold a rally and Deploy, as many times as you ask for. Can put named heroes in the rally first.",
  flags: { "--level": "HUNT_LEVEL", "--arch": "HUNT_ARCH", "--inf": "HUNT_INF", "--cav": "HUNT_CAV", ...staminaFlags },
  switches: staminaSwitches,
  amount: "AMOUNT",
  run: async (phone, settings) => {
    const time = clock(settings.env.CLOCK);
    const amount = Number(settings.env.AMOUNT || 1);
    const level = Number(settings.env.HUNT_LEVEL || 8);
    const heroes = loadLibrary(heroesDir);
    const spelled = (typed: string) => {
      if (heroes.some((h) => h.name === typed)) return typed;
      const close = heroes.map((h) => ({ name: h.name, d: distance(h.name, typed) })).toSorted((a, b) => a.d - b.d)[0];
      if (!close || close.d > 2) return typed;
      console.log(`no hero called ${typed}, using ${close.name}`);
      return close.name;
    };
    const wanted = slots.flatMap((slot) =>
      settings.env[slot.flag] ? [{ ...slot, name: spelled(settings.env[slot.flag].toLowerCase()) }] : []
    );
    const refills = refillsFrom(settings.env);
    const returnWaitMs = Number(settings.env.HUNT_RETURN_MINUTES || 20) * 60 * 1000;
    const lostMs = Number(settings.env.HUNT_LOST_SECONDS || 45) * 1000;
    const log = (text: string) => console.log(`${time()} ${text}`);

    type State = {
      done: number;
      meatUsed: number;
      baseline?: number;
      deployed: boolean;
      waitSince?: number;
      target: string;
      searches: number;
      slot: number;
      tabSet: boolean;
      tile: number;
      page: number;
      chosen: boolean;
      viewing: boolean;
      face?: Image;
      spot?: Point;
      picks: number;
    };

    const nextRally = (s: State) => ({
      ...s,
      deployed: false,
      slot: 0,
      tabSet: false,
      tile: 0,
      page: 0,
      chosen: false,
      viewing: false,
      spot: undefined,
      picks: 0,
      searches: 0,
    });

    const screen = async (s: State, { lines, img }: Seen): Next<State> => {
      if (staminaDialog(lines)) {
        const result = await refill(phone, lines, refills, s.meatUsed, 25, log);
        if (result.empty) return `${result.empty}, ${s.done} of ${amount} rallies started`;
        return { ...s, meatUsed: result.meatUsed };
      }

      if (has(lines, /Troops Capacity|Escorts/i)) {
        const slot = wanted[s.slot];
        const name = heroName(lines).toLowerCase();
        await phone.tap(backArrow);
        await sleep(1500);
        const match = Boolean(slot) && name.length > 0 && (name.startsWith(slot.name) || slot.name.startsWith(name));
        if (s.face && name.length > 0 && !heroes.some((h) => h.name === name)) {
          await saveIcon(heroesDir, name, s.face);
          heroes.push({ name, img: s.face });
          log(`learned what ${name} looks like`);
        }
        return { ...s, viewing: false, face: undefined, chosen: match, tile: match ? s.tile : s.tile + 1 };
      }

      if (exact(lines, "Select Heroes").length) {
        const slot = wanted[s.slot];
        if (!slot) {
          await phone.tap(closeHeroes);
          await sleep(1200);
          return s;
        }
        if (!s.tabSet) {
          await phone.tap(slot.card);
          await sleep(1200);
          return { ...s, tabSet: true, tile: 0, page: 0, chosen: false };
        }
        const rows = tileRows(lines);
        const spots = rows.flatMap((y) => tileColumns.map((x) => ({ x, y })));
        if (s.chosen && s.spot) {
          await phone.tap(s.spot);
          await sleep(900);
          const after = await phone.ocrPng(await phone.snap());
          const change = exact(after, "Change")[0];
          const assigned = exact(after, "Remove").length > 0;
          if (!change && !assigned) {
            if (s.picks >= 3) {
              await phone.tap(closeHeroes);
              await sleep(1000);
              await phone.tap(backArrow);
              return `could not select the ${slot.kind} hero ${slot.name}, ${s.done} of ${amount} rallies started`;
            }
            return { ...s, chosen: false, spot: undefined, tile: 0, picks: s.picks + 1 };
          }
          log(`${slot.kind}: ${slot.name}${change ? "" : " is already in the rally"}`);
          if (change) await press(phone, change);
          await phone.tap(closeHeroes);
          await sleep(1200);
          return { ...s, slot: s.slot + 1, tabSet: false, tile: 0, page: 0, chosen: false, spot: undefined, picks: 0 };
        }
        const screen = img();
        const faces = spots.map((spot) => matchAt(screen, faceAt(spot), heroes));
        const seen = faces.findIndex((name) =>
          name !== undefined && (name.startsWith(slot.name) || slot.name.startsWith(name))
        );
        if (seen >= 0) return { ...s, chosen: true, tile: seen, spot: spots[seen] };
        const unknown = faces.findIndex((name, i) => i >= s.tile && name === undefined);
        const pictured = heroes.some((h) => h.name === slot.name);
        if (pictured && s.tile < spots.length) return { ...s, tile: spots.length };
        if (unknown >= 0 && unknown !== s.tile) return { ...s, tile: unknown };
        if (unknown < 0 && s.tile < spots.length) return { ...s, tile: spots.length };
        if (s.tile >= spots.length) {
          if (s.page >= 6 || !spots.length) {
            await phone.tap(closeHeroes);
            await sleep(1000);
            await phone.tap(backArrow);
            return `could not find the ${slot.kind} hero ${slot.name}, ${s.done} of ${amount} rallies started`;
          }
          await phone.drag({ x: 200, y: 560 }, { x: 200, y: 420 }, 0.8);
          await sleep(1200);
          return { ...s, tile: 0, page: s.page + 1 };
        }
        await phone.tap(spots[s.tile]);
        await sleep(900);
        const selected = await phone.ocrPng(await phone.snap());
        const view = exact(selected, "View")[0];
        if (!view) return { ...s, tile: s.tile + 1 };
        const covered = exact(selected, "Remove").length > 0;
        await press(phone, view);
        return {
          ...s,
          viewing: true,
          spot: spots[s.tile],
          face: covered ? undefined : crop(screen, faceAt(spots[s.tile])),
        };
      }

      if (matching(lines, /^Target:/i)) {
        const slot = wanted[s.slot];
        if (slot) {
          await phone.tap(slot.hero);
          await sleep(1500);
          return { ...s, tabSet: false };
        }
        const deploy = exact(lines, "Deploy").find((l) => center(l).y > 700);
        if (deploy) await press(phone, deploy);
        return { ...s, deployed: true };
      }

      const holds = exact(lines, "Hold a rally");
      if (holds.length >= 2) {
        await press(phone, holds.toSorted((a, b) => center(b).y - center(a).y)[0]);
        return s;
      }

      const search = exact(lines, "Search").find((l) => center(l).y > 780);
      if (search) {
        const rally = exact(lines, "Rally")[0];
        if (rally) {
          const target = matching(lines, /^Lv\.?\s*\d+\s+\S/i)?.text.trim() ?? "terror";
          await press(phone, rally);
          return { ...s, target };
        }
        if (s.searches >= 6) return `no level ${level} terror found, ${s.done} of ${amount} rallies started`;
        await phone.tap(terrorTab);
        await sleep(800);
        const shown = lines.find((l) =>
          /^\d+$/.test(l.text.trim()) && Math.abs(center(l).y - 725) < 14 && center(l).x > 300
        );
        const current = shown ? Number(shown.text) : level;
        if (current !== level) {
          await phone.tap(current > level ? levelMinus : levelPlus);
          await sleep(600);
          return s;
        }
        await press(phone, search);
        await sleep(1500);
        return { ...s, searches: s.searches + 1 };
      }

      if (onWorld(lines)) {
        const marches = marchesOn(lines);
        const used = marches?.used ?? 0;
        if (s.deployed) {
          log(`rally ${s.done + 1} of ${amount} started on ${s.target}`);
          const done = s.done + 1;
          if (done >= amount) return `${done} of ${amount} rallies started`;
          if (wanted.length) log("waiting for the rally to come back before the next one");
          return { ...nextRally(s), done, waitSince: wanted.length ? Date.now() : undefined };
        }
        if (s.waitSince) {
          if (used > (s.baseline ?? 0) && Date.now() - s.waitSince < returnWaitMs) {
            await sleep(5000);
            return s;
          }
          return { ...s, waitSince: undefined };
        }
        if (marches && marches.used >= marches.total) {
          await sleep(5000);
          return s;
        }
        await phone.tap(searchButton);
        await sleep(1500);
        return { ...s, baseline: used };
      }
    };

    log(
      `holding ${amount} level ${level} terror ${amount === 1 ? "rally" : "rallies"}${
        wanted.length ? ` with ${wanted.map((w) => `${w.name} (${w.kind})`).join(", ")}` : ""
      }`,
    );
    await runFlow(phone, {
      name: "terror",
      lostMs,
      start: {
        done: 0,
        meatUsed: 0,
        deployed: false,
        target: "terror",
        searches: 0,
        slot: 0,
        tabSet: false,
        tile: 0,
        page: 0,
        chosen: false,
        viewing: false,
        picks: 0,
      },
      screen,
      lost: (s) => `${s.done} of ${amount} rallies started`,
    });
  },
};
