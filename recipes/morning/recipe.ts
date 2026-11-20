import { clock } from "../../src/clock.ts";
import type { Phone } from "../../src/phone.ts";
import type { Recipe } from "../../src/recipes.ts";
import { has } from "../../src/screen.ts";
import { sleep } from "../../src/wda.ts";
import { claimAlliance } from "../alliance/recipe.ts";
import { intel } from "../intel/recipe.ts";
import { claimMail } from "../mail/recipe.ts";
import { collectPet } from "../pets/recipe.ts";
import { recruit } from "../recruit/recipe.ts";
import { shop } from "../shop/recipe.ts";
import { terrorHunt } from "../terror/recipe.ts";

const backArrow = { x: 30, y: 77 };

const goHome = async (phone: Phone, tries: number): Promise<boolean> => {
  const lines = await phone.ocrPng(await phone.snap());
  if (has(lines, /^Town$/i)) return true;
  if (tries <= 0) return false;
  await phone.tap(backArrow);
  await sleep(1500);
  return goHome(phone, tries - 1);
};

export const morning: Recipe = {
  description: "The morning round: intel, two Terror rallies with Diana and Fahd, all mail, the alliance chests and contributions, the Nomadic Merchant with VIP XP, the free hero recruits, then the pets.",
  run: async (phone, settings) => {
    const time = clock(settings.env.CLOCK);
    const hunt = {
      ...settings.env,
      AMOUNT: settings.env.AMOUNT || "2",
      HUNT_ARCH: settings.env.HUNT_ARCH || "diana",
      HUNT_CAV: settings.env.HUNT_CAV || "fahd",
    };
    const steps = [
      { name: "intel", recipe: intel, env: settings.env },
      { name: "terror-hunt", recipe: terrorHunt, env: hunt },
      { name: "claim-mail", recipe: claimMail, env: settings.env },
      { name: "claim-alliance", recipe: claimAlliance, env: settings.env },
      { name: "shop", recipe: shop, env: { ...settings.env, SHOP_BUY_VIP: "1" } },
      { name: "recruit", recipe: recruit, env: settings.env },
      { name: "collect-pet", recipe: collectPet, env: settings.env },
    ];
    for (const step of steps) {
      console.log(`\n${time()} == ${step.name} ==`);
      await step.recipe.run(phone, { ...settings, env: step.env }).catch((e) => console.log(`stopped: ${e.message}`));
      if (!(await goHome(phone, 5))) {
        console.log(`${time()} could not get back to the world map after ${step.name}, stopping the morning round`);
        return;
      }
    }
    console.log(`\n${time()} morning round done`);
  },
};
