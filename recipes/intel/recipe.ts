import { difference, loadImage, type Point } from "../../src/image.ts";
import { leaveRewards, type Next, press, runFlow, type Seen } from "../../src/flow.ts";
import type { TextLine } from "../../src/ocr.ts";
import { on, type Recipe } from "../../src/recipe.ts";
import { rewardCounter } from "../../src/rewards.ts";
import { backArrow, center, exact, has, saveShot } from "../../src/screen.ts";
import { refill, refillsFrom, staminaDialog, staminaFlags, staminaSwitches } from "../../src/stamina.ts";
import { clock, sleep } from "../../src/time.ts";
import { marchesOn, onWorld } from "../../src/world.ts";
import { findMarkers } from "./markers.ts";

const intelButton = { x: 369, y: 619 };
const panButton = { x: 32, y: 170 };
const staminaPlus = { x: 385, y: 75 };
const pan = { img: loadImage(new URL("../../assets/intel/pan.png", import.meta.url)), x: 70, y: 478 };

const actions = [
  { button: "Rescue", kind: "tent" },
  { button: "Attack", kind: "animal" },
  { button: "Conquer", kind: "fight" },
];

const near = (a: Point, b: Point) => Math.abs(a.x - b.x) < 40 && Math.abs(a.y - b.y) < 40;

const staminaOn = (lines: TextLine[]) => {
  const line = lines.find((l) => /^\d+$/.test(l.text.trim()) && center(l).y < 100 && center(l).x > 300);
  return line ? Number(line.text) : undefined;
};

