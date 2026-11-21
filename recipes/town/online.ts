import { decide } from "../../src/decisions.ts";
import { requireIphone } from "../../src/flow.ts";
import type { Recipe } from "../../src/recipe.ts";
import { has } from "../../src/screen.ts";
import { clock, sleep } from "../../src/time.ts";
import { panel, row, secondsLeft, tapUntil, toWorld } from "../../src/town.ts";

const chest = [{ x: 201, y: 314 }, { x: 201, y: 298 }, { x: 201, y: 330 }];
const anywhere = { x: 200, y: 150 };
const comeBack = 15 * 60;

export const collectOnline: Recipe = {
  description:
    "Claims the Online Rewards chest at the storehouse when it is ready. Starts on the world map or the town map and ends on the world map.",
  run: async (phone, settings) => {
    const time = clock(settings.env.CLOCK);
    const log = (text: string) => console.log(`${time()} ${text}`);
    await requireIphone(phone);

    const list = await panel(phone, "Daily");
    const online = row(list.lines, "Online Rewards");
    await decide("looked for the online reward", { found: Boolean(online), status: online?.status });
    if (!online) {
      await toWorld(phone);
      console.log("stopped: no Online Rewards in the list, nothing to claim");
      return comeBack;
    }
    if (!/^complete/i.test(online.status)) {
      const left = secondsLeft(online.status);
      await toWorld(phone);
      console.log(`stopped: the online reward is not ready yet${online.status ? ` (${online.status})` : ""}`);
      return Math.max(comeBack, (left ?? 0) + 15);
    }

    await phone.tap(online.button);
    await sleep(2500);
    const claimed = await tapUntil(phone, chest, (seen) => has(seen.lines, /Next Chest Ready/i));
    if (!claimed) {
      await toWorld(phone);
      throw new Error("the chest on the storehouse did not open");
    }
    const gave = claimed.lines.filter((l) => !/Next Chest/i.test(l.text)).map((l) => l.text.trim()).join(" ");
    const next = claimed.lines.map((l) => secondsLeft(l.text)).find((s) => s !== undefined);
    log(`claimed the online reward${gave ? ` (${gave})` : ""}`);
    await phone.tap(anywhere);
    await sleep(1500);
    await toWorld(phone);
    console.log("stopped: online reward claimed");
    return Math.max(comeBack, (next ?? 0) + 15);
  },
};
