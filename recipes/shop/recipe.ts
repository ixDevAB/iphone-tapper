import { decide } from "../../src/decisions.ts";
import { exitLine, type Next, openFromWorld, runFlow, type Seen } from "../../src/flow.ts";
import { on, type Recipe } from "../../src/recipe.ts";
import { backArrow, center, exact, has, matching, scale } from "../../src/screen.ts";
import { clock, secondsIn, sleep } from "../../src/time.ts";
import { onWorld } from "../../src/world.ts";
import { crop, scaleUp } from "../../src/image.ts";
import { gemConfirm, maySpend, priceIn, priceNear } from "./confirm.ts";
import { blueShare, slotsIn } from "./slots.ts";

const shopButton = { x: 233, y: 825 };
const closeBuy = { x: 365, y: 328 };
const closePurchase = { x: 356, y: 344 };
const buyButton = { x: 200, y: 553 };
const buyPill = { x: buyButton.x * scale - 200, y: buyButton.y * scale - 60, width: 400, height: 120 };

type State = {
  bought: number;
  vip: number;
  refreshes: number;
  expect?: "rss" | "vip";
  listed?: number;
  spending?: number;
  slot?: { x: number; y: number };
  skipped: { x: number; y: number }[];
  opens: number;
  leaving: boolean;
  looks: number;
};

export const shop: Recipe = {
  description:
    "Nomadic Merchant: buys every item that costs resources, then presses Free Refresh and repeats. With --buy-vip it also buys the VIP XP item (the yellow V) for gems. Buys nothing else with gems. With --dry-run it opens every item it would buy, says so and closes it again.",
  switches: { "--buy-vip": "SHOP_BUY_VIP", "--dry-run": "DRY_RUN" },
  run: async (phone, settings) => {
    const time = clock(settings.env.CLOCK);
    const buyVip = on(settings.env, "SHOP_BUY_VIP");
    const dry = on(settings.env, "DRY_RUN");
    const did = dry ? "would be bought" : "bought";
    const maxBuys = Number(settings.env.SHOP_MAX_BUYS || 200);
    const log = (text: string) => console.log(`${time()} ${text}`);

    const refreshIn: { seconds?: number } = {};

    const summary = (s: State) => {
      const vip = buyVip ? `${s.vip} VIP XP ${did} with gems, ` : "";
      return `${s.bought} ${did} with resources, ${vip}${s.refreshes} free ${
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

      const without = (s: State) =>
        s.expect === "vip"
          ? { ...s, vip: Math.max(0, s.vip - 1) }
          : s.expect === "rss"
          ? { ...s, bought: Math.max(0, s.bought - 1) }
          : s;

      const confirm = gemConfirm(lines);
      if (confirm) {
        const allowed = buyVip && !dry && s.spending !== undefined && maySpend(confirm, [s.spending, s.listed]);
        await decide(allowed ? "confirmed spending gems" : "refused to spend gems", {
          asked: confirm.gems,
          buyWindow: s.spending,
          list: s.listed,
          buyVip,
        });
        await phone.tap(allowed && confirm.button ? center(confirm.button) : closePurchase);
        await sleep(2000);
        if (!allowed) {
          return `stopped at a question to spend ${confirm.gems} gems that it is not allowed to answer, ${
            summary({ ...s, vip: Math.max(0, s.vip - 1) })
          }`;
        }
        log(`confirmed ${confirm.gems} gems for VIP XP`);
        return { ...s, spending: undefined, listed: undefined };
      }

      if (exact(lines, "Buy").some((l) => center(l).y < 360) && !has(lines, /^Free Refresh$/i)) {
        const gems = blueShare(img(), buyPill) > 0.01;
        const onButton = s.expect === "vip" && priceNear(lines, buyButton) === undefined
          ? (await phone.ocr(scaleUp(crop(img(), buyPill), 2))).map((l) => l.text.trim())
          : [];
        const price = priceNear(lines, buyButton) ?? priceIn(onButton);
        if (s.expect === "vip" && price === undefined && s.looks < 4) {
          await sleep(1000);
          return { ...s, looks: s.looks + 1 };
        }
        const vipPrice = price !== undefined && s.listed === price;
        const allowed = s.expect === "vip"
          ? buyVip && has(lines, /VIP XP/i) && vipPrice
          : s.expect === "rss"
          ? !gems
          : false;
        const buy = allowed && !dry;
        await decide(buy ? "confirmed a purchase" : allowed ? "would confirm a purchase" : "refused a purchase", {
          expected: s.expect,
          gems,
          price,
          list: s.listed,
          buyVip,
          dry,
        });
        await phone.tap(buy ? buyButton : closeBuy);
        await sleep(1500);
        if (!allowed) return `stopped at a purchase it is not allowed to make, ${summary(without(s))}`;
        if (dry) {
          log(`dry run: this is where it would press the buy button${gems ? ` (${price ?? "?"} gems)` : ""}`);
          return { ...s, expect: undefined, skipped: s.slot ? [...s.skipped, s.slot] : s.skipped };
        }
        return { ...s, expect: undefined, spending: s.expect === "vip" ? price : undefined };
      }

      if (has(lines, /^Nomadic$/i) && has(lines, /Refreshes in/i)) {
        if (s.leaving) {
          await phone.tap(backArrow);
          await sleep(1500);
          return s;
        }
        const slots = slotsIn(img())
          .filter((slot) => slot.present)
          .filter((slot) => !s.skipped.some((k) => k.x === slot.x && k.y === slot.y));
        const wanted = slots.find((slot) => !slot.diamonds) ??
          (buyVip ? slots.find((slot) => slot.diamonds && slot.vip) : undefined);
        if (wanted && s.bought + s.vip < maxBuys) {
          const price = lines
            .find((l) => Math.abs(center(l).y - wanted.y) < 12 && Math.abs(center(l).x - wanted.x) < 55)
            ?.text.replace(/^[^\d]+/, "") ?? "?";
          log(
            `${dry ? "dry run, opening" : "buying"} ${
              wanted.diamonds ? `VIP XP for ${price} gems` : `an item for ${price} resources`
            }`,
          );
          await decide(wanted.diamonds ? "picked VIP XP for gems" : "picked an item for resources", { price });
          await phone.tap({ x: wanted.x, y: wanted.y });
          await sleep(1500);
          return {
            ...s,
            looks: 0,
            expect: wanted.diamonds ? "vip" : "rss",
            listed: wanted.diamonds && /^[\d,]+$/.test(price) ? Number(price.replace(/,/g, "")) : undefined,
            spending: undefined,
            slot: { x: wanted.x, y: wanted.y },
            bought: wanted.diamonds ? s.bought : s.bought + 1,
            vip: wanted.diamonds ? s.vip + 1 : s.vip,
          };
        }
        const refresh = exact(lines, "Free Refresh")[0];
        if (!wanted && refresh && slots.length > 0 && !dry) {
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
        log(
          dry && refresh
            ? "dry run: this is where it would press Free Refresh"
            : `no free refresh left${next ? `, the shop refreshes in ${next}` : ""}`,
        );
        return { ...s, leaving: true };
      }

      if (onWorld(lines)) return openFromWorld(phone, s, shopButton, 2000, summary(s), "the shop did not open");
    };

    await runFlow(phone, {
      name: "shop",
      lostMs: Number(settings.env.SHOP_LOST_SECONDS || 45) * 1000,
      start: { bought: 0, vip: 0, refreshes: 0, opens: 0, leaving: false, looks: 0, skipped: [] },
      screen,
      lost: summary,
    });
    return refreshIn.seconds;
  },
};
