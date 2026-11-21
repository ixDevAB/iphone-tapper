import { optionsOf, type Recipe } from "../../src/recipe.ts";
import { clock, sleep } from "../../src/time.ts";
import { goHome } from "../../src/world.ts";
import { envFor, minute, steps } from "../all/steps.ts";

const options = optionsOf(steps.map((s) => s.recipe));

const listed = (text = "") => text.split(",").map((n) => n.trim()).filter((n) => n);

export const run: Recipe = {
  description:
    "Keeps running all day: starts each task when it is due (recruit and shop when their timers run out, the rest on a fixed interval) and sleeps in between.",
  ...options,
  flags: { ...options.flags, "--only": "RUN_ONLY", "--skip": "RUN_SKIP" },
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
      const wants = await next.recipe.run(phone, { ...settings, env: envFor(next, settings.env) }).catch((e) => {
        console.log(`stopped: ${e.message}`);
        return undefined;
      });
      const home = await goHome(phone, 5);
      if (!home) console.log(`${time()} not on the world map after ${next.name}, trying everything again in 5 minutes`);
      const seconds = typeof wants === "number" ? Math.max(minute, wants) : next.every;
      const again = Date.now() + seconds * 1000;
      console.log(`${time()} ${next.name} runs again at ${at(again)}`);
      if (!home) await sleep(5 * minute * 1000);
      return round({ ...due, [next.name]: again });
    };

    await round({});
  },
};
