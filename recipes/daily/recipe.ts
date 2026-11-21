import { clock } from "../../src/clock.ts";
import type { Recipe } from "../../src/recipes.ts";
import { rewardCounter } from "../../src/rewards.ts";
import { center, exact, has, matching, screenWidth } from "../../src/screen.ts";
import { sleep } from "../../src/wda.ts";

const scrollButton = { x: 25, y: 722 };
const dailyTab = { x: 266, y: 730 };
const closeButton = { x: 383, y: 165 };

export const collectDaily: Recipe = {
  description: "Opens the daily missions (the scroll icon) and presses Claim All until nothing is left to claim.",
  run: async (phone, settings) => {
    const time = clock(settings.env.CLOCK);
    const lostMs = Number(settings.env.DAILY_LOST_SECONDS || 45) * 1000;
    const rewards = rewardCounter(phone);

    type State = { claims: number; tabbed: boolean; opens: number; leaving: boolean; knownAt: number };

    const step = async (s: State): Promise<string> => {
      const lines = await phone.ocrPng(await phone.snap());
      const fresh = { ...s, knownAt: Date.now() };

      const exit = matching(lines, /tap anywhere to exit/i);
      if (exit) {
        if (exact(lines, "Rewards").length) await rewards.count(false);
        await phone.tap(center(exit));
        await sleep(1500);
        return step(fresh);
      }

      if (has(lines, /^Growth$/i) && has(lines, /^Daily$/i)) {
        if (!s.tabbed) {
          await phone.tap(dailyTab);
          await sleep(1200);
          return step({ ...fresh, tabbed: true });
        }
        const claimAll = matching(lines, /^claim all$/i);
        if (claimAll && s.claims < 6) {
          console.log(`${time()} claiming the daily rewards`);
          await phone.tap(center(claimAll));
          await sleep(2000);
          return step({ ...fresh, claims: s.claims + 1 });
        }
        await phone.tap(closeButton);
        await sleep(1500);
        return step({ ...fresh, leaving: true });
      }

      if (has(lines, /^Town$/i) || has(lines, /^Conquest$/i)) {
        if (s.leaving) return s.claims ? "daily rewards claimed" : "nothing to claim in the daily missions";
        if (s.opens >= 4) return "the daily missions did not open";
        await phone.tap(scrollButton);
        await sleep(2000);
        return step({ ...fresh, opens: s.opens + 1 });
      }

      if (Date.now() - s.knownAt > lostMs) return "did not recognise the screen";
      await sleep(1000);
      return step(s);
    };

    const first = await phone.screenshot();
    if (first.width !== screenWidth) throw new Error(`this recipe only works on an iPhone 17 Pro`);
    console.log(`stopped: ${await step({ claims: 0, tabbed: false, opens: 0, leaving: false, knownAt: Date.now() })}`);
    rewards.print();
  },
};
