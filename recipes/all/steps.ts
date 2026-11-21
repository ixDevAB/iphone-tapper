import { type Env, optionsOf, type Recipe } from "../../src/recipe.ts";
import { clock } from "../../src/time.ts";
import { goHome } from "../../src/world.ts";
import { claimAlliance } from "../alliance/recipe.ts";
import { collectBackpack } from "../backpack/recipe.ts";
import { collectConquest } from "../conquest/recipe.ts";
import { collectDaily } from "../daily/recipe.ts";
import { claimFreebies } from "../freebies/recipe.ts";
import { intel } from "../intel/recipe.ts";
import { claimMail } from "../mail/recipe.ts";
import { collectPet } from "../pets/recipe.ts";
import { recruit } from "../recruit/recipe.ts";
import { shop } from "../shop/recipe.ts";
import { terrorHunt } from "../terror/recipe.ts";
import { claimVip } from "../vip/recipe.ts";

export const minute = 60;
export const hour = 60 * minute;

export type Step = { name: string; recipe: Recipe; every: number; env?: (env: Env) => Env };

const twoRallies = (env: Env) => ({
  ...env,
  AMOUNT: env.AMOUNT || "2",
  HUNT_ARCH: env.HUNT_ARCH || "diana",
  HUNT_CAV: env.HUNT_CAV || "fahd",
});

export const steps: Step[] = [
  { name: "intel", recipe: intel, every: 3 * hour },
  { name: "terror-hunt", recipe: terrorHunt, every: 24 * hour, env: twoRallies },
  { name: "claim-mail", recipe: claimMail, every: 2 * hour },
  { name: "claim-alliance", recipe: claimAlliance, every: 2 * hour },
  { name: "shop", recipe: shop, every: 30 * minute, env: (env) => ({ ...env, SHOP_BUY_VIP: "1" }) },
  { name: "recruit", recipe: recruit, every: 30 * minute },
  { name: "collect-pet", recipe: collectPet, every: 4 * hour },
  { name: "claim-freebies", recipe: claimFreebies, every: 6 * hour },
  { name: "claim-vip", recipe: claimVip, every: 12 * hour },
  { name: "collect-conquest", recipe: collectConquest, every: 4 * hour },
  { name: "collect-backpack", recipe: collectBackpack, every: 12 * hour },
  { name: "collect-daily", recipe: collectDaily, every: 4 * hour },
];

export const pick = (names: string[]) => names.flatMap((name) => steps.filter((s) => s.name === name));

export const envFor = (step: Step, env: Env) => step.env ? step.env(env) : env;

export const sequence = (description: string, chosen: Step[]): Recipe => ({
  description,
  ...optionsOf(chosen.map((s) => s.recipe)),
  run: async (phone, settings) => {
    const time = clock(settings.env.CLOCK);
    for (const step of chosen) {
      console.log(`\n${time()} == ${step.name} ==`);
      await step.recipe.run(phone, { ...settings, env: envFor(step, settings.env) })
        .catch((e) => console.log(`stopped: ${e.message}`));
      if (!(await goHome(phone, 5))) {
        console.log(`${time()} could not get back to the world map after ${step.name}, stopping`);
        return;
      }
    }
    console.log(`\n${time()} done`);
  },
});