export const intel: Recipe = {
  description:
    "Does the intel missions. Opens Intel, taps a marker, presses View, then Rescue, Attack and Deploy, or Conquer and Fight, and claims the rewards. Never spends gems.",
  flags: staminaFlags,
  switches: { "--pan": "INTEL_PAN", ...staminaSwitches },
  run: async (phone, settings) => {
    const time = clock(settings.env.CLOCK);
    const usePan = on(settings.env, "INTEL_PAN");
    const refills = refillsFrom(settings.env);
    const log = (text: string) => console.log(`${time()} ${text}`);
    const needed = Number(settings.env.INTEL_STAMINA_NEEDED || 12);
    const marchWaitMs = Number(settings.env.INTEL_MARCH_WAIT_SECONDS || 60) * 1000;
    const collectWaitMs = Number(settings.env.INTEL_COLLECT_WAIT_SECONDS || 30) * 1000;
    const lostMs = Number(settings.env.INTEL_LOST_SECONDS || 45) * 1000;

    type Spot = Point & { colour: string };
    const finishedIntel: string[] = [];
    const rewards = rewardCounter(phone);

    type State = {
      done: number;
      meatUsed: number;
      panTried: boolean;
      duds: Point[];
      tapped?: Spot;
      current?: Spot;
      sent: Spot[];
      collectSince?: number;
      fullSince?: number;
      empty?: string;
      kind?: string;
      stamina?: number;
      deploys: number;
    };

    const screen = async (s: State, { png, lines, img }: Seen): Next<State> => {
      if (await leaveRewards(phone, lines, rewards, has(lines, /Victory/i))) return s;

      if (staminaDialog(lines)) {
        const result = await refill(phone, lines, refills, s.meatUsed, needed, log);
        if (result.enough) return { ...s, stamina: result.current };
        if (result.empty) {
          log(result.empty);
          return { ...s, empty: result.empty, kind: undefined, current: undefined };
        }
        return { ...s, meatUsed: result.meatUsed };
      }

      if (exact(lines, "Squad Settings").length) {
        const fight = exact(lines, "Fight")[0];
        if (fight) await press(phone, fight);
        return s;
      }

      const deploy = exact(lines, "Deploy").find((l) => center(l).y > 700);
      if (deploy) {
        if (s.deploys >= 3) {
          console.log(`${time()} deploy did not go through, all marches may be busy, trying again in 15s`);
          await phone.tap(backArrow);
          await sleep(15000);
          return { ...s, deploys: 0, kind: undefined, current: undefined };
        }
        await press(phone, deploy);
        return { ...s, deploys: s.deploys + 1 };
      }

      const action = actions.flatMap((a) => exact(lines, a.button).map((line) => ({ ...a, line })))[0];
      if (action && s.empty) {
        await phone.tap(intelButton);
        await sleep(1500);
        return s;
      }
      const marches = marchesOn(lines);
      const full = marches ? marches.used >= marches.total : false;
      if (action && action.kind === "animal" && full) {
        const since = s.fullSince ?? Date.now();
        if (!s.fullSince) console.log(`${time()} all ${marches?.total} marches are busy, waiting for one to come back`);
        if (Date.now() - since < marchWaitMs) {
          await sleep(3000);
          return { ...s, fullSince: since };
        }
        console.log(`${time()} still no free march, skipping this animal`);
        await phone.tap(intelButton);
        await sleep(1500);
        const skipped = s.tapped ?? s.current;
        return {
          ...s,
          fullSince: undefined,
          tapped: undefined,
          current: undefined,
          duds: skipped ? [...s.duds, skipped] : s.duds,
        };
      }
      if (action) {
        const colour = (s.tapped ?? s.current)?.colour;
        if (s.kind !== action.kind) {
          console.log(`${time()} intel ${s.done + 1}: ${colour ? `${colour} ` : ""}${action.kind}`);
        }
        await press(phone, action.line);
        return { ...s, kind: action.kind, tapped: undefined, current: s.tapped ?? s.current, fullSince: undefined };
      }

      const view = exact(lines, "View")[0];
      if (view) {
        await press(phone, view);
        await sleep(1500);
        return s;
      }

      if (has(lines, /^Intel Mission$/i)) {
        const marching = s.kind && s.kind !== "fight" && s.current ? [...s.sent, s.current] : s.sent;
        if (s.kind) finishedIntel.push(`${s.current?.colour ?? "unknown"} ${s.kind}`);
        const finished = s.kind
          ? { ...s, done: s.done + 1, kind: undefined, current: undefined, deploys: 0, sent: marching }
          : s;
        const screen = img();
        if (usePan && !s.panTried) {
          const panDifference = difference(screen, pan.img, pan.x, pan.y);
          const there = panDifference < 12;
          console.log(
            `${time()} ${
              there
                ? "pressing the pan skill"
                : `the pan skill is not available (picture difference ${
                  panDifference.toFixed(0)
                }, see build/intel-pan.png)`
            }`,
          );
          if (!there) await saveShot("intel-pan.png", png);
          if (there) await phone.tap(panButton);
          await sleep(1500);
          return { ...finished, panTried: true };
        }
        const stamina = staminaOn(lines);
        if (stamina !== undefined && stamina !== s.stamina) console.log(`${time()} stamina ${stamina}`);
        if (stamina !== undefined && stamina < needed && !s.empty) {
          await phone.tap(staminaPlus);
          await sleep(1500);
          return { ...finished, stamina };
        }
        const duds = s.tapped ? [...s.duds, s.tapped] : s.duds;
        const found = findMarkers(screen);
        const checks = found.filter((m) => m.kind === "check").length;
        const pending = Math.max(0, finished.sent.length - checks);
        const marker = s.empty
          ? undefined
          : found.find((m) => m.kind !== "check" && ![...duds, ...finished.sent].some((d) => near(d, m)));
        if (marker) {
          await phone.tap(marker);
          await sleep(1500);
          return {
            ...finished,
            stamina,
            duds,
            tapped: { x: marker.x, y: marker.y, colour: marker.kind },
            collectSince: undefined,
          };
        }
        const claim = exact(lines, "Claim All")[0];
        const since = s.collectSince ?? Date.now();
        const waiting = pending > 0 && Date.now() - since < collectWaitMs;
        if (claim && !waiting) {
          console.log(`${time()} collecting rewards`);
          await press(phone, claim);
          return { ...finished, stamina, duds, tapped: undefined, sent: [], collectSince: undefined };
        }
        if (waiting) {
          if (!s.collectSince) {
            console.log(
              `${time()} waiting for ${pending} of ${finished.sent.length} sent intel to finish before collecting`,
            );
          }
          await sleep(3000);
          return { ...finished, stamina, duds, tapped: undefined, collectSince: since };
        }
        await saveShot("intel-end.png", png);
        const pins = found.filter((m) => m.kind !== "check");
        console.log(
          `${time()} markers on the last screen: ${pins.length} seen, ${
            pins.filter((m) => duds.some((d) => near(d, m))).length
          } skipped because a tap on them opened nothing, ${
            pins.filter((m) => finished.sent.some((d) => near(d, m))).length
          } skipped as already sent (screenshot in build/intel-end.png)`,
        );
        return s.empty ? `${s.empty}, ${finished.done} done` : `no intel left to do, ${finished.done} done`;
      }

      if (onWorld(lines)) {
        await phone.tap(intelButton);
        await sleep(1500);
        return s;
      }
    };

    await runFlow(phone, {
      name: "intel",
      lostMs,
      start: { done: 0, meatUsed: 0, panTried: false, duds: [], sent: [], deploys: 0 },
      screen,
    }).finally(() => {
      const counts = Object.entries(Object.groupBy(finishedIntel, (name) => name)).map(([name, all]) =>
        `${all?.length ?? 0} ${name}`
      );
      if (counts.length) console.log(`intel done: ${counts.join(", ")}`);
      rewards.print();
    });
  },
};
