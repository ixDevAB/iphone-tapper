import { clock } from "../../src/clock.ts";
import type { Recipe } from "../../src/recipes.ts";
import { sleep } from "../../src/wda.ts";
import { claimAlliance } from "../alliance/recipe.ts";
import { collectBackpack } from "../backpack/recipe.ts";
import { collectConquest } from "../conquest/recipe.ts";
import { collectDaily } from "../daily/recipe.ts";
import { claimFreebies } from "../freebies/recipe.ts";
import { intel } from "../intel/recipe.ts";
import { claimMail } from "../mail/recipe.ts";
import { goHome } from "../morning/recipe.ts";
import { collectPet } from "../pets/recipe.ts";
import { recruit } from "../recruit/recipe.ts";
import { shop } from "../shop/recipe.ts";
import { terrorHunt } from "../terror/recipe.ts";
import { claimVip } from "../vip/recipe.ts";

const minute = 60;
const hour = 60 * minute;

export const run: Recipe = {
  description:
    "Keeps running all day: starts each task when it is due (recruit and shop when their timers run out, the rest on a fixed interval) and sleeps in between.",
  run: async (phone, settings) => {
    const time = clock(settings.env.CLOCK);
    const hunt = { ...settings.env, AMOUNT: settings.env.AMOUNT || "2", HUNT_ARCH: settings.env.HUNT_ARCH || "diana", HUNT_CAV: settings.env.HUNT_CAV || "fahd" };
    const all = [
      { name: "intel", recipe: intel, env: settings.env, every: 3 * hour },
      { name: "terror-hunt", recipe: terrorHunt, env: hunt, every: 24 * hour },
      { name: "claim-mail", recipe: claimMail, env: settings.env, every: 2 * hour },
      { name: "claim-alliance", recipe: claimAlliance, env: settings.env, every: 2 * hour },
      { name: "shop", recipe: shop, env: { ...settings.env, SHOP_BUY_VIP: "1" }, every: 30 * minute },
      { name: "recruit", recipe: recruit, env: settings.env, every: 30 * minute },
      { name: "collect-pet", recipe: collectPet, env: settings.env, every: 4 * hour },
      { name: "claim-freebies", recipe: claimFreebies, env: settings.env, every: 6 * hour },
      { name: "claim-vip", recipe: claimVip, env: settings.env, every: 12 * hour },
      { name: "collect-conquest", recipe: collectConquest, env: settings.env, every: 4 * hour },
      { name: "collect-backpack", recipe: collectBackpack, env: settings.env, every: 12 * hour },
      { name: "collect-daily", recipe: collectDaily, env: settings.env, every: 4 * hour },
    ];
    const only = (settings.env.RUN_ONLY || "").split(",").map((n) => n.trim()).filter((n) => n);
    const skip = (settings.env.RUN_SKIP || "").split(",").map((n) => n.trim()).filter((n) => n);
    const wrong = [...only, ...skip].filter((n) => !all.some((t) => t.name === n));
    if (wrong.length) throw new Error(`unknown task ${wrong.join(", ")}, use ${all.map((t) => t.name).join(", ")}`);
    const tasks = all.filter((t) => (!only.length || only.includes(t.name)) && !skip.includes(t.name));
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
      const wants = await next.recipe.run(phone, { ...settings, env: next.env }).catch((e) => {
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
