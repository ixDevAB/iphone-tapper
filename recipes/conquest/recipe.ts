import { clock } from "../../src/clock.ts";
import { hasRedDot } from "../../src/dots.ts";
import { fromPng } from "../../src/image.ts";
import type { Recipe } from "../../src/recipes.ts";
import { rewardCounter } from "../../src/rewards.ts";
import { center, exact, has, matching, screenWidth } from "../../src/screen.ts";
import { sleep } from "../../src/wda.ts";

const conquestButton = { x: 40, y: 825 };
const backArrow = { x: 30, y: 77 };
const closeIdle = { x: 352, y: 259 };
const conquestDot = { x: 140, y: 2375, width: 50, height: 45 };

export const collectConquest: Recipe = {
  description: "Claims the Conquest idle income when the Conquest button has a red dot. With --force it claims even without the dot.",
  run: async (phone, settings) => {
    const time = clock(settings.env.CLOCK);
    const force = Deno.args.includes("--force");
    const lostMs = Number(settings.env.CONQUEST_LOST_SECONDS || 45) * 1000;
    const rewards = rewardCounter(phone);

    type State = { chest: number; claimed: number; opens: number; leaving: boolean; knownAt: number };

    const step = async (s: State): Promise<string> => {
      const png = await phone.snap();
      const lines = await phone.ocrPng(png);
      const fresh = { ...s, knownAt: Date.now() };

      const exit = matching(lines, /tap anywhere to exit/i);
      if (exit) {
        if (exact(lines, "Rewards").some((l) => center(l).y < 300)) await rewards.count(false);
        await phone.tap(center(exit));
        await sleep(1500);
        return step(fresh);
      }

      if (exact(lines, "Idle Income").length) {
        const claim = exact(lines, "Claim").find((l) => center(l).x < 280);
        if (claim && s.claimed < 2) {
          const idle = matching(lines, /^\d\d:\d\d:\d\d/)?.text.trim();
          console.log(`${time()} claiming the idle income${idle ? ` (${idle})` : ""}`);
          await phone.tap(center(claim));
          await sleep(2000);
          return step({ ...fresh, claimed: s.claimed + 1 });
        }
        await phone.tap(closeIdle);
        await sleep(1500);
        return step({ ...fresh, leaving: true });
      }

      if (exact(lines, "Conquer").length && has(lines, /^Conquest$/i)) {
        const claim = exact(lines, "Claim")[0];
        if (claim && !s.leaving && !s.claimed && s.chest < 2) {
          await phone.tap(center(claim));
          await sleep(1500);
          return step({ ...fresh, chest: s.chest + 1 });
        }
        await phone.tap(backArrow);
        await sleep(1500);
        return step({ ...fresh, leaving: true });
      }

      if (has(lines, /^Town$/i)) {
        if (s.leaving) return s.claimed ? "conquest idle income claimed" : "nothing claimed in conquest";
        if (!force && !hasRedDot(fromPng(png), conquestDot)) return "conquest has no red dot, add --force to claim anyway";
        if (s.opens >= 4) return "conquest did not open";
        await phone.tap(conquestButton);
        await sleep(3000);
        return step({ ...fresh, opens: s.opens + 1 });
      }

      if (Date.now() - s.knownAt > lostMs) return "did not recognise the screen";
      await sleep(1000);
      return step(s);
    };

    const first = await phone.screenshot();
    if (first.width !== screenWidth) throw new Error(`this recipe only works on an iPhone 17 Pro`);
    console.log(`stopped: ${await step({ chest: 0, claimed: 0, opens: 0, leaving: false, knownAt: Date.now() })}`);
    rewards.print();
  },
};
