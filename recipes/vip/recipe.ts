import { clock } from "../../src/clock.ts";
import { fromPng, type Image, toPng } from "../../src/image.ts";
import type { Recipe } from "../../src/recipes.ts";
import { rewardCounter } from "../../src/rewards.ts";
import { center, exact, has, matching, screenWidth } from "../../src/screen.ts";
import { sleep } from "../../src/wda.ts";

const vipButton = { x: 369, y: 98 };
const backArrow = { x: 30, y: 77 };
const chest = { x: 349, y: 210 };
const plus = { x: 295, y: 211 };
const closeDialog = { x: 373, y: 175 };
const chestDot = { x: 1071, y: 557, width: 50, height: 50 };
const plusDot = { x: 895, y: 569, width: 50, height: 50 };
const buildDir = new URL("../../build/", import.meta.url);

const redDot = (img: Image, r: { x: number; y: number; width: number; height: number }) =>
  Array.from({ length: r.width * r.height }, (_, i) => {
    const p = ((r.y + Math.floor(i / r.width)) * img.width + r.x + (i % r.width)) * img.channels;
    return img.data[p] > 200 && img.data[p + 1] < 80 && img.data[p + 2] < 80 ? 1 : 0;
  }).reduce((sum: number, n) => sum + n, 0) > 40;

export const claimVip: Recipe = {
  description:
    "Opens the VIP screen and claims what has a red dot: the daily free bundle, the daily sign-in chest, and it uses the VIP XP items you own. Never presses Buy & Use.",
  run: async (phone, settings) => {
    const time = clock(settings.env.CLOCK);
    const lostMs = Number(settings.env.VIP_LOST_SECONDS || 45) * 1000;
    const rewards = rewardCounter(phone);
    const log = (text: string) => console.log(`${time()} ${text}`);

    type State = { bundle: number; chest: number; plus: number; uses: number; opens: number; leaving: boolean; knownAt: number };

    const step = async (s: State): Promise<string> => {
      const png = await phone.snap();
      const lines = await phone.ocrPng(png);
      const fresh = { ...s, knownAt: Date.now() };

      const exit = matching(lines, /tap anywhere to exit/i);
      if (exit) {
        if (exact(lines, "Rewards").length) await rewards.count(false);
        await phone.tap(center(exit));
        await sleep(1500);
        return step(fresh);
      }

      const next = matching(lines, /click to continue/i);
      if (next) {
        const xp = matching(lines, /Get VIP XP/i)?.text.trim();
        if (xp) log(`sign-in chest: ${xp}`);
        await phone.tap(center(next));
        await sleep(1500);
        return step(fresh);
      }

      if (exact(lines, "Increase Level").length) {
        const use = exact(lines, "Use")[0];
        const all = use ? lines.find((l) => /^[×x]\s*[\d,]+$/i.test(l.text.trim()) && Math.abs(center(l).y - center(use).y) < 12 && center(l).x < center(use).x - 40) : undefined;
        if (use && s.uses < 12) {
          if (all) log(`using ${all.text.trim().replace(/^[×x]\s*/i, "")} VIP XP items`);
          await phone.tap(center(all ?? use));
          await sleep(1500);
          return step({ ...fresh, uses: s.uses + 1 });
        }
        await phone.tap(closeDialog);
        await sleep(1500);
        return step({ ...fresh, plus: 9 });
      }

      if (has(lines, /^Current Level: VIP/i)) {
        if (s.leaving) {
          await phone.tap(backArrow);
          await sleep(1500);
          return step(fresh);
        }
        const screen = fromPng(png);
        const claim = exact(lines, "Claim")[0];
        if (claim && s.bundle < 2) {
          log("claiming the daily free bundle");
          await phone.tap(center(claim));
          await sleep(1500);
          return step({ ...fresh, bundle: s.bundle + 1 });
        }
        if (redDot(screen, chestDot) && s.chest < 2) {
          await phone.tap(chest);
          await sleep(1500);
          return step({ ...fresh, chest: s.chest + 1 });
        }
        if (redDot(screen, plusDot) && s.plus < 2) {
          await phone.tap(plus);
          await sleep(1500);
          return step({ ...fresh, plus: s.plus + 1 });
        }
        return step({ ...fresh, leaving: true });
      }

      if (has(lines, /^Town$/i) || has(lines, /^Conquest$/i)) {
        if (s.leaving) return "vip claimed";
        if (s.opens >= 4) return "the vip screen did not open";
        await phone.tap(vipButton);
        await sleep(2500);
        return step({ ...fresh, opens: s.opens + 1 });
      }

      if (Date.now() - s.knownAt > lostMs) {
        await Deno.mkdir(buildDir, { recursive: true });
        await Deno.writeFile(new URL("vip-lost.png", buildDir), toPng(fromPng(png)));
        return "did not recognise the screen, see build/vip-lost.png";
      }
      await sleep(1000);
      return step(s);
    };

    const first = await phone.screenshot();
    if (first.width !== screenWidth) throw new Error(`this recipe only works on an iPhone 17 Pro`);
    console.log(`stopped: ${await step({ bundle: 0, chest: 0, plus: 0, uses: 0, opens: 0, leaving: false, knownAt: Date.now() })}`);
    rewards.print();
  },
};
