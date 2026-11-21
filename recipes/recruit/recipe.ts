import { greenButtons } from "../../src/buttons.ts";
import { exitLine, type Next, openFromWorld, runFlow, type Seen } from "../../src/flow.ts";
import { crop } from "../../src/image.ts";
import type { Recipe } from "../../src/recipe.ts";
import { backArrow, center, exact, has, screenWidth } from "../../src/screen.ts";
import { clock, secondsIn, sleep } from "../../src/time.ts";
import { onWorld } from "../../src/world.ts";

const heroesButton = { x: 106, y: 825 };
const exitSpot = { x: 200, y: 810 };
const buttonsTop = 1500;
const recruitButton = { x: 298, y: 812 };
const buttonBand = { x: 0, y: 2300, width: screenWidth, height: 322 };

type State = { recruited: number; opens: number; leaving: boolean };

export const recruit: Recipe = {
  description:
    "Opens Heroes and Recruit Heroes and presses every green (free) recruit button. Never presses the yellow buttons that cost keys.",
  run: async (phone, settings) => {
    const time = clock(settings.env.CLOCK);

    const next: { seconds?: number } = {};

    const screen = async (s: State, { lines, img }: Seen): Next<State> => {
      if (exitLine(lines)) {
        await phone.tap(exitSpot);
        await sleep(1500);
        return s;
      }

      if (has(lines, /^Recruitment$/i) && has(lines, /^Recruit x10$/i)) {
        const green = greenButtons(img(), buttonsTop)[0];
        if (green && s.recruited < 10) {
          console.log(`${time()} free recruit ${s.recruited + 1}`);
          await phone.tap(green);
          await sleep(4000);
          return { ...s, recruited: s.recruited + 1 };
        }
        const waits = lines.flatMap((l) => l.text.match(/Next free:\s*([\d:]+)/i)?.[1] ?? []);
        if (waits.length) next.seconds = Math.min(...waits.map(secondsIn)) + 15;
        if (!s.leaving) {
          console.log(`${time()} no free recruit left${waits.length ? `, next free in ${waits.join(" and ")}` : ""}`);
        }
        await phone.tap(backArrow);
        await sleep(1500);
        return { ...s, leaving: true };
      }

      const recruitHeroes = exact(lines, "Recruit Heroes")[0];
      if (recruitHeroes) {
        await phone.tap(s.leaving ? backArrow : center(recruitHeroes));
        await sleep(2000);
        return s;
      }

      if (onWorld(lines)) {
        const done = `${s.recruited} free ${s.recruited === 1 ? "recruit" : "recruits"} done`;
        return openFromWorld(phone, s, heroesButton, 1500, done, "the heroes screen did not open");
      }

      const band = await phone.ocr(crop(img(), buttonBand));
      if (exact(band, "Recruit Heroes").length) {
        await phone.tap(s.leaving ? backArrow : recruitButton);
        await sleep(2000);
        return s;
      }
    };

    await runFlow(phone, {
      name: "recruit",
      lostMs: Number(settings.env.RECRUIT_LOST_SECONDS || 45) * 1000,
      start: { recruited: 0, opens: 0, leaving: false },
      screen,
    });
    return next.seconds;
  },
};
