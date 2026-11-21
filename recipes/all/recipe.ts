import { clock } from "../../src/clock.ts";
import type { Recipe } from "../../src/recipes.ts";
import { claimAlliance } from "../alliance/recipe.ts";
import { collectBackpack } from "../backpack/recipe.ts";
import { collectConquest } from "../conquest/recipe.ts";
import { collectDaily } from "../daily/recipe.ts";
import { claimFreebies } from "../freebies/recipe.ts";
import { claimMail } from "../mail/recipe.ts";
import { goHome } from "../morning/recipe.ts";
import { collectPet } from "../pets/recipe.ts";
import { claimVip } from "../vip/recipe.ts";

const sequence = (description: string, steps: { name: string; recipe: Recipe }[]): Recipe => ({
  description,
  run: async (phone, settings) => {
    const time = clock(settings.env.CLOCK);
    for (const step of steps) {
      console.log(`\n${time()} == ${step.name} ==`);
      await step.recipe.run(phone, settings).catch((e) => console.log(`stopped: ${e.message}`));
      if (!(await goHome(phone, 5))) {
        console.log(`${time()} could not get back to the world map after ${step.name}, stopping`);
        return;
      }
    }
    console.log(`\n${time()} done`);
  },
});

export const collectAll = sequence("Runs every collect task: the pets, Conquest, the Backpack, then the daily missions.", [
  { name: "collect-pet", recipe: collectPet },
  { name: "collect-conquest", recipe: collectConquest },
  { name: "collect-backpack", recipe: collectBackpack },
  { name: "collect-daily", recipe: collectDaily },
]);

export const claimAll = sequence("Runs every claim task: the mail, the alliance, the store freebies, then VIP.", [
  { name: "claim-mail", recipe: claimMail },
  { name: "claim-alliance", recipe: claimAlliance },
  { name: "claim-freebies", recipe: claimFreebies },
  { name: "claim-vip", recipe: claimVip },
]);
