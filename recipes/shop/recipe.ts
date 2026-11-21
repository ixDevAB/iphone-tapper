import { clock } from "../../src/clock.ts";
import { fromPng, toPng } from "../../src/image.ts";
import type { Recipe } from "../../src/recipes.ts";
import { center, exact, has, matching, screenWidth } from "../../src/screen.ts";
import { sleep } from "../../src/wda.ts";
import { blueShare, slotsIn } from "./slots.ts";

const shopButton = { x: 233, y: 825 };
const backArrow = { x: 30, y: 77 };
const closeBuy = { x: 365, y: 328 };
const buyButton = { x: 200, y: 553 };
const buildDir = new URL("../../build/", import.meta.url);

const secondsIn = (text: string) => text.split(":").map(Number).reduce((sum, n) => sum * 60 + n, 0);

export const shop: Recipe = {
  description:
    "Nomadic Merchant: buys every item that costs resources, then presses Free Refresh and repeats. With --buy-vip it also buys the VIP XP item (the yellow V) for gems. Buys nothing else with gems.",
  run: async (phone, settings) => {
    const time = clock(settings.env.CLOCK);
    const buyVip = Deno.args.includes("--buy-vip") || settings.env.SHOP_BUY_VIP === "1";
    const lostMs = Number(settings.env.SHOP_LOST_SECONDS || 45) * 1000;
    const maxBuys = Number(settings.env.SHOP_MAX_BUYS || 200);
    const log = (text: string) => console.log(`${time()} ${text}`);

    const refreshIn: { seconds?: number } = {};

    type State = { bought: number; vip: number; refreshes: number; expect?: "rss" | "vip"; opens: number; leaving: boolean; looks: number; knownAt: number };

    const summary = (s: State) =>
      `${s.bought} bought with resources, ${buyVip ? `${s.vip} VIP XP bought with gems, ` : ""}${s.refreshes} free ${s.refreshes === 1 ? "refresh" : "refreshes"}`;

    const step = async (s: State): Promise<string> => {
      const png = await phone.snap();
      const lines = await phone.ocrPng(png);
      const fresh = { ...s, knownAt: Date.now() };

      const exit = matching(lines, /tap anywhere to exit/i);
      if (exit) {
        await phone.tap(center(exit));
        await sleep(1200);
        return step(fresh);
      }

      if (exact(lines, "Buy").some((l) => center(l).y < 360) && !has(lines, /^Free Refresh$/i)) {
        const gems = blueShare(fromPng(png), buyButton.x * 3 - 200, buyButton.y * 3 - 60, 400, 120) > 0.01;
        const allowed = s.expect === "vip" ? buyVip && has(lines, /VIP XP/i) : s.expect === "rss" ? !gems : false;
        await phone.tap(allowed ? buyButton : closeBuy);
        await sleep(1500);
        if (!allowed) return `stopped at a purchase it is not allowed to make, ${summary(s)}`;
        return step({ ...fresh, expect: undefined });
      }

      if (has(lines, /^Nomadic$/i) && has(lines, /Refreshes in/i)) {
        if (s.leaving) {
          await phone.tap(backArrow);
          await sleep(1500);
          return step(fresh);
        }
        const slots = slotsIn(fromPng(png)).filter((slot) => slot.present);
        const wanted = slots.find((slot) => !slot.diamonds) ?? (buyVip ? slots.find((slot) => slot.diamonds && slot.vip) : undefined);
        if (wanted && s.bought + s.vip < maxBuys) {
          const price = lines.find((l) => Math.abs(center(l).y - wanted.y) < 12 && Math.abs(center(l).x - wanted.x) < 55)?.text.replace(/^[^\d]+/, "") ?? "?";
          log(wanted.diamonds ? `buying VIP XP for ${price} gems` : `buying an item for ${price} resources`);
          await phone.tap({ x: wanted.x, y: wanted.y });
          await sleep(1500);
          return step({ ...fresh, looks: 0, expect: wanted.diamonds ? "vip" : "rss", bought: wanted.diamonds ? s.bought : s.bought + 1, vip: wanted.diamonds ? s.vip + 1 : s.vip });
        }
        const refresh = exact(lines, "Free Refresh")[0];
        if (!wanted && refresh && slots.length > 0) {
          log("only gem items left, pressing Free Refresh");
          await phone.tap(center(refresh));
          await sleep(2000);
          return step({ ...fresh, looks: 0, refreshes: s.refreshes + 1 });
        }
        if (s.looks < 3) {
          await sleep(1200);
          return step({ ...fresh, looks: s.looks + 1 });
        }
        const next = matching(lines, /^\W*\d\d:\d\d:\d\d$/)?.text.replace(/^\W+/, "");
        if (next) refreshIn.seconds = secondsIn(next) + 15;
        log(`no free refresh left${next ? `, the shop refreshes in ${next}` : ""}`);
        return step({ ...fresh, leaving: true });
      }

      if (has(lines, /^Town$/i) || has(lines, /^Conquest$/i)) {
        if (s.leaving) return summary(s);
        if (s.opens >= 4) return "the shop did not open";
        await phone.tap(shopButton);
        await sleep(2000);
        return step({ ...fresh, opens: s.opens + 1 });
      }

      if (Date.now() - s.knownAt > lostMs) {
        await Deno.mkdir(buildDir, { recursive: true });
        await Deno.writeFile(new URL("shop-lost.png", buildDir), toPng(fromPng(png)));
        return `did not recognise the screen, see build/shop-lost.png, ${summary(s)}`;
      }
      await sleep(1000);
      return step(s);
    };

    const first = await phone.screenshot();
    if (first.width !== screenWidth) throw new Error(`this recipe only works on an iPhone 17 Pro`);
    console.log(`stopped: ${await step({ bought: 0, vip: 0, refreshes: 0, opens: 0, leaving: false, looks: 0, knownAt: Date.now() })}`);
    return refreshIn.seconds;
  },
};
