import { on, optionsOf, type Recipe } from "../../src/recipe.ts";
import { clock, sleep } from "../../src/time.ts";
import { goHome } from "../../src/world.ts";
import { againSwitch, minute, runStep, steps } from "../all/steps.ts";

const options = optionsOf(steps.map((s) => s.recipe));

const listed = (text = "") => text.split(",").map((n) => n.trim()).filter((n) => n);

export const run: Recipe = {
  description:
    "Keeps running all day: starts each task when it is due (recruit and shop when their timers run out, the once a day tasks after the daily reset, the rest on a fixed interval) and sleeps in between. Remembers earlier runs, add --again to start everything now.",
  ...options,
  flags: { ...options.flags, "--only": "RUN_ONLY", "--skip": "RUN_SKIP" },
  switches: { ...options.switches, ...againSwitch },
  run: async (phone, settings) => {
    const time = clock(settings.env.CLOCK);
    const only = listed(settings.env.RUN_ONLY);
    const skip = listed(settings.env.RUN_SKIP);
    const wrong = [...only, ...skip].filter((n) => !steps.some((t) => t.name === n));
    if (wrong.length) throw new Error(`unknown task ${wrong.join(", ")}, use ${steps.map((t) => t.name).join(", ")}`);
    const tasks = steps.filter((t) => (!only.length || only.includes(t.name)) && !skip.includes(t.name));
    const at = (ms: number) => new Date(ms).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
    console.log(`${time()} running: ${tasks.map((t) => t.name).join(", ")}`);

    const round = async (due: Record<string, number>): Promise<void> => {
      const next = tasks.find((t) => (due[t.name] ?? 0) <= Date.now());
      if (!next) {
        const soonest = tasks.toSorted((a, b) => due[a.name] - due[b.name])[0];
        console.log(`\n${time()} sleeping until ${at(due[soonest.name])} (${soonest.name})`);
        await sleep(Math.max(1000, due[soonest.name] - Date.now()));
        return round(due);
      }
      console.log(`\n${time()} == ${next.name} ==`);
      const again = await runStep(phone, settings, next) ?? Date.now();
      const home = await goHome(phone, 5);
      if (!home) console.log(`${time()} not on the world map after ${next.name}, trying everything again in 5 minutes`);
      console.log(`${time()} ${next.name} runs again at ${at(again)}`);
      if (!home) await sleep(5 * minute * 1000);
      return round({ ...due, [next.name]: again });
    };

    const remembered = on(settings.env, "RUN_AGAIN") ? {} : Object.fromEntries(tasks.flatMap((t) => {
      const nextAt = settings.runs.last(t.name)?.nextAt;
      return nextAt ? [[t.name, nextAt]] : [];
    }));
    await round(remembered);
  },
};
