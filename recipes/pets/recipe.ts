import { clock } from "../../src/clock.ts";
import { fromPng, type Image, toPng } from "../../src/image.ts";
import type { TextLine } from "../../src/ocr.ts";
import type { Recipe } from "../../src/recipes.ts";
import { rewardCounter } from "../../src/rewards.ts";
import { center, exact, has, matching, screenWidth } from "../../src/screen.ts";
import { sleep } from "../../src/wda.ts";

const pawButton = { x: 369, y: 669 };
const beastCage = { x: 351, y: 795 };
const adventure = { x: 334, y: 795 };
const allyTreasure = { x: 351, y: 810 };
const closeTreasure = { x: 372, y: 217 };
const closeStamina = { x: 373, y: 175 };
const backArrow = { x: 30, y: 77 };
const treasureDot = { x: 1086, y: 2330, width: 60, height: 60 };
const buildDir = new URL("../../build/", import.meta.url);

const grid = [268, 348, 430, 512].flatMap((y) => [74, 155, 237, 318].map((x) => ({ x, y })));
const skills = [
  { name: "Scent Mastery", spot: { x: 318, y: 268 } },
  { name: "Gift of the King", spot: { x: 155, y: 348 } },
];

const hasRedDot = (img: Image, r: { x: number; y: number; width: number; height: number }) => {
  const red = Array.from({ length: r.width * r.height }, (_, i) => {
    const p = ((r.y + Math.floor(i / r.width)) * img.width + r.x + (i % r.width)) * img.channels;
    return img.data[p] > 200 && img.data[p + 1] < 80 && img.data[p + 2] < 80 ? 1 : 0;
  }).reduce((sum: number, n) => sum + n, 0);
  return red > 60;
};

const selectedSkill = (lines: TextLine[]) => lines.find((l) => center(l).y > 530 && center(l).y < 565 && /Lv/i.test(l.text))?.text ?? "";

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
      knownAt: number;
    };

    const press = async (line: TextLine) => {
      await phone.tap(center(line));
      await sleep(1500);
    };

    const step = async (s: State): Promise<string> => {
      const png = await phone.snap();
      const lines = await phone.ocrPng(png);
      const fresh = { ...s, knownAt: Date.now() };

      const exit = matching(lines, /tap anywhere to exit/i);
      if (exit) {
        if (exact(lines, "Rewards").length) await rewards.count(false);
        await press(exit);
        return step(fresh);
      }

      if (exact(lines, "Get More").length) {
        console.log(`${time()} not enough stamina to hunt`);
        await phone.tap(closeStamina);
        await sleep(1000);
        return step({ ...fresh, noStamina: true });
      }

      if (has(lines, /^Shared by/i)) {
        const claim = exact(lines, "Claim")[0];
        if (claim) await press(claim);
        if (!claim) {
          await phone.tap(has(lines, /treasures claimed/i) || has(lines, /x100|×100/i) ? { x: 346, y: 205 } : { x: 345, y: 302 });
          await sleep(1200);
        }
        return step(fresh);
      }

      if (has(lines, /^My Shares$/i) && has(lines, /^Alliance Shares$/i)) {
        const remaining = matching(lines, /Remaining claims today/i);
        if (!remaining) {
          const share = exact(lines, "Share")[0];
          if (share) {
            console.log(`${time()} sharing a treasure`);
            await press(share);
            return step(fresh);
          }
          await press(exact(lines, "Alliance Shares")[0]);
          return step(fresh);
        }
        const left = Number(remaining.text.replace(/O$/i, "0").match(/(\d+)\s*$/)?.[1] ?? 0);
        const claimAll = matching(lines, /^cla.m all$/i);
        const claim = claimAll ?? exact(lines, "Claim")[0];
        if (left > 0 && claim && s.claims < 20) {
          console.log(`${time()} ${claimAll ? "claiming all ally treasures" : "claiming an ally treasure"} (${left} left today)`);
          await press(claim);
          return step({ ...fresh, claims: s.claims + 1 });
        }
        await phone.tap(closeTreasure);
        await sleep(1000);
        return step({ ...fresh, treasureDone: true });
      }

      if (has(lines, /^Pet Skil/i)) {
        const wanted = skills[s.skill];
        if (s.skillsDone || !wanted) {
          await phone.tap(beastCage);
          await sleep(2500);
          return step({ ...fresh, skillsDone: true });
        }
        if (selectedSkill(lines).toLowerCase().includes(wanted.name.toLowerCase())) {
          const use = exact(lines, "Use")[0];
          const cooldown = matching(lines, /On cooldown/i);
          console.log(`${time()} ${wanted.name}: ${use ? "using it" : cooldown ? cooldown.text.trim().toLowerCase() : "not ready"}`);
          if (use) await press(use);
          return step({ ...fresh, skill: s.skill + 1, probe: -1 });
        }
        const spot = s.probe < 0 ? wanted.spot : grid[s.probe];
        if (!spot) {
          console.log(`${time()} ${wanted.name}: could not find it among the pet skills`);
          return step({ ...fresh, skill: s.skill + 1, probe: -1 });
        }
        await phone.tap(spot);
        await sleep(900);
        return step({ ...fresh, probe: s.probe + 1 });
      }

      if (has(lines, /^Pet Adventure$/i)) {
        const collect = matching(lines, /cla.m all|collect all/i);
        if (collect) {
          console.log(`${time()} collecting the adventure rewards`);
          await press(collect);
          return step(fresh);
        }
        const hunt = matching(lines, /hunt all/i);
        if (hunt && !s.noStamina && s.hunts < 3) {
          console.log(`${time()} sending the pets hunting`);
          await press(hunt);
          return step({ ...fresh, hunts: s.hunts + 1 });
        }
        if (!s.treasureDone && hasRedDot(fromPng(png), treasureDot)) {
          await phone.tap(allyTreasure);
          await sleep(1500);
          return step(fresh);
        }
        await phone.tap(backArrow);
        await sleep(2000);
        return step({ ...fresh, leaving: 1 });
      }

      if (has(lines, /^Pet List$/i) && has(lines, /^Skills$/i)) {
        await phone.tap(s.leaving ? backArrow : adventure);
        await sleep(2500);
        return step(s.leaving ? { ...fresh, leaving: 2 } : fresh);
      }

      if (has(lines, /^Town$/i) || has(lines, /^Conquest$/i)) {
        if (s.leaving) return "done";
        await phone.tap(pawButton);
        await sleep(1500);
        return step(fresh);
      }

      if (Date.now() - s.knownAt > lostMs) {
        await Deno.mkdir(buildDir, { recursive: true });
        await Deno.writeFile(new URL("pets-lost.png", buildDir), toPng(fromPng(png)));
        return "did not recognise the screen, see build/pets-lost.png";
      }
      await sleep(1000);
      return step(s);
    };

    const first = await phone.screenshot();
    if (first.width !== screenWidth) throw new Error(`this recipe only works on an iPhone 17 Pro`);
    const reason = await step({ skill: 0, probe: -1, skillsDone: false, hunts: 0, noStamina: false, treasureDone: false, claims: 0, leaving: 0, knownAt: Date.now() });
    console.log(`stopped: ${reason}`);
    rewards.print();
  },
};
