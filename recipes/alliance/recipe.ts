import { clock } from "../../src/clock.ts";
import { hasRedDot } from "../../src/dots.ts";
import { fromPng, toPng } from "../../src/image.ts";
import type { TextLine } from "../../src/ocr.ts";
import type { Recipe } from "../../src/recipes.ts";
import { rewardCounter } from "../../src/rewards.ts";
import { center, exact, has, matching, screenWidth } from "../../src/screen.ts";
import { sleep } from "../../src/wda.ts";

const allianceButton = { x: 299, y: 825 };
const backArrow = { x: 30, y: 77 };
const battleTab = { x: 327, y: 208 };
const closeCovenant = { x: 357, y: 205 };
const bigChest = { x: 200, y: 165 };
const bigChestDot = { x: 700, y: 370, width: 110, height: 100 };
const buildDir = new URL("../../build/", import.meta.url);

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
      knownAt: number;
    };

    const step = async (s: State): Promise<string> => {
      const png = await phone.snap();
      const lines = await phone.ocrPng(png);
      const fresh = { ...s, knownAt: Date.now() };
      const chestsDone = s.chest >= chestSteps.length;

      const exit = matching(lines, /tap anywhere to exit/i);
      if (exit) {
        if (exact(lines, "Rewards").length) await rewards.count(false);
        await phone.tap(center(exit));
        await sleep(1500);
        return step(fresh);
      }

      const attempts = lines.filter((l) => center(l).x > 200).map((l) => l.text.match(/Attempts:\s*(\d+)\s*\/\s*(\d+)/i)).find((m) => m);
      if (exact(lines, "Covenant-Making").some((l) => center(l).y < 260) && has(lines, /Attempts/i)) {
        const left = attempts ? Number(attempts[1]) : 0;
        const contribute = exact(lines, "Contribute").find((l) => center(l).x > 200);
        if (left > 0 && contribute && s.contributed < 40) {
          await phone.tap(center(contribute));
          await sleep(900);
          return step({ ...fresh, contributed: s.contributed + 1 });
        }
        log(`contributed ${s.contributed} ${s.contributed === 1 ? "time" : "times"} to Covenant-Making${attempts ? `, attempts left ${attempts[1]}/${attempts[2]}` : ", could not read the attempts"}`);
        await phone.tap(closeCovenant);
        await sleep(1200);
        return step({ ...fresh, techDone: true });
      }

      if (titled(lines, "Tech")) {
        if (s.techDone) {
          await phone.tap(backArrow);
          await sleep(1500);
          return step(fresh);
        }
        const covenant = exact(lines, "Covenant-Making")[0];
        if (covenant) {
          await phone.tap({ x: center(covenant).x, y: center(covenant).y - 54 });
          await sleep(1500);
          return step(fresh);
        }
        if (s.battleTried) {
          log("could not find Covenant-Making in the alliance tech");
          return step({ ...fresh, techDone: true });
        }
        await phone.tap(battleTab);
        await sleep(1500);
        return step({ ...fresh, battleTried: true });
      }

      if (titled(lines, "Chests")) {
        if (s.bigChest < 2 && hasRedDot(fromPng(png), bigChestDot)) {
          log("opening the alliance chest");
          await phone.tap(bigChest);
          await sleep(2000);
          return step({ ...fresh, bigChest: s.bigChest + 1 });
        }
        const current = chestSteps[s.chest];
        if (!current) {
          await phone.tap(backArrow);
          await sleep(1500);
          return step(fresh);
        }
        const tab = exact(lines, current.tab).find((l) => center(l).y < 300);
        const claimAll = matching(lines, /^claim all$/i);
        if (!current.claim && tab) await phone.tap(center(tab));
        if (current.claim && claimAll) {
          log(`${current.tab}: claiming all`);
          await phone.tap(center(claimAll));
        }
        await sleep(1500);
        return step({ ...fresh, chest: s.chest + 1 });
      }

      if (titled(lines, "Alliance") && has(lines, /^Chests$/i) && has(lines, /^Tech$/i)) {
        const next = !chestsDone ? exact(lines, "Chests")[0] : !s.techDone ? exact(lines, "Tech")[0] : undefined;
        if (next) {
          await phone.tap(center(next));
          await sleep(1500);
          return step(fresh);
        }
        await phone.tap(backArrow);
        await sleep(1500);
        return step({ ...fresh, leaving: true });
      }

      if (has(lines, /^Town$/i) || has(lines, /^Conquest$/i)) {
        if (s.leaving) return "alliance chests claimed and contributions made";
        if (s.opens >= 4) return "the alliance screen did not open";
        await phone.tap(allianceButton);
        await sleep(1500);
        return step({ ...fresh, opens: s.opens + 1 });
      }

      if (Date.now() - s.knownAt > lostMs) {
        await Deno.mkdir(buildDir, { recursive: true });
        await Deno.writeFile(new URL("alliance-lost.png", buildDir), toPng(fromPng(png)));
        return "did not recognise the screen, see build/alliance-lost.png";
      }
      await sleep(1000);
      return step(s);
    };

    const first = await phone.screenshot();
    if (first.width !== screenWidth) throw new Error(`this recipe only works on an iPhone 17 Pro`);
    const reason = await step({ chest: 0, bigChest: 0, techDone: false, battleTried: false, contributed: 0, opens: 0, leaving: false, knownAt: Date.now() });
    console.log(`stopped: ${reason}`);
    rewards.print();
  },
};
