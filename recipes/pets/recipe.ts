import { hasRedDot } from "../../src/dots.ts";
import { leaveRewards, type Next, press, runFlow, type Seen } from "../../src/flow.ts";
import type { TextLine } from "../../src/ocr.ts";
import type { Recipe } from "../../src/recipe.ts";
import { rewardCounter } from "../../src/rewards.ts";
import { backArrow, center, closeDialog, exact, has, like, matching } from "../../src/screen.ts";
import { clock, sleep } from "../../src/time.ts";
import { onWorld } from "../../src/world.ts";

const pawButton = { x: 369, y: 669 };
const beastCage = { x: 351, y: 795 };
const adventure = { x: 334, y: 795 };
export const huntAll = /^\W*\w?[uo]nt\s*a[il1|]{1,2}\W*$/i;
const allyTreasure = { x: 351, y: 810 };
const closeTreasure = { x: 372, y: 217 };
const treasureDot = { x: 1086, y: 2330, width: 60, height: 60 };

const grid = [268, 348, 430, 512].flatMap((y) => [74, 155, 237, 318].map((x) => ({ x, y })));
const skills = [
  { name: "Scent Mastery", spot: { x: 318, y: 268 } },
  { name: "Gift of the King", spot: { x: 155, y: 348 } },
];

const selectedSkill = (lines: TextLine[]) =>
  lines.find((l) => center(l).y > 530 && center(l).y < 565 && /Lv/i.test(l.text))?.text ?? "";

export const collectPet: Recipe = {
  description:
    "Uses the pet skills Scent Mastery and Gift of the King when they are ready, then collects and starts pet adventures and shares and claims ally treasure.",
  run: async (phone, settings) => {
    const time = clock(settings.env.CLOCK);
    const lostMs = Number(settings.env.PETS_LOST_SECONDS || 45) * 1000;
    const rewards = rewardCounter(phone);

    type State = {
      skill: number;
      probe: number;
      skillsDone: boolean;
      hunts: number;
      noStamina: boolean;
      treasureDone: boolean;
      claims: number;
      leaving: number;
    };

    const screen = async (s: State, { lines, img }: Seen): Next<State> => {
      if (await leaveRewards(phone, lines, rewards)) return s;

      if (exact(lines, "Get More").length) {
        console.log(`${time()} not enough stamina to hunt`);
        await phone.tap(closeDialog);
        await sleep(1000);
        return { ...s, noStamina: true };
      }

      if (has(lines, /^Shared by/i)) {
        const claim = exact(lines, "Claim")[0];
        if (claim) await press(phone, claim);
        if (!claim) {
          await phone.tap(
            has(lines, /treasures claimed/i) || has(lines, /x100|×100/i) ? { x: 346, y: 205 } : { x: 345, y: 302 },
          );
          await sleep(1200);
        }
        return s;
      }

      if (has(lines, /^My Shares$/i) && has(lines, /^Alliance Shares$/i)) {
        const remaining = matching(lines, /Remaining claims today/i);
        if (!remaining) {
          const share = exact(lines, "Share")[0];
          if (share) {
            console.log(`${time()} sharing a treasure`);
            await press(phone, share);
            return s;
          }
          await press(phone, exact(lines, "Alliance Shares")[0]);
          return s;
        }
        const left = Number(remaining.text.replace(/O$/i, "0").match(/(\d+)\s*$/)?.[1] ?? 0);
        const claimAll = matching(lines, like("claim all", true));
        const claim = claimAll ?? exact(lines, "Claim")[0];
        if (left > 0 && claim && s.claims < 20) {
          console.log(
            `${time()} ${claimAll ? "claiming all ally treasures" : "claiming an ally treasure"} (${left} left today)`,
          );
          await press(phone, claim);
          return { ...s, claims: s.claims + 1 };
        }
        await phone.tap(closeTreasure);
        await sleep(1000);
        return { ...s, treasureDone: true };
      }

      if (has(lines, /^Pet Skil/i)) {
        const wanted = skills[s.skill];
        if (s.skillsDone || !wanted) {
          await phone.tap(beastCage);
          await sleep(2500);
          return { ...s, skillsDone: true };
        }
        if (selectedSkill(lines).toLowerCase().includes(wanted.name.toLowerCase())) {
          const use = exact(lines, "Use")[0];
          const cooldown = matching(lines, /On cooldown/i);
          console.log(
            `${time()} ${wanted.name}: ${
              use ? "using it" : cooldown ? cooldown.text.trim().toLowerCase() : "not ready"
            }`,
          );
          if (use) await press(phone, use);
          return { ...s, skill: s.skill + 1, probe: -1 };
        }
        const spot = s.probe < 0 ? wanted.spot : grid[s.probe];
        if (!spot) {
          console.log(`${time()} ${wanted.name}: could not find it among the pet skills`);
          return { ...s, skill: s.skill + 1, probe: -1 };
        }
        await phone.tap(spot);
        await sleep(900);
        return { ...s, probe: s.probe + 1 };
      }

      if (has(lines, /^Pet Adventure$/i)) {
        const collect = matching(lines, like("claim all")) ?? matching(lines, like("collect all"));
        if (collect) {
          console.log(`${time()} collecting the adventure rewards`);
          await press(phone, collect);
          return s;
        }
        const hunt = matching(lines, huntAll);
        if (hunt && !s.noStamina && s.hunts < 3) {
          console.log(`${time()} sending the pets hunting`);
          await press(phone, hunt);
          return { ...s, hunts: s.hunts + 1 };
        }
        if (!s.treasureDone && hasRedDot(img(), treasureDot, 60)) {
          await phone.tap(allyTreasure);
          await sleep(1500);
          return s;
        }
        await phone.tap(backArrow);
        await sleep(2000);
        return { ...s, leaving: 1 };
      }

      if (has(lines, /^Pet List$/i) && has(lines, /^Skills$/i)) {
        await phone.tap(s.leaving ? backArrow : adventure);
        await sleep(2500);
        return s.leaving ? { ...s, leaving: 2 } : s;
      }

      if (onWorld(lines)) {
        if (s.leaving) return "done";
        await phone.tap(pawButton);
        await sleep(1500);
        return s;
      }
    };

    await runFlow(phone, {
      name: "pets",
      lostMs,
      start: {
        skill: 0,
        probe: -1,
        skillsDone: false,
        hunts: 0,
        noStamina: false,
        treasureDone: false,
        claims: 0,
        leaving: 0,
      },
      screen,
      rewards,
    });
  },
};
