import { hasRedDot } from "../../src/dots.ts";
import { leaveRewards, type Next, openFromWorld, press, runFlow, type Seen } from "../../src/flow.ts";
import type { Recipe } from "../../src/recipe.ts";
import { rewardCounter } from "../../src/rewards.ts";
import { backArrow, center, closeDialog, exact, has, matching } from "../../src/screen.ts";
import { clock, sleep } from "../../src/time.ts";
import { onWorld } from "../../src/world.ts";

const vipButton = { x: 369, y: 98 };
const chest = { x: 349, y: 210 };
const plus = { x: 295, y: 211 };
const chestDot = { x: 1071, y: 557, width: 50, height: 50 };
const plusDot = { x: 895, y: 569, width: 50, height: 50 };

type State = {
  bundle: number;
  chest: number;
  plus: number;
  uses: number;
  opens: number;
  leaving: boolean;
  continues: number;
};

export const claimVip: Recipe = {
  description:
    "Opens the VIP screen and claims what has a red dot: the daily free bundle, the daily sign-in chest, and it uses the VIP XP items you own. Never presses Buy & Use.",
  run: async (phone, settings) => {
    const time = clock(settings.env.CLOCK);
    const rewards = rewardCounter(phone);
    const log = (text: string) => console.log(`${time()} ${text}`);

    const screen = async (s: State, { lines, img }: Seen): Next<State> => {
      if (await leaveRewards(phone, lines, rewards)) return s;

      const next = matching(lines, /click to continue/i);
      if (next) {
        const xp = matching(lines, /Get VIP XP/i)?.text.trim();
        if (xp && !s.continues) log(`sign-in chest: ${xp}`);
        if (s.continues >= 8) return "the sign-in rewards would not close, close them by hand";
        await phone.tap({ x: center(next).x, y: center(next).y - 150 });
        await sleep(1500);
        return { ...s, continues: s.continues + 1 };
      }

      if (exact(lines, "Increase Level").length) {
        const use = exact(lines, "Use")[0];
        const all = use
          ? lines.find((l) =>
            /^[×x]\s*[\d,]+$/i.test(l.text.trim()) && Math.abs(center(l).y - center(use).y) < 12 &&
            center(l).x < center(use).x - 40
          )
          : undefined;
        if (use && s.uses < 12) {
          if (all) log(`using ${all.text.trim().replace(/^[×x]\s*/i, "")} VIP XP items`);
          await press(phone, all ?? use);
          return { ...s, uses: s.uses + 1 };
        }
        await phone.tap(closeDialog);
        await sleep(1500);
        return { ...s, plus: 9 };
      }

      if (has(lines, /^Current Level: VIP/i)) {
        if (s.leaving) {
          await phone.tap(backArrow);
          await sleep(1500);
          return s;
        }
        const claim = exact(lines, "Claim")[0];
        if (claim && s.bundle < 2) {
          log("claiming the daily free bundle");
          await press(phone, claim);
          return { ...s, bundle: s.bundle + 1 };
        }
        if (hasRedDot(img(), chestDot) && s.chest < 2) {
          await phone.tap(chest);
          await sleep(1500);
          return { ...s, chest: s.chest + 1 };
        }
        if (hasRedDot(img(), plusDot) && s.plus < 2) {
          await phone.tap(plus);
          await sleep(1500);
          return { ...s, plus: s.plus + 1 };
        }
        return { ...s, leaving: true };
      }

      if (onWorld(lines)) return openFromWorld(phone, s, vipButton, 2500, "vip claimed", "the vip screen did not open");
    };

    await runFlow(phone, {
      name: "vip",
      lostMs: Number(settings.env.VIP_LOST_SECONDS || 45) * 1000,
      start: { bundle: 0, chest: 0, plus: 0, uses: 0, opens: 0, leaving: false, continues: 0 },
      screen,
      rewards,
    });
  },
};
