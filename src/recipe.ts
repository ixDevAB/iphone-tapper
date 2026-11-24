import type { Phone } from "./phone.ts";
import type { Runs } from "./runs.ts";

export type Env = Record<string, string>;

export type Settings = {
  intervalMs: number;
  maxIdleMs: number;
  env: Env;
  given: string[];
  runs: Runs;
};

export type Recipe = {
  description: string;
  flags?: Env;
  switches?: Env;
  amount?: string;
  words?: string;
  repeats?: number;
  run: (phone: Phone, settings: Settings) => Promise<void | number>;
};

export const on = (env: Env, name: string) => env[name] === "1";

export const optionsOf = (recipes: Recipe[]) => ({
  flags: Object.fromEntries(recipes.flatMap((r) => Object.entries(r.flags ?? {}))),
  switches: Object.fromEntries(recipes.flatMap((r) => Object.entries(r.switches ?? {}))),
  amount: recipes.find((r) => r.amount)?.amount,
});
