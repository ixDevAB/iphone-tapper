import { clock } from "../../src/clock.ts";
import { difference, fromPng, loadImage, toPng } from "../../src/image.ts";
import type { TextLine } from "../../src/ocr.ts";
import type { Recipe } from "../../src/recipes.ts";
import { sleep } from "../../src/wda.ts";
import { findMarkers } from "./markers.ts";
import { rewardCounter } from "../../src/rewards.ts";
import { center, exact, has, screenWidth } from "../../src/screen.ts";

const intelButton = { x: 369, y: 619 };
const panButton = { x: 32, y: 170 };
const staminaPlus = { x: 385, y: 75 };
const closeDialog = { x: 373, y: 175 };
const backArrow = { x: 30, y: 77 };
const pan = { img: loadImage(new URL("../../assets/intel/pan.png", import.meta.url)), x: 70, y: 478 };
const buildDir = new URL("../../build/", import.meta.url);

const actions = [
  { button: "Rescue", kind: "tent" },
  { button: "Attack", kind: "animal" },
  { button: "Conquer", kind: "fight" },
];

const near = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.abs(a.x - b.x) < 40 && Math.abs(a.y - b.y) < 40;

const staminaOn = (lines: TextLine[]) => {
  const line = lines.find((l) => /^\d+$/.test(l.text.trim()) && center(l).y < 100 && center(l).x > 300);
  return line ? Number(line.text) : undefined;
};

const claimBeside = (lines: TextLine[], title: string) => {
  const row = exact(lines, title)[0];
  return row ? exact(lines, "Claim").find((c) => Math.abs(center(c).y - center(row).y) < 30) : undefined;
};

