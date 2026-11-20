import { calibrate } from "../recipes/heal/calibrate.ts";
import { intel } from "../recipes/intel/recipe.ts";
import { collectPet } from "../recipes/pets/recipe.ts";
import { heal } from "../recipes/heal/recipe.ts";
import { terrorHunt } from "../recipes/terror/recipe.ts";
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
};
