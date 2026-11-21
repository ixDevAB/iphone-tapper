import { pick, sequence } from "./steps.ts";

export const collectAll = sequence(
  "Runs every collect task: the pets, Conquest, the Backpack, then the daily missions.",
  pick(["collect-pet", "collect-conquest", "collect-backpack", "collect-daily"]),
);

export const claimAll = sequence(
  "Runs every claim task: the mail, the alliance, the store freebies, then VIP.",
  pick(["claim-mail", "claim-alliance", "claim-freebies", "claim-vip"]),
);
