import { loadTiles, nameUnknowns, shrunk } from "../../src/naming.ts";
import { decide } from "../../src/decisions.ts";
import { exitLine, look, requireIphone, type Seen } from "../../src/flow.ts";
import { crop, type Point, toPng } from "../../src/image.ts";
import { on, type Recipe } from "../../src/recipe.ts";
import { backArrow, center, exact, has } from "../../src/screen.ts";
import { clock, sleep } from "../../src/time.ts";
import { atTown } from "../../src/world.ts";
import { itemFrom, loadItems, recognise } from "./library.ts";
import { blank, fileName, iconAt, listSample, sameList, signatureOf, tileAt, titleIn } from "./names.ts";
import { colourAt, columns, defaultItems, panelIn, refusal, tileAbovePanel, tileRows, unwanted } from "./tiles.ts";

const backpackButton = { x: 170, y: 825 };
const tabs = [126, 200, 277, 353, 49];
const lists = [{ name: "Resources", x: 49 }, { name: "Other", x: 353 }];
const tabY = 121;
const maxButton = 341;
const picturesDir = new URL("../../assets/backpack/", import.meta.url);
const rewardsDir = new URL("../../assets/rewards/", import.meta.url);

export const collectBackpack: Recipe = {
  description:
    "Backpack: uses all gems, all hero XP, the grey and green resource items (change with --rss grey,green,blue,purple), the plain chests and the VIP XP items, then opens every tab to clear the red dots. It knows the items by their pictures and only opens the ones it will use. With --dry-run it only says what it would use.",
  flags: { "--rss": "BACKPACK_RSS" },
  switches: { "--dry-run": "DRY_RUN" },
  run: async (phone, settings) => {
    const time = clock(settings.env.CLOCK);
    const maxUses = Number(settings.env.BACKPACK_MAX_USES || 60);
    const dry = on(settings.env, "DRY_RUN");
    const known = ["grey", "green", "blue", "purple"];
    const colours = (settings.env.BACKPACK_RSS || "grey,green").toLowerCase().split(",").map((c) => c.trim())
      .filter((c) => c);
    const wrong = colours.filter((c) => !known.includes(c));
    if (wrong.length) throw new Error(`unknown resource colour ${wrong.join(", ")}, use ${known.join(", ")}`);
    const also = (settings.env.BACKPACK_ITEMS ?? defaultItems.join(",")).toLowerCase().split(",").map((n) => n.trim())
      .filter((n) => n);
    const wanted = { colours, items: also };
    const items = loadItems();
    console.log(`resource items to use: ${colours.join(", ")}${dry ? " (dry run, nothing is used)" : ""}`);
    console.log(`also: gems, hero xp, ${also.join(", ")}`);
    await decide("set out", { colours, also, dry, pictures: items.length });

    const closed = async (spot: Point, top: number, tries: number): Promise<Seen> => {
      await phone.tap({ x: spot.x, y: top - tileAbovePanel });
      await sleep(900);
      const after = await look(phone);
      const still = panelIn(after.img());
      if (!still) return after;
      if (tries <= 0) throw new Error("an item did not close, stopping to be safe");
      return closed(spot, still.top, tries - 1);
    };

    const list = async (tries: number): Promise<Seen> => {
      const seen = await look(phone);
      const exit = exitLine(seen.lines);
      const there = !exit && has(seen.lines, /Backpack/i);
      if (there) return seen;
      if (tries <= 0) throw new Error("the backpack list did not come back, stopping to be safe");
      await decide(exit ? "closing the rewards first" : "waiting for the backpack list");
      if (exit) await phone.tap(center(exit));
      await sleep(1200);
      return list(tries - 1);
    };

    const page = async (index: number, used: number, lowest: number): Promise<number> => {
      const before = await list(6);
      if (panelIn(before.img())) throw new Error("an item is open when it should not be, stopping to be safe");
      const rows = tileRows(before.img()).filter((y) => y >= 185 && y <= lowest);
      const row = rows[Math.floor(index / columns.length)];
      if (row === undefined || used >= maxUses) return used;
      const spot = { x: columns[index % columns.length], y: row };
      const where = { row: Math.round(spot.y), column: index % columns.length + 1 };
      const next = () => page(index + 1, used, lowest);
      if (blank(signatureOf(crop(before.img(), iconAt(spot))))) return next();

      const pictured = recognise(items, before.img(), spot);
      const colour = colourAt(before.img(), spot.x, spot.y);
      const fromPicture = pictured ? unwanted(pictured, wanted) : undefined;
      if (pictured && fromPicture) {
        await decide("not opened", { ...where, item: pictured, why: fromPicture });
        return next();
      }

      await decide(pictured ? "opening to use" : "opening to learn its name", { ...where, item: pictured });
      await phone.tap(spot);
      await sleep(1200);
      const opened = await look(phone);
      const panel = panelIn(opened.img());
      if (!panel) {
        await decide("left alone", { ...where, item: pictured, why: "nothing opened under it" });
        return next();
      }
      const name = fileName(titleIn(opened.lines, panel));
      if (name && !items.some((item) => item.name === name)) {
        const tile = crop(before.img(), tileAt(spot));
        await Deno.writeFile(new URL(`${name}.png`, picturesDir), toPng(tile));
        items.push(itemFrom(name, tile));
        console.log(`${time()} learned what ${name} looks like`);
        const named = await nameUnknowns(rewardsDir, loadTiles(picturesDir), { name, img: shrunk(tile) });
        named.forEach((n) => console.log(`${time()} the reward picture ${n.from} is ${n.to}, renamed`));
      }
      const uses = exact(opened.lines, "Use").filter((l) => center(l).y > panel.top);
      const use = uses.find((l) => Math.abs(center(l).x - 201) < 40) ??
        uses.toSorted((a, b) => center(b).x - center(a).x)[0];
      const selected = colourAt(opened.img(), spot.x, panel.top - tileAbovePanel);
      const why = !name
        ? "its name could not be read"
        : refusal(name, colour, selected, wanted) ?? (use ? undefined : "it has no Use button");
      const note = { ...where, item: name, pictured, before: colour, open: selected };
      if (why || !use || dry) {
        await decide(why ? "left alone" : "would use all", why ? { ...note, why } : note);
        if (why && pictured) console.log(`${time()} left alone: ${name || pictured}, ${why}`);
        if (!why) console.log(`${time()} would use all: ${name}`);
        await closed(spot, panel.top, 2);
        return page(index + 1, why ? used : used + 1, lowest);
      }

      await decide("used all", note);
      console.log(`${time()} using all: ${name}`);
      await phone.tap({ x: maxButton, y: center(use).y - 76 });
      await sleep(600);
      await phone.tap(center(use));
      await sleep(1800);
      const alert = await look(phone);
      const confirm = exact(alert.lines, "Alert").length
        ? exact(alert.lines, "Use").find((l) => center(l).x > 220)
        : undefined;
      if (confirm) {
        await phone.tap(center(confirm));
        await sleep(1800);
      }
      const after = confirm ? await look(phone) : alert;
      const exit = exitLine(after.lines);
      if (exit) {
        await phone.tap(center(exit));
        await sleep(1200);
      }
      return page(index, used + 1, lowest);
    };

    const pages = async (number: number, used: number, last: number[]): Promise<number> => {
      const seen = await list(6);
      const sample = listSample(seen.img());
      if (sameList(sample, last)) {
        const final = await page(0, used, 790);
        return final > used && !dry && number < 14 ? pages(number + 1, final, []) : final;
      }
      if (number >= 14) return used;
      const total = await page(0, used, 560);
      await phone.drag({ x: 200, y: 600 }, { x: 200, y: 330 }, 1);
      await sleep(1500);
      return pages(number + 1, total, sample);
    };

    await requireIphone(phone);
    const start = await look(phone);
    if (!atTown(start.lines)) throw new Error("start on the world map");
    await phone.tap(backpackButton);
    await sleep(2000);
    const opened = await look(phone);
    if (!has(opened.lines, /Backpack/i) || !has(opened.lines, /Speedups|Bonuses|Resources/i)) {
      throw new Error("the backpack did not open");
    }
    const each = async (list: number, used: number): Promise<number> => {
      const tab = lists[list];
      if (!tab) return used;
      await decide("opened a tab", { tab: tab.name });
      await phone.tap({ x: tab.x, y: tabY });
      await sleep(1500);
      return each(list + 1, await pages(0, used, []));
    };
    const used = await each(0, 0);
    for (const x of tabs) {
      await phone.tap({ x, y: tabY });
      await sleep(1000);
    }
    await phone.tap(backArrow);
    await sleep(1500);
    console.log(
      `stopped: ${used} ${used === 1 ? "stack" : "stacks"} ${dry ? "would be used" : "used"} from the backpack`,
    );
  },
};
