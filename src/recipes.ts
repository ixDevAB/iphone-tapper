import { kingshotHeal } from "../recipes/kingshot-heal/recipe.ts";
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
  "kingshot-heal": kingshotHeal,
};
