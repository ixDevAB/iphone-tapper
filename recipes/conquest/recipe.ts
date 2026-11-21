import { hasRedDot } from "../../src/dots.ts";
import { exitLine, type Next, openFromWorld, press, runFlow, type Seen } from "../../src/flow.ts";
import { on, type Recipe } from "../../src/recipe.ts";
import { rewardCounter } from "../../src/rewards.ts";
import { backArrow, center, exact, has, matching } from "../../src/screen.ts";
import { clock, sleep } from "../../src/time.ts";
import { atTown } from "../../src/world.ts";

const conquestButton = { x: 40, y: 825 };
const closeIdle = { x: 352, y: 259 };
const conquestDot = { x: 140, y: 2375, width: 50, height: 45 };

type State = { chest: number; claimed: number; opens: number; leaving: boolean };

export const collectConquest: Recipe = {
  description:
    "Claims the Conquest idle income when the Conquest button has a red dot. With --force it claims even without the dot.",
  switches: { "--force": "CONQUEST_FORCE" },
  run: async (phone, settings) => {
    const time = clock(settings.env.CLOCK);
    const force = on(settings.env, "CONQUEST_FORCE");
    const rewards = rewardCounter(phone);

    const screen = async (s: State, { lines, img }: Seen): Next<State> => {
      const exit = exitLine(lines);
      if (exit) {
        if (exact(lines, "Rewards").some((l) => center(l).y < 300)) await rewards.count(false);
        await press(phone, exit);
        return s;
      }

      if (exact(lines, "Idle Income").length) {
        const claim = exact(lines, "Claim").find((l) => center(l).x < 280);
        if (claim && s.claimed < 2) {
          const idle = matching(lines, /^\d\d:\d\d:\d\d/)?.text.trim();
          console.log(`${time()} claiming the idle income${idle ? ` (${idle})` : ""}`);
          await phone.tap(center(claim));
          await sleep(2000);
          return { ...s, claimed: s.claimed + 1 };
        }
        await phone.tap(closeIdle);
        await sleep(1500);
        return { ...s, leaving: true };
      }

      if (exact(lines, "Conquer").length && has(lines, /^Conquest$/i)) {
        const claim = exact(lines, "Claim")[0];
        if (claim && !s.leaving && !s.claimed && s.chest < 2) {
          await press(phone, claim);
          return { ...s, chest: s.chest + 1 };
        }
        await phone.tap(backArrow);
        await sleep(1500);
        return { ...s, leaving: true };
      }

      if (atTown(lines)) {
        if (!s.leaving && !force && !hasRedDot(img(), conquestDot)) {
          return "conquest has no red dot, add --force to claim anyway";
        }
        const done = s.claimed ? "conquest idle income claimed" : "nothing claimed in conquest";
        return openFromWorld(phone, s, conquestButton, 3000, done, "conquest did not open");
      }
    };

    await runFlow(phone, {
      name: "conquest",
      lostMs: Number(settings.env.CONQUEST_LOST_SECONDS || 45) * 1000,
      start: { chest: 0, claimed: 0, opens: 0, leaving: false },
      screen,
      rewards,
    });
  },
};
