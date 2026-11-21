import { exitLine, type Next, openFromWorld, press, runFlow, type Seen } from "../../src/flow.ts";
import type { Recipe } from "../../src/recipe.ts";
import { rewardCounter } from "../../src/rewards.ts";
import { center, exact, has, matching } from "../../src/screen.ts";
import { clock, sleep } from "../../src/time.ts";
import { onWorld } from "../../src/world.ts";

const mailButton = { x: 369, y: 720 };
const closeButton = { x: 381, y: 75 };
const tabs = [
  { name: "Wars", x: 49 },
  { name: "Alliance", x: 126 },
  { name: "System", x: 201 },
  { name: "Reports", x: 277 },
  { name: "Starred", x: 352 },
];
const tabY = 121;

type State = { tab: number; shown: boolean; claimed: boolean; opens: number; leaving: boolean };

export const claimMail: Recipe = {
  description: "Opens the mail and presses Read & Claim All on each of the five tabs. Never deletes mail.",
  run: async (phone, settings) => {
    const time = clock(settings.env.CLOCK);
    const rewards = rewardCounter(phone);

    const screen = async (s: State, { lines }: Seen): Next<State> => {
      const exit = exitLine(lines);
      if (exit) {
        if (exact(lines, "Rewards").length) {
          console.log(`${time()} ${tabs[s.tab]?.name ?? "mail"}: claimed rewards`);
          await rewards.count(false);
        }
        await press(phone, exit);
        return s;
      }

      const claimAll = matching(lines, /read\s*&\s*claim all/i);
      if (has(lines, /^Wars$/i) && has(lines, /^Reports$/i) && has(lines, /^Starred$/i)) {
        const tab = tabs[s.tab];
        if (!tab) {
          await phone.tap(closeButton);
          await sleep(1500);
          return { ...s, leaving: true };
        }
        if (!s.shown) {
          await phone.tap({ x: tab.x, y: tabY });
          await sleep(1200);
          return { ...s, shown: true };
        }
        if (!s.claimed && claimAll) {
          await phone.tap(center(claimAll));
          await sleep(1500);
          return { ...s, claimed: true };
        }
        return { ...s, tab: s.tab + 1, shown: false, claimed: false };
      }

      if (exact(lines, "Chat").length && exact(lines, "Send").length) {
        await phone.tap(closeButton);
        await sleep(1500);
        return s;
      }

      if (onWorld(lines)) {
        return openFromWorld(phone, s, mailButton, 1500, "all five mail tabs claimed", "the mail did not open");
      }
    };

    await runFlow(phone, {
      name: "mail",
      lostMs: Number(settings.env.MAIL_LOST_SECONDS || 45) * 1000,
      start: { tab: 0, shown: false, claimed: false, opens: 0, leaving: false },
      screen,
      rewards,
    });
  },
};
