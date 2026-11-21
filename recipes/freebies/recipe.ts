import { isRed } from "../../src/dots.ts";
import { exitLine, look, requireIphone } from "../../src/flow.ts";
import { crop, type Image, scaleUp } from "../../src/image.ts";
import type { Phone } from "../../src/phone.ts";
import { count } from "../../src/pixels.ts";
import type { Recipe } from "../../src/recipe.ts";
import { rewardCounter } from "../../src/rewards.ts";
import { backArrow, center, points, scale } from "../../src/screen.ts";
import { clock, sleep } from "../../src/time.ts";
import { atTown } from "../../src/world.ts";

const cartButton = { x: 343, y: 68 };
const exitSpot = { x: 200, y: 798 };
const tabY = 142;
const bar = { top: 375, bottom: 495 };
const bands = [480, 1000, 1520, 1930];
const bandHeight = 620;
const price = /\d+[.,]\d\d\s*\S{0,3}$|[$€£]/;

const redDots = (img: Image) =>
  Array.from(
    { length: img.width },
    (_, x) => count(img, { x, y: bar.top, width: 1, height: bar.bottom - bar.top }, isRed),
  )
    .flatMap((reds, x) => reds >= 6 ? [x] : [])
    .reduce<number[][]>(
      (groups, x) =>
        groups.length && x - groups[groups.length - 1].at(-1)! <= 3
          ? [...groups.slice(0, -1), [...groups[groups.length - 1], x]]
          : [...groups, [x]],
      [],
    )
    .filter((group) => group.length >= 12 && group.length <= 60)
    .map((group) => Math.round((group[0] + group[group.length - 1]) / 2 / scale));

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
    "Opens the store (the shopping cart), goes through the tabs that have a red dot and claims what is marked Free or Claimable. Never presses a button with a price.",
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

    const claimOnTab = async (claimed: number, tries: number, scrolls = 0, lastSeen = ""): Promise<number> => {
      if (tries <= 0) return claimed;
      if (await dismiss()) return claimOnTab(claimed, tries, scrolls, lastSeen);
      const { img } = await look(phone);
      const labels = await labelsIn(phone, img());
      const seen = labels.map((l) => l.text).join("|");
      const prices = labels.filter((l) => price.test(l.text));
      const free = labels.find((l) =>
        /^(free|claimable|claim)$/i.test(l.text) &&
        !prices.some((p) => Math.abs(p.y - l.y) < 45 && Math.abs(p.x - l.x) < 110)
      );
      if (!free) {
        if (scrolls >= maxScrolls || seen === lastSeen) return claimed;
        await phone.drag({ x: 12, y: 700 }, { x: 12, y: 300 }, 0.8);
        await sleep(1500);
        return claimOnTab(claimed, tries, scrolls + 1, seen);
      }
      log(`claiming "${free.text}"`);
      await phone.tap({ x: free.x, y: free.y - 20 });
      await sleep(2000);
      await dismiss();
      return claimOnTab(claimed + 1, tries - 1, scrolls, "");
    };

    const pages = async (page: number, total: number, lastBar: string): Promise<number> => {
      const { img, lines } = await look(phone);
      const names = lines.filter((l) => center(l).y > 125 && center(l).y < 165).map((l) => l.text).join("|");
      if (page >= 7 || (page > 0 && names === lastBar)) return total;
      const dots = redDots(img());
      const visit = async (index: number, sum: number): Promise<number> => {
        const dot = dots[index];
        if (dot === undefined) return sum;
        await phone.tap({ x: Math.max(40, dot - 45), y: tabY });
        await sleep(2000);
        return visit(index + 1, sum + await claimOnTab(0, 8));
      };
      const claimed = await visit(0, 0);
      await phone.drag({ x: 330, y: 138 }, { x: 90, y: 138 }, 0.6);
      await sleep(1500);
      return pages(page + 1, total + claimed, names);
    };

    await requireIphone(phone);
    const start = await look(phone);
    if (!atTown(start.lines)) throw new Error("start on the world map");
    await phone.tap(cartButton);
    await sleep(3000);
    const total = await pages(0, 0, "");
    await dismiss();
    await phone.tap(backArrow);
    await sleep(1500);
    console.log(`stopped: ${total} free ${total === 1 ? "item" : "items"} claimed`);
    rewards.print();
  },
};
