import { calibrate } from "../recipes/heal/calibrate.ts";
import { intel } from "../recipes/intel/recipe.ts";
import { claimAlliance } from "../recipes/alliance/recipe.ts";
import { claimMail } from "../recipes/mail/recipe.ts";
import { collectPet } from "../recipes/pets/recipe.ts";
import { claimFreebies } from "../recipes/freebies/recipe.ts";
import { heal } from "../recipes/heal/recipe.ts";
import { morning } from "../recipes/morning/recipe.ts";
import { recruit } from "../recipes/recruit/recipe.ts";
import { shop } from "../recipes/shop/recipe.ts";
import { terrorHunt } from "../recipes/terror/recipe.ts";
import { claimVip } from "../recipes/vip/recipe.ts";
import type { Phone } from "./phone.ts";

export type Settings = {
  intervalMs: number;
  maxIdleMs: number;
  env: Record<string, string>;
};

export type Recipe = {
  description: string;
  run: (phone: Phone, settings: Settings) => Promise<void>;
};

export const recipes: Record<string, Recipe> = {
  heal,
  calibrate,
  intel,
  "collect-pet": collectPet,
  "terror-hunt": terrorHunt,
  "claim-mail": claimMail,
  "claim-alliance": claimAlliance,
  recruit,
  morning,
  shop,
  "claim-freebies": claimFreebies,
  "claim-vip": claimVip,
};
