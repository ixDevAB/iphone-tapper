import { decide } from "../../src/decisions.ts";
import { look, requireIphone, type Seen } from "../../src/flow.ts";
import type { TextLine } from "../../src/ocr.ts";
import type { Recipe } from "../../src/recipe.ts";
import { center, exact } from "../../src/screen.ts";
import { clock, sleep } from "../../src/time.ts";
import { panel, row, tapUntil, toWorld } from "../../src/town.ts";

const bubble = [{ x: 201, y: 209 }, { x: 201, y: 225 }, { x: 201, y: 193 }];

const waterOn = (lines: TextLine[]) => {
  const shown = lines.find((l) => /^[\d,]+$/.test(l.text.trim()) && center(l).y < 95 && center(l).x > 280);
  return shown ? Number(shown.text.replace(/\D/g, "")) : undefined;
};

export const collectWater: Recipe = {
  description:
    "Collects the water from the Fountain of Life on your island. Starts on the world map or the town map and ends on the world map.",
  run: async (phone, settings) => {
    const time = clock(settings.env.CLOCK);
    const log = (text: string) => console.log(`${time()} ${text}`);
    await requireIphone(phone);

    const list = await panel(phone, "Daily");
    const fountain = row(list.lines, "Fountain of Life");
    await decide("looked for the fountain", { found: Boolean(fountain), status: fountain?.status });
    if (!fountain) {
      await toWorld(phone);
      console.log("stopped: no water to collect right now");
      return;
    }
    log(`fountain of life: ${fountain.status.toLowerCase()}`);
    await phone.tap(fountain.button);

    const island = async (tries: number): Promise<Seen | undefined> => {
      await sleep(1500);
      const seen = await look(phone);
      if (exact(seen.lines, "My Island").length) return seen;
      return tries > 0 ? island(tries - 1) : undefined;
    };
    if (!(await island(8))) {
      await toWorld(phone);
      throw new Error("the island did not open");
    }
    await sleep(4000);
    const before = waterOn((await look(phone)).lines);
    const after = await tapUntil(phone, bubble, (seen) => {
      const now = waterOn(seen.lines);
      return before === undefined || now === undefined || now > before;
    }, 3500);
    const now = after ? waterOn(after.lines) : undefined;
    await decide("tapped the fountain", { before, now });
    await toWorld(phone);
    if (!after) throw new Error("the water did not go up after tapping the fountain");
    const gained = before !== undefined && now !== undefined ? now - before : undefined;
    console.log(
      `stopped: ${
        gained
          ? `${gained.toLocaleString("en-US")} water collected`
          : "tapped the fountain, could not read how much it gave"
      }`,
    );
  },
};
