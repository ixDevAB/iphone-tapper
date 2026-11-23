import { decide } from "../../src/decisions.ts";
import { exitLine, look, requireIphone } from "../../src/flow.ts";
import { crop, type Image, scaleUp } from "../../src/image.ts";
import type { Phone } from "../../src/phone.ts";
import type { Recipe } from "../../src/recipe.ts";
import { rewardCounter } from "../../src/rewards.ts";
import { backArrow, center, points, scale } from "../../src/screen.ts";
import { clock, sleep } from "../../src/time.ts";
import { atTown } from "../../src/world.ts";
import { contentDots, isFreeLabel, redShapes, tabDots } from "./dots.ts";

const cartButton = { x: 343, y: 68 };
const exitSpot = { x: 200, y: 798 };
const tabY = 142;
const bands = [480, 1000, 1520, 1930];
const bandHeight = 620;
const price = /\d+[.,]\d\d\s*\S{0,3}$|[$€£]/;

const labelsIn = async (phone: Phone, img: Image) => {
  const found: { text: string; x: number; y: number }[] = [];
  for (const top of bands) {
    const height = Math.min(bandHeight, img.height - top);
    const lines = await phone.ocr(scaleUp(crop(img, { x: 0, y: top, width: img.width, height }), 2));
    for (const l of lines) {
      found.push({
        text: l.text.trim(),
        x: Math.round((l.x + l.width / 2) * points.width),
        y: Math.round((top + (l.y + l.height / 2) * height) / scale),
      });
    }
  }
  return found;
};

export const claimFreebies: Recipe = {
  description:
    "Opens the store (the shopping cart), goes through the tabs that have a red dot and claims what is marked Free or Claimable or has a red dot of its own. Never presses a button with a price.",
  run: async (phone, settings) => {
    const time = clock(settings.env.CLOCK);
    const rewards = rewardCounter(phone);
    const maxScrolls = Number(settings.env.FREEBIES_MAX_SCROLLS || 8);
    const log = (text: string) => console.log(`${time()} ${text}`);

    const dismiss = async () => {
      const { lines } = await look(phone);
      if (!exitLine(lines)) return false;
      await rewards.count(false);
      await phone.tap(exitSpot);
      await sleep(1500);
      return true;
    };

    type Spot = { x: number; y: number };
    const close = (a: Spot, b: Spot) => Math.abs(a.x - b.x) < 12 && Math.abs(a.y - b.y) < 12;

    const targetsOn = async () => {
      const { img } = await look(phone);
      const labels = await labelsIn(phone, img());
      const prices = labels.filter((l) => price.test(l.text));
      const priced = (spot: Spot) => prices.some((p) => Math.abs(p.y - spot.y) < 45 && Math.abs(p.x - spot.x) < 110);
      const byLabel = labels
        .filter((l) => isFreeLabel(l.text) && !priced(l))
        .map((l) => ({
          why: `the label "${l.text}"`,
          at: { x: l.x, y: l.y },
          tap: { x: l.x, y: l.y - 20 },
          onLabel: true,
        }));
      const byDot = contentDots(redShapes(img()))
        .map((dot) => ({ why: "a red dot", at: dot, tap: { x: dot.x - 14, y: dot.y + 12 }, onLabel: false }))
        .filter((t) =>
          !priced(t.tap) && !byLabel.some((l) => Math.abs(l.tap.x - t.tap.x) < 40 && Math.abs(l.tap.y - t.tap.y) < 40)
        );
      return { targets: [...byLabel, ...byDot], seen: labels.map((l) => l.text.replace(/\d/g, "")).join("|") };
    };

    const claimOnTab = async (
      claimed: number,
      tries: number,
      scrolls: number,
      lastSeen: string,
      tried: Spot[],
    ): Promise<number> => {
      if (await dismiss()) return claimOnTab(claimed, tries, scrolls, lastSeen, tried);
      const { targets, seen } = await targetsOn();
      const moved = lastSeen !== "" && seen !== lastSeen;
      const before = moved ? [] : tried;
      const times = (at: Spot) => before.filter((spot) => close(spot, at)).length;
      const target = targets.find((t) => times(t.at) < (t.onLabel ? 2 : 1));
      if (!target || tries <= 0) {
        if (scrolls >= maxScrolls || seen === lastSeen) return claimed;
        await phone.drag({ x: 12, y: 700 }, { x: 12, y: 300 }, 0.8);
        await sleep(1500);
        return claimOnTab(claimed, tries, scrolls + 1, seen, before);
      }
      const spot = times(target.at) === 0 ? target.tap : target.at;
      log(`claiming at ${target.why}${spot === target.at ? ", this time on the label itself" : ""}`);
      await decide("tapped something free", { why: target.why, x: spot.x, y: spot.y });
      await phone.tap(spot);
      await sleep(2000);
      const popup = await dismiss();
      const after = await targetsOn();
      const gone = !after.targets.some((t) => close(t.at, target.at));
      await decide(gone || popup ? "it was claimed" : "it is still there", { why: target.why });
      return claimOnTab(claimed + (gone || popup ? 1 : 0), tries - 1, scrolls, "", [...before, target.at]);
    };

    const pages = async (page: number, total: number, lastBar: string): Promise<number> => {
      const { lines } = await look(phone);
      const names = lines.filter((l) => center(l).y > 125 && center(l).y < 165).map((l) => l.text).join("|");
      if (page >= 8 || (page > 0 && names === lastBar)) return total;
      const visit = async (done: number[], sum: number): Promise<number> => {
        const dot = tabDots(redShapes((await look(phone)).img())).find((x) => !done.some((d) => Math.abs(d - x) < 30));
        if (dot === undefined || done.length >= 5) return sum;
        await decide("opening a store tab with a red dot", { x: dot });
        await phone.tap({ x: Math.max(30, dot - 20), y: tabY });
        await sleep(2000);
        return visit([...done, dot], sum + await claimOnTab(0, 6, 0, "", []));
      };
      const claimed = await visit([], 0);
      await phone.drag({ x: 330, y: 138 }, { x: 90, y: 138 }, 0.6);
      await sleep(1500);
      return pages(page + 1, total + claimed, names);
    };

    await requireIphone(phone);
    const start = await look(phone);
    if (!atTown(start.lines)) throw new Error("start on the world map");
    await phone.tap(cartButton);
    await sleep(3000);
    for (const _ of [1, 2, 3]) {
      await phone.drag({ x: 90, y: 138 }, { x: 330, y: 138 }, 0.4);
      await sleep(700);
    }
    const total = await pages(0, 0, "");
    await dismiss();
    await phone.tap(backArrow);
    await sleep(1500);
    console.log(`stopped: ${total} free ${total === 1 ? "item" : "items"} claimed`);
    rewards.print();
  },
};
