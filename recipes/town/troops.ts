import { decide } from "../../src/decisions.ts";
import { look, requireIphone, type Seen } from "../../src/flow.ts";
import type { TextLine } from "../../src/ocr.ts";
import type { Recipe } from "../../src/recipe.ts";
import { backArrow, center, exact, has } from "../../src/screen.ts";
import { clock, sleep } from "../../src/time.ts";
import { panel, row, toWorld } from "../../src/town.ts";

const kinds = ["Infantry", "Cavalry", "Archer"];
const buildings = [{ name: "Barracks", x: 75 }, { name: "Stable", x: 202 }, { name: "Range", x: 328 }];
const buildingTabY = 838;
const finishedBubble = { x: 201, y: 300 };

const onTraining = (lines: TextLine[]) => buildings.every((b) => exact(lines, b.name).some((l) => center(l).y > 815));

const trainLabel = (lines: TextLine[]) => exact(lines, "Train").find((l) => center(l).y > 450 && center(l).y < 620);

const trainButton = (lines: TextLine[]) => exact(lines, "Train").find((l) => center(l).y > 700 && center(l).x > 200);

export const trainTroops: Recipe = {
  description:
    "Collects the finished troops and starts a new batch in the Barracks, the Stable and the Range, with the tier and amount the game suggests. Never presses Finish or Speedups. Starts on the world map or the town map and ends on the world map.",
  run: async (phone, settings) => {
    const time = clock(settings.env.CLOCK);
    const log = (text: string) => console.log(`${time()} ${text}`);
    await requireIphone(phone);

    const open = async (tries: number): Promise<Seen> => {
      const list = await panel(phone, "Town");
      const rows = kinds.flatMap((kind) => {
        const found = row(list.lines, kind);
        return found ? [{ kind, ...found }] : [];
      });
      await decide("looked at the training list", { rows: rows.map((r) => `${r.kind}: ${r.status}`) });
      const first = rows[0];
      if (!first) throw new Error("no troop training in the list at the side of the town map");
      if (tries <= 0) throw new Error("could not open the training screen");
      await phone.tap(first.button);
      await sleep(2500);
      const moved = await look(phone);
      const label = trainLabel(moved.lines);
      if (label) {
        await phone.tap({ x: center(label).x, y: center(label).y - 16 });
        await sleep(2000);
        const screen = await look(phone);
        if (onTraining(screen.lines)) return screen;
        return open(tries - 1);
      }
      await decide("collecting the finished troops from the building first");
      await phone.tap(finishedBubble);
      await sleep(2500);
      return open(tries - 1);
    };

    await open(4);

    const each = async (index: number, started: number): Promise<number> => {
      const building = buildings[index];
      if (!building) return started;
      await phone.tap({ x: building.x, y: buildingTabY });
      await sleep(1500);
      const seen = await look(phone);
      if (!onTraining(seen.lines)) throw new Error("left the training screen, stopping");
      const troop = seen.lines.find((l) => center(l).y < 100 && center(l).x > 100)?.text.trim() ?? building.name;
      const train = trainButton(seen.lines);
      if (!train) {
        const busy = has(seen.lines, /^Training/i);
        await decide("did not start training", {
          building: building.name,
          why: busy ? "it is already training" : "no Train button",
        });
        log(`${building.name}: ${busy ? "already training" : "no Train button, left alone"}`);
        return each(index + 1, started);
      }
      await phone.tap(center(train));
      await sleep(2500);
      const after = await look(phone);
      const batch = after.lines.find((l) => /^Training\s+\d/i.test(l.text.trim()))?.text.trim();
      await decide("pressed Train", { building: building.name, troop, batch });
      log(
        `${building.name}: ${batch ? batch.toLowerCase() : `pressed Train for ${troop}, could not read what started`}`,
      );
      return each(index + 1, batch ? started + 1 : started);
    };

    const started = await each(0, 0);
    await phone.tap(backArrow);
    await sleep(1500);
    await toWorld(phone);
    console.log(`stopped: ${started} new ${started === 1 ? "batch" : "batches"} of troops started`);
  },
};
