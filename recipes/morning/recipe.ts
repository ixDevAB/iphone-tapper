import { sequence, steps } from "../all/steps.ts";

export const morning = sequence(
  "The morning round: intel, two Terror rallies with Diana and Fahd, all mail, the alliance chests and contributions, the Nomadic Merchant with VIP XP, the free hero recruits, the pets, the store freebies, the VIP claims, Conquest, the Backpack, then the daily missions.",
  steps,
);

export const evening = sequence(
  "The evening round: the morning round without the once a day tasks (no Terror rallies, store freebies or VIP claims). Intel, all mail, the alliance, the Nomadic Merchant, the free hero recruits, the pets, Conquest, the Backpack, then the daily missions.",
  steps.filter((step) => step.every !== "day"),
);
