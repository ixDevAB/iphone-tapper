import { writeAlliance } from "../chat/recipe.ts";
import { heal } from "../heal/recipe.ts";
import { hour, onlyInTheMorning, sequence, type Step, steps } from "../all/steps.ts";

export const morningMessage: Step = {
  name: "morning-message",
  recipe: { description: "Writes MORNING_MESSAGE in the alliance chat.", run: writeAlliance.run },
  every: "day",
  env: (env) => ({ ...env, CHAT_TEXT: env.MORNING_MESSAGE ?? "", CHAT_DRY: "" }),
  when: (env) => (env.MORNING_MESSAGE ?? "").trim().length > 0,
};

export const healAll: Step = {
  name: "heal-all",
  recipe: { description: "Presses Heal once for the injured troops.", run: heal.run },
  every: 4 * hour,
  env: (env) => ({ ...env, HEAL_ALL: "1" }),
};

export const morning = sequence(
  "The morning round: your MORNING_MESSAGE in the alliance chat when one is set, intel, two Terror rallies with Diana and Fahd, all mail, the alliance chests and contributions, the Nomadic Merchant (the VIP XP item for gems only with --buy-vip), the free hero recruits, the pets, the store freebies, the VIP claims, Conquest, the Backpack, troop training, the island water, the online reward, the Mystic Trials, the daily missions, then one press on Heal for the injured troops.",
  [morningMessage, ...steps, healAll],
);

export const evening = sequence(
  "The evening round. It skips what is only done once a day (the Terror rallies, the store freebies and the VIP claims) and runs everything else from the morning round. The Mystic Trials are skipped too when they were already played today.",
  steps.filter((step) => !onlyInTheMorning.includes(step.name)),
);