export const intel: Recipe = {
  description:
    "Does the intel missions. Opens Intel, taps a marker, presses View, then Rescue, Attack and Deploy, or Conquer and Fight, and claims the rewards. Never spends gems.",
  run: async (phone, settings) => {
    const time = clock(settings.env.CLOCK);
    const usePan = Deno.args.includes("--pan");
    const useStorehouse = Deno.args.includes("--storehouse") || Deno.args.includes("--gourmet");
    const useEmbrace = Deno.args.includes("--embrace");
    const meatBudget = Math.floor(Number(settings.env.INTEL_STAMINA || 0) / 10);
    const needed = Number(settings.env.INTEL_STAMINA_NEEDED || 12);
    const marchWaitMs = Number(settings.env.INTEL_MARCH_WAIT_SECONDS || 60) * 1000;
    const collectWaitMs = Number(settings.env.INTEL_COLLECT_WAIT_SECONDS || 30) * 1000;
    const lostMs = Number(settings.env.INTEL_LOST_SECONDS || 45) * 1000;

    type Spot = { x: number; y: number; colour: string };
    const finishedIntel: string[] = [];
    const rewards = rewardCounter(phone);

    type State = {
      done: number;
      meatUsed: number;
      panTried: boolean;
      duds: { x: number; y: number }[];
      tapped?: Spot;
      current?: Spot;
      sent: Spot[];
      collectSince?: number;
      fullSince?: number;
      empty?: string;
      kind?: string;
      stamina?: number;
      deploys: number;
      knownAt: number;
    };

    const look = async () => {
      const png = await phone.snap();
      return { png, lines: await phone.ocrPng(png) };
    };

    const press = async (line: TextLine) => {
      await phone.tap(center(line));
      await sleep(1500);
    };

    const step = async (s: State): Promise<string> => {
      const { png, lines } = await look();
      const fresh = { ...s, knownAt: Date.now() };

      const exit = lines.find((l) => /tap anywhere to exit/i.test(l.text));
      if (exit) {
        if (exact(lines, "Rewards").length) await rewards.count(has(lines, /Victory/i));
        await press(exit);
        return step(fresh);
      }

      if (exact(lines, "Get More").length) {
        const bar = lines.map((l) => l.text.match(/^(\d+)\s*\/\s*(\d+)$/)).find((m) => m);
        const current = bar ? Number(bar[1]) : undefined;
        if (current !== undefined && current >= needed) {
          await phone.tap(closeDialog);
          await sleep(1000);
          return step({ ...fresh, stamina: current });
        }
        const feast = useStorehouse ? claimBeside(lines, "Gourmet Feast") : undefined;
        const embrace = useEmbrace ? claimBeside(lines, "Comforting Embrace") : undefined;
        const use = s.meatUsed < meatBudget ? exact(lines, "Use")[0] : undefined;
        const source = feast ?? embrace ?? use;
        if (!source) {
          await phone.tap(closeDialog);
          await sleep(1000);
          const empty = `out of stamina${current === undefined ? "" : ` (${current})`}, add --storehouse, --embrace or --stamina 50 to refill`;
          console.log(`${time()} ${empty}`);
          return step({ ...fresh, empty, kind: undefined, current: undefined });
        }
        console.log(`${time()} stamina ${current ?? "?"}, ${feast ? "claiming the storehouse feast" : embrace ? "claiming the comforting embrace" : `using a meat (${s.meatUsed + 1} of ${meatBudget})`}`);
        await press(source);
        return step({ ...fresh, meatUsed: source === use ? s.meatUsed + 1 : s.meatUsed });
      }

      if (exact(lines, "Squad Settings").length) {
        const fight = exact(lines, "Fight")[0];
        if (fight) await press(fight);
        return step(fresh);
      }

      const deploy = exact(lines, "Deploy").find((l) => center(l).y > 700);
      if (deploy) {
        if (s.deploys >= 3) {
          console.log(`${time()} deploy did not go through, all marches may be busy, trying again in 15s`);
          await phone.tap(backArrow);
          await sleep(15000);
          return step({ ...fresh, deploys: 0, kind: undefined, current: undefined });
        }
        await press(deploy);
        return step({ ...fresh, deploys: s.deploys + 1 });
      }

      const action = actions.flatMap((a) => exact(lines, a.button).map((line) => ({ ...a, line })))[0];
      if (action && s.empty) {
        await phone.tap(intelButton);
        await sleep(1500);
        return step(fresh);
      }
      const marches = lines.map((l) => center(l).y > 160 && center(l).y < 190 && center(l).x < 260 ? l.text.match(/(?:^|\s)(\d)\s*\/\s*(\d)(?!\d)/) : null).find((m) => m);
      const full = marches ? Number(marches[1]) >= Number(marches[2]) : false;
      if (action && action.kind === "animal" && full) {
        const since = s.fullSince ?? Date.now();
        if (!s.fullSince) console.log(`${time()} all ${marches?.[2]} marches are busy, waiting for one to come back`);
        if (Date.now() - since < marchWaitMs) {
          await sleep(3000);
          return step({ ...fresh, fullSince: since });
        }
        console.log(`${time()} still no free march, skipping this animal`);
        await phone.tap(intelButton);
        await sleep(1500);
        const skipped = s.tapped ?? s.current;
        return step({ ...fresh, fullSince: undefined, tapped: undefined, current: undefined, duds: skipped ? [...s.duds, skipped] : s.duds });
      }
      if (action) {
        const colour = (s.tapped ?? s.current)?.colour;
        if (s.kind !== action.kind) console.log(`${time()} intel ${s.done + 1}: ${colour ? `${colour} ` : ""}${action.kind}`);
        await press(action.line);
        return step({ ...fresh, kind: action.kind, tapped: undefined, current: s.tapped ?? s.current, fullSince: undefined });
      }

      const view = exact(lines, "View")[0];
      if (view) {
        await press(view);
        await sleep(1500);
        return step(fresh);
      }

      if (has(lines, /^Intel Mission$/i)) {
        const marching = s.kind && s.kind !== "fight" && s.current ? [...s.sent, s.current] : s.sent;
        if (s.kind) finishedIntel.push(`${s.current?.colour ?? "unknown"} ${s.kind}`);
        const finished = s.kind ? { ...fresh, done: s.done + 1, kind: undefined, current: undefined, deploys: 0, sent: marching } : fresh;
        const screen = fromPng(png);
        if (usePan && !s.panTried) {
          const there = difference(screen, pan.img, pan.x, pan.y) < 12;
          console.log(`${time()} ${there ? "pressing the pan skill" : "the pan skill is not available"}`);
          if (there) await phone.tap(panButton);
          await sleep(1500);
          return step({ ...finished, panTried: true });
        }
        const stamina = staminaOn(lines);
        if (stamina !== undefined && stamina !== s.stamina) console.log(`${time()} stamina ${stamina}`);
        if (stamina !== undefined && stamina < needed && !s.empty) {
          await phone.tap(staminaPlus);
          await sleep(1500);
          return step({ ...finished, stamina });
        }
        const duds = s.tapped ? [...s.duds, s.tapped] : s.duds;
        const found = findMarkers(screen);
        const checks = found.filter((m) => m.kind === "check").length;
        const pending = Math.max(0, finished.sent.length - checks);
        const marker = s.empty ? undefined : found.find((m) => m.kind !== "check" && ![...duds, ...finished.sent].some((d) => near(d, m)));
        if (marker) {
          await phone.tap(marker);
          await sleep(1500);
          return step({ ...finished, stamina, duds, tapped: { x: marker.x, y: marker.y, colour: marker.kind }, collectSince: undefined });
        }
        const claim = exact(lines, "Claim All")[0];
        const since = s.collectSince ?? Date.now();
        const waiting = pending > 0 && Date.now() - since < collectWaitMs;
        if (claim && !waiting) {
          console.log(`${time()} collecting rewards`);
          await press(claim);
          return step({ ...finished, stamina, duds, tapped: undefined, sent: [], collectSince: undefined });
        }
        if (waiting) {
          if (!s.collectSince) console.log(`${time()} waiting for ${pending} of ${finished.sent.length} sent intel to finish before collecting`);
          await sleep(3000);
          return step({ ...finished, stamina, duds, tapped: undefined, collectSince: since });
        }
        return s.empty ? `${s.empty}, ${finished.done} done` : `no intel left to do, ${finished.done} done`;
      }

      if (has(lines, /^Town$/i) || has(lines, /^Conquest$/i)) {
        await phone.tap(intelButton);
        await sleep(1500);
        return step(fresh);
      }

      if (Date.now() - s.knownAt > lostMs) {
        await Deno.mkdir(buildDir, { recursive: true });
        await Deno.writeFile(new URL("intel-lost.png", buildDir), toPng(fromPng(png)));
        return "did not recognise the screen, see build/intel-lost.png";
      }
      await sleep(1000);
      return step(s);
    };

    const first = await phone.screenshot();
    if (first.width !== screenWidth) throw new Error(`this recipe only works on an iPhone 17 Pro`);
    const reason = await step({ done: 0, meatUsed: 0, panTried: false, duds: [], sent: [], deploys: 0, knownAt: Date.now() });
    console.log(`stopped: ${reason}`);
    const counts = Object.entries(Object.groupBy(finishedIntel, (name) => name)).map(([name, all]) => `${all?.length ?? 0} ${name}`);
    if (counts.length) console.log(`intel done: ${counts.join(", ")}`);
    rewards.print();
  },
};
