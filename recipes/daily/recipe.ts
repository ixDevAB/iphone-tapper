import { leaveRewards, type Next, openFromWorld, runFlow, type Seen } from "../../src/flow.ts";
import type { Recipe } from "../../src/recipe.ts";
import { rewardCounter } from "../../src/rewards.ts";
import { center, has, like, matching } from "../../src/screen.ts";
import { clock, sleep } from "../../src/time.ts";
import { onWorld } from "../../src/world.ts";

const scrollButton = { x: 25, y: 722 };
const dailyTab = { x: 266, y: 730 };
const closeButton = { x: 383, y: 165 };

type State = { claims: number; tabbed: boolean; opens: number; leaving: boolean };

export const collectDaily: Recipe = {
  description: "Opens the daily missions (the scroll icon) and presses Claim All until nothing is left to claim.",
  run: async (phone, settings) => {
    const time = clock(settings.env.CLOCK);
    const rewards = rewardCounter(phone);

    const screen = async (s: State, { lines }: Seen): Next<State> => {
      if (await leaveRewards(phone, lines, rewards)) return s;

      if (has(lines, /^Growth$/i) && has(lines, /^Daily$/i)) {
        if (!s.tabbed) {
          await phone.tap(dailyTab);
          await sleep(1200);
          return { ...s, tabbed: true };
        }
        const claimAll = matching(lines, like("claim all", true));
        if (claimAll && s.claims < 6) {
          console.log(`${time()} claiming the daily rewards`);
          await phone.tap(center(claimAll));
          await sleep(2000);
          return { ...s, claims: s.claims + 1 };
        }
        await phone.tap(closeButton);
        await sleep(1500);
        return { ...s, leaving: true };
      }

      if (onWorld(lines)) {
        const done = s.claims ? "daily rewards claimed" : "nothing to claim in the daily missions";
        return openFromWorld(phone, s, scrollButton, 2000, done, "the daily missions did not open");
      }
    };

    await runFlow(phone, {
      name: "daily",
      lostMs: Number(settings.env.DAILY_LOST_SECONDS || 45) * 1000,
      start: { claims: 0, tabbed: false, opens: 0, leaving: false },
      screen,
      rewards,
    });
  },
};
