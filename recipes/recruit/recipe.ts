import { greenButtons } from "../../src/buttons.ts";
import { clock } from "../../src/clock.ts";
import { fromPng, toPng } from "../../src/image.ts";
import type { Recipe } from "../../src/recipes.ts";
import { center, exact, has, matching, screenWidth } from "../../src/screen.ts";
import { sleep } from "../../src/wda.ts";

const heroesButton = { x: 106, y: 825 };
const backArrow = { x: 30, y: 77 };
const exitSpot = { x: 200, y: 810 };
const buttonsTop = 1500;
const buildDir = new URL("../../build/", import.meta.url);

export const recruit: Recipe = {
  description: "Opens Heroes and Recruit Heroes and presses every green (free) recruit button. Never presses the yellow buttons that cost keys.",
  run: async (phone, settings) => {
    const time = clock(settings.env.CLOCK);
    const lostMs = Number(settings.env.RECRUIT_LOST_SECONDS || 45) * 1000;

    type State = { recruited: number; opens: number; leaving: boolean; knownAt: number };

    const step = async (s: State): Promise<string> => {
      const png = await phone.snap();
      const lines = await phone.ocrPng(png);
      const fresh = { ...s, knownAt: Date.now() };

      if (matching(lines, /tap anywhere to exit/i)) {
        await phone.tap(exitSpot);
        await sleep(1500);
        return step(fresh);
      }

      if (has(lines, /^Recruitment$/i) && has(lines, /^Recruit x10$/i)) {
        const green = greenButtons(fromPng(png), buttonsTop)[0];
        if (green && s.recruited < 10) {
          console.log(`${time()} free recruit ${s.recruited + 1}`);
          await phone.tap(green);
          await sleep(4000);
          return step({ ...fresh, recruited: s.recruited + 1 });
        }
        const waits = lines.flatMap((l) => l.text.match(/Next free:\s*([\d:]+)/i)?.[1] ?? []);
        if (!s.leaving) console.log(`${time()} no free recruit left${waits.length ? `, next free in ${waits.join(" and ")}` : ""}`);
        await phone.tap(backArrow);
        await sleep(1500);
        return step({ ...fresh, leaving: true });
      }

      const recruitHeroes = exact(lines, "Recruit Heroes")[0];
      if (recruitHeroes) {
        await phone.tap(s.leaving ? backArrow : center(recruitHeroes));
        await sleep(2000);
        return step(fresh);
      }

      if (has(lines, /^Town$/i) || has(lines, /^Conquest$/i)) {
        if (s.leaving) return `${s.recruited} free ${s.recruited === 1 ? "recruit" : "recruits"} done`;
        if (s.opens >= 4) return "the heroes screen did not open";
        await phone.tap(heroesButton);
        await sleep(1500);
        return step({ ...fresh, opens: s.opens + 1 });
      }

      if (Date.now() - s.knownAt > lostMs) {
        await Deno.mkdir(buildDir, { recursive: true });
        await Deno.writeFile(new URL("recruit-lost.png", buildDir), toPng(fromPng(png)));
        return "did not recognise the screen, see build/recruit-lost.png";
      }
      await sleep(1000);
      return step(s);
    };

    const first = await phone.screenshot();
    if (first.width !== screenWidth) throw new Error(`this recipe only works on an iPhone 17 Pro`);
    console.log(`stopped: ${await step({ recruited: 0, opens: 0, leaving: false, knownAt: Date.now() })}`);
  },
};
