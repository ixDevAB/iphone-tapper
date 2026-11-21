import { hasRedDot } from "../../src/dots.ts";
import { leaveRewards, type Next, openFromWorld, runFlow, type Seen } from "../../src/flow.ts";
import type { TextLine } from "../../src/ocr.ts";
import type { Recipe } from "../../src/recipe.ts";
import { rewardCounter } from "../../src/rewards.ts";
import { backArrow, center, exact, has, like, matching } from "../../src/screen.ts";
import { clock, sleep } from "../../src/time.ts";
import { onWorld } from "../../src/world.ts";

const allianceButton = { x: 299, y: 825 };
const battleTab = { x: 327, y: 208 };
const closeCovenant = { x: 357, y: 205 };
const bigChest = { x: 200, y: 165 };
const bigChestDot = { x: 700, y: 370, width: 110, height: 100 };

const chestSteps = [
  { tab: "Alliance Gift", claim: false },
  { tab: "Alliance Gift", claim: true },
  { tab: "Loot Chest", claim: false },
  { tab: "Loot Chest", claim: true },
];

const titled = (lines: TextLine[], title: string) => exact(lines, title).some((l) => center(l).y < 95);

export const claimAlliance: Recipe = {
  description:
    "Claims the alliance chests (Alliance Gift and Loot Chest) and contributes bread to Covenant-Making until no attempts are left. Never spends gems.",
  run: async (phone, settings) => {
    const time = clock(settings.env.CLOCK);
    const lostMs = Number(settings.env.ALLIANCE_LOST_SECONDS || 45) * 1000;
    const rewards = rewardCounter(phone);
    const log = (text: string) => console.log(`${time()} ${text}`);

    type State = {
      chest: number;
      bigChest: number;
      techDone: boolean;
      battleTried: boolean;
      contributed: number;
      opens: number;
      leaving: boolean;
    };

    const screen = async (s: State, { lines, img }: Seen): Next<State> => {
      const chestsDone = s.chest >= chestSteps.length;

      if (await leaveRewards(phone, lines, rewards)) return s;

      const attempts = lines.filter((l) => center(l).x > 200).map((l) =>
        l.text.match(/Attempts:\s*(\d+)\s*\/\s*(\d+)/i)
      ).find((m) => m);
      if (exact(lines, "Covenant-Making").some((l) => center(l).y < 260) && has(lines, /Attempts/i)) {
        const left = attempts ? Number(attempts[1]) : 0;
        const contribute = exact(lines, "Contribute").find((l) => center(l).x > 200);
        if (left > 0 && contribute && s.contributed < 40) {
          await phone.tap(center(contribute));
          await sleep(900);
          return { ...s, contributed: s.contributed + 1 };
        }
        log(
          `contributed ${s.contributed} ${s.contributed === 1 ? "time" : "times"} to Covenant-Making${
            attempts ? `, attempts left ${attempts[1]}/${attempts[2]}` : ", could not read the attempts"
          }`,
        );
        await phone.tap(closeCovenant);
        await sleep(1200);
        return { ...s, techDone: true };
      }

      if (titled(lines, "Tech")) {
        if (s.techDone) {
          await phone.tap(backArrow);
          await sleep(1500);
          return s;
        }
        const covenant = exact(lines, "Covenant-Making")[0];
        if (covenant) {
          await phone.tap({ x: center(covenant).x, y: center(covenant).y - 54 });
          await sleep(1500);
          return s;
        }
        if (s.battleTried) {
          log("could not find Covenant-Making in the alliance tech");
          return { ...s, techDone: true };
        }
        await phone.tap(battleTab);
        await sleep(1500);
        return { ...s, battleTried: true };
      }

      if (titled(lines, "Chests")) {
        if (s.bigChest < 2 && hasRedDot(img(), bigChestDot)) {
          log("opening the alliance chest");
          await phone.tap(bigChest);
          await sleep(2000);
          return { ...s, bigChest: s.bigChest + 1 };
        }
        const current = chestSteps[s.chest];
        if (!current) {
          await phone.tap(backArrow);
          await sleep(1500);
          return s;
        }
        const tab = exact(lines, current.tab).find((l) => center(l).y < 300);
        const claimAll = matching(lines, like("claim all", true));
        if (!current.claim && tab) await phone.tap(center(tab));
        if (current.claim && claimAll) {
          log(`${current.tab}: claiming all`);
          await phone.tap(center(claimAll));
        }
        await sleep(1500);
        return { ...s, chest: s.chest + 1 };
      }

      if (titled(lines, "Alliance") && has(lines, /^Chests$/i) && has(lines, /^Tech$/i)) {
        const next = !chestsDone ? exact(lines, "Chests")[0] : !s.techDone ? exact(lines, "Tech")[0] : undefined;
        if (next) {
          await phone.tap(center(next));
          await sleep(1500);
          return s;
        }
        await phone.tap(backArrow);
        await sleep(1500);
        return { ...s, leaving: true };
      }

      if (onWorld(lines)) {
        return openFromWorld(
          phone,
          s,
          allianceButton,
          1500,
          "alliance chests claimed and contributions made",
          "the alliance screen did not open",
        );
      }
    };

    await runFlow(phone, {
      name: "alliance",
      lostMs,
      start: { chest: 0, bigChest: 0, techDone: false, battleTried: false, contributed: 0, opens: 0, leaving: false },
      screen,
      rewards,
    });
  },
};
