import { clock } from "../../src/clock.ts";
import { fromPng, toPng } from "../../src/image.ts";
import type { Recipe } from "../../src/recipes.ts";
import { rewardCounter } from "../../src/rewards.ts";
import { center, exact, has, matching, screenWidth } from "../../src/screen.ts";
import { sleep } from "../../src/wda.ts";

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
const buildDir = new URL("../../build/", import.meta.url);

export const claimMail: Recipe = {
  description: "Opens the mail and presses Read & Claim All on each of the five tabs. Never deletes mail.",
  run: async (phone, settings) => {
    const time = clock(settings.env.CLOCK);
    const lostMs = Number(settings.env.MAIL_LOST_SECONDS || 45) * 1000;
    const rewards = rewardCounter(phone);

    type State = { tab: number; shown: boolean; claimed: boolean; opens: number; leaving: boolean; knownAt: number };

    const step = async (s: State): Promise<string> => {
      const png = await phone.snap();
      const lines = await phone.ocrPng(png);
      const fresh = { ...s, knownAt: Date.now() };

      const exit = matching(lines, /tap anywhere to exit/i);
      if (exit) {
        if (exact(lines, "Rewards").length) {
          console.log(`${time()} ${tabs[s.tab]?.name ?? "mail"}: claimed rewards`);
          await rewards.count(false);
        }
        await phone.tap(center(exit));
        await sleep(1500);
        return step(fresh);
      }

      const claimAll = matching(lines, /read\s*&\s*claim all/i);
      if (has(lines, /^Wars$/i) && has(lines, /^Reports$/i) && has(lines, /^Starred$/i)) {
        const tab = tabs[s.tab];
        if (!tab) {
          await phone.tap(closeButton);
          await sleep(1500);
          return step({ ...fresh, leaving: true });
        }
        if (!s.shown) {
          await phone.tap({ x: tab.x, y: tabY });
          await sleep(1200);
          return step({ ...fresh, shown: true });
        }
        if (!s.claimed && claimAll) {
          await phone.tap(center(claimAll));
          await sleep(1500);
          return step({ ...fresh, claimed: true });
        }
        return step({ ...fresh, tab: s.tab + 1, shown: false, claimed: false });
      }

      if (exact(lines, "Chat").length && exact(lines, "Send").length) {
        await phone.tap(closeButton);
        await sleep(1500);
        return step(fresh);
      }

      if (has(lines, /^Town$/i) || has(lines, /^Conquest$/i)) {
        if (s.leaving) return "all five mail tabs claimed";
        if (s.opens >= 4) return "the mail did not open";
        await phone.tap(mailButton);
        await sleep(1500);
        return step({ ...fresh, opens: s.opens + 1 });
      }

      if (Date.now() - s.knownAt > lostMs) {
        await Deno.mkdir(buildDir, { recursive: true });
        await Deno.writeFile(new URL("mail-lost.png", buildDir), toPng(fromPng(png)));
        return "did not recognise the screen, see build/mail-lost.png";
      }
      await sleep(1000);
      return step(s);
    };

    const first = await phone.screenshot();
    if (first.width !== screenWidth) throw new Error(`this recipe only works on an iPhone 17 Pro`);
    const reason = await step({ tab: 0, shown: false, claimed: false, opens: 0, leaving: false, knownAt: Date.now() });
    console.log(`stopped: ${reason}`);
    rewards.print();
  },
};
