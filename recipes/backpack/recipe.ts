import { exitLine, look, requireIphone } from "../../src/flow.ts";
import type { Recipe } from "../../src/recipe.ts";
import { backArrow, center, exact, has } from "../../src/screen.ts";
import { clock, sleep } from "../../src/time.ts";
import { atTown } from "../../src/world.ts";
import { colourAt, columns, rowsIn } from "./tiles.ts";

const backpackButton = { x: 170, y: 825 };
const tabs = [126, 200, 277, 353, 49];
const tabY = 121;
const resources = /bread|wood|stone|iron/i;

export const collectBackpack: Recipe = {
  description:
    "Backpack: uses all gems, all hero XP, and the grey and green resource items (change with --rss grey,green,blue,purple), then opens every tab to clear the red dots. Uses nothing else.",
  flags: { "--rss": "BACKPACK_RSS" },
  run: async (phone, settings) => {
    const time = clock(settings.env.CLOCK);
    const maxUses = Number(settings.env.BACKPACK_MAX_USES || 60);
    const known = ["grey", "green", "blue", "purple"];
    const colours = (settings.env.BACKPACK_RSS || "grey,green").toLowerCase().split(",").map((c) => c.trim()).filter((
      c,
    ) => c);
    const wrong = colours.filter((c) => !known.includes(c));
    if (wrong.length) throw new Error(`unknown resource colour ${wrong.join(", ")}, use ${known.join(", ")}`);
    console.log(`resource items to use: ${colours.join(", ")}`);

    const titles = [
      /^[\d,.]+\s*[KM]?\s+(bread|wood|stone|iron)(\s*\(secured\))?$/i,
      /^[\d,]+\s+gems$/i,
      /^[\d,.]+\s*K?\s+hero xp$/i,
    ];
    const allowed = (title: string, colour: string) =>
      titles.some((t) => t.test(title)) && (!resources.test(title) || colours.includes(colour));

    const page = async (index: number, used: number, first: boolean, lowest = 415): Promise<number> => {
      const before = await look(phone);
      const rows = rowsIn(before.lines).filter((y) => y >= 185 && y <= lowest);
      const row = rows[Math.floor(index / columns.length)];
      if (row === undefined || used >= maxUses) return used;
      const spot = { x: columns[index % columns.length], y: row };
      const colour = colourAt(before.img(), spot.x, spot.y);
      if (colour === "none") return page(index + 1, used, first, lowest);
      const candidate = colours.includes(colour) || (first && index < 2 * columns.length);
      if (!candidate) return page(index + 1, used, first, lowest);
      await phone.tap(spot);
      await sleep(1200);
      const { lines } = await look(phone);
      const use = exact(lines, "Use").find((l) => Math.abs(center(l).x - 201) < 40);
      const button = use ?? exact(lines, "Use")[0] ?? exact(lines, "Details")[0];
      const tile = { x: spot.x, y: button ? center(button).y - 226 : spot.y };
      const title = use
        ? lines.find((l) =>
          center(l).y > center(use).y - 175 && center(l).y < center(use).y - 115 &&
          titles.some((t) => t.test(l.text.trim()))
        )?.text.trim()
        : undefined;
      if (!use || !title || !allowed(title, colour)) {
        await phone.tap(tile);
        await sleep(900);
        const closed = await look(phone);
        const still = exact(closed.lines, "Use")[0] ?? exact(closed.lines, "Details")[0];
        if (still) {
          await phone.tap({ x: spot.x, y: center(still).y - 226 });
          await sleep(900);
        }
        return page(index + 1, used, first, lowest);
      }
      console.log(`${time()} using all: ${title}`);
      await phone.tap({ x: center(use).x + 140, y: center(use).y - 76 });
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
      return page(index, used + 1, first, lowest);
    };

    const pages = async (number: number, used: number, last: string): Promise<number> => {
      const { lines } = await look(phone);
      const rows = rowsIn(lines).filter((y) => y >= 185 && y <= 415);
      const signature = lines.filter((l) => center(l).y > 185).map((l) => l.text).join("|");
      if (signature === last) {
        const final = await page(0, used, false, 700);
        return final > used && number < 14 ? pages(number + 1, final, "") : final;
      }
      if (number >= 14 || !rows.length) return used;
      if (settings.env.BACKPACK_DEBUG) {
        console.log(`${time()} page ${number + 1}: rows at ${rows.map((y) => Math.round(y)).join(" ")}`);
      }
      const total = await page(0, used, number === 0);
      await phone.drag({ x: 200, y: 600 }, { x: 200, y: 330 }, 1);
      await sleep(1500);
      return pages(number + 1, total, signature);
    };

    await requireIphone(phone);
    const start = await look(phone);
    if (!atTown(start.lines)) throw new Error("start on the world map");
    await phone.tap(backpackButton);
    await sleep(2000);
    const opened = await look(phone);
    if (!has(opened.lines, /^Backpack$/i) || !has(opened.lines, /^Speedups$/i)) {
      throw new Error("the backpack did not open");
    }
    const used = await pages(0, 0, "");
    for (const x of tabs) {
      await phone.tap({ x, y: tabY });
      await sleep(1000);
    }
    await phone.tap(backArrow);
    await sleep(1500);
    console.log(`stopped: ${used} ${used === 1 ? "stack" : "stacks"} used from the backpack`);
  },
};
