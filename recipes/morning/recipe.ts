import { onlyInTheMorning, sequence, steps } from "../all/steps.ts";

export const morning = sequence(
  "The morning round: intel, two Terror rallies with Diana and Fahd, all mail, the alliance chests and contributions, the Nomadic Merchant (the VIP XP item for gems only with --buy-vip), the free hero recruits, the pets, the store freebies, the VIP claims, Conquest, the Backpack, troop training, the island water, the online reward, the Mystic Trials, then the daily missions.",
  steps,
);

export const evening = sequence(
  "The evening round. It skips what is only done once a day (the Terror rallies, the store freebies and the VIP claims) and runs everything else from the morning round. The Mystic Trials are skipped too when they were already played today.",
  steps.filter((step) => !onlyInTheMorning.includes(step.name)),
);
