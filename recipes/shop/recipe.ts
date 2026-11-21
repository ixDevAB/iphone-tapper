import { exitLine, type Next, openFromWorld, runFlow, type Seen } from "../../src/flow.ts";
import { on, type Recipe } from "../../src/recipe.ts";
import { backArrow, center, exact, has, matching, scale } from "../../src/screen.ts";
import { clock, secondsIn, sleep } from "../../src/time.ts";
import { onWorld } from "../../src/world.ts";
import { blueShare, slotsIn } from "./slots.ts";

const shopButton = { x: 233, y: 825 };
const closeBuy = { x: 365, y: 328 };
const buyButton = { x: 200, y: 553 };
const buyPill = { x: buyButton.x * scale - 200, y: buyButton.y * scale - 60, width: 400, height: 120 };

type State = {
  bought: number;
  vip: number;
  refreshes: number;
  expect?: "rss" | "vip";
  opens: number;
  leaving: boolean;
  looks: number;
};

export const shop: Recipe = {
  description:
    "Nomadic Merchant: buys every item that costs resources, then presses Free Refresh and repeats. With --buy-vip it also buys the VIP XP item (the yellow V) for gems. Buys nothing else with gems.",
  switches: { "--buy-vip": "SHOP_BUY_VIP" },
  run: async (phone, settings) => {
    const time = clock(settings.env.CLOCK);
    const buyVip = on(settings.env, "SHOP_BUY_VIP");
    const maxBuys = Number(settings.env.SHOP_MAX_BUYS || 200);
    const log = (text: string) => console.log(`${time()} ${text}`);

    const refreshIn: { seconds?: number } = {};

    const summary = (s: State) => {
      const vip = buyVip ? `${s.vip} VIP XP bought with gems, ` : "";
      return `${s.bought} bought with resources, ${vip}${s.refreshes} free ${
        s.refreshes === 1 ? "refresh" : "refreshes"
      }`;
    };

    const screen = async (s: State, { lines, img }: Seen): Next<State> => {
      const exit = exitLine(lines);
      if (exit) {
        await phone.tap(center(exit));
        await sleep(1200);
        return s;
      }

      if (exact(lines, "Buy").some((l) => center(l).y < 360) && !has(lines, /^Free Refresh$/i)) {
        const gems = blueShare(img(), buyPill) > 0.01;
        const allowed = s.expect === "vip" ? buyVip && has(lines, /VIP XP/i) : s.expect === "rss" ? !gems : false;
        await phone.tap(allowed ? buyButton : closeBuy);
        await sleep(1500);
        if (!allowed) return `stopped at a purchase it is not allowed to make, ${summary(s)}`;
        return { ...s, expect: undefined };
      }

      if (has(lines, /^Nomadic$/i) && has(lines, /Refreshes in/i)) {
        if (s.leaving) {
          await phone.tap(backArrow);
          await sleep(1500);
          return s;
        }
        const slots = slotsIn(img()).filter((slot) => slot.present);
        const wanted = slots.find((slot) => !slot.diamonds) ??
          (buyVip ? slots.find((slot) => slot.diamonds && slot.vip) : undefined);
        if (wanted && s.bought + s.vip < maxBuys) {
          const price = lines
            .find((l) => Math.abs(center(l).y - wanted.y) < 12 && Math.abs(center(l).x - wanted.x) < 55)
            ?.text.replace(/^[^\d]+/, "") ?? "?";
          log(wanted.diamonds ? `buying VIP XP for ${price} gems` : `buying an item for ${price} resources`);
          await phone.tap({ x: wanted.x, y: wanted.y });
          await sleep(1500);
          return {
            ...s,
            looks: 0,
            expect: wanted.diamonds ? "vip" : "rss",
            bought: wanted.diamonds ? s.bought : s.bought + 1,
            vip: wanted.diamonds ? s.vip + 1 : s.vip,
          };
        }
        const refresh = exact(lines, "Free Refresh")[0];
        if (!wanted && refresh && slots.length > 0) {
          log("only gem items left, pressing Free Refresh");
          await phone.tap(center(refresh));
          await sleep(2000);
          return { ...s, looks: 0, refreshes: s.refreshes + 1 };
        }
        if (s.looks < 3) {
          await sleep(1200);
          return { ...s, looks: s.looks + 1 };
        }
        const next = matching(lines, /^\W*\d\d:\d\d:\d\d$/)?.text.replace(/^\W+/, "");
        if (next) refreshIn.seconds = secondsIn(next) + 15;
        log(`no free refresh left${next ? `, the shop refreshes in ${next}` : ""}`);
        return { ...s, leaving: true };
      }

      if (onWorld(lines)) return openFromWorld(phone, s, shopButton, 2000, summary(s), "the shop did not open");
    };

    await runFlow(phone, {
      name: "shop",
      lostMs: Number(settings.env.SHOP_LOST_SECONDS || 45) * 1000,
      start: { bought: 0, vip: 0, refreshes: 0, opens: 0, leaving: false, looks: 0 },
      screen,
      lost: summary,
    });
    return refreshIn.seconds;
  },
};
