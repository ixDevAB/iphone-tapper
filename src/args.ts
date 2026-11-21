import { parseArgs } from "@std/cli/parse-args";
import type { Env, Recipe } from "./recipe.ts";

const always = { "--rebuild": "WDA_REBUILD" };

const bare = (flag: string) => flag.replace(/^-+/, "");

export const readArgs = (recipe: Recipe, args: string[]) => {
  const flags = recipe.flags ?? {};
  const switches: Env = { ...recipe.switches, ...always };
  const usage = [...Object.keys(flags), ...Object.keys(switches)].join(" ");
  const unknown: string[] = [];

  const parsed: Record<string, unknown> = parseArgs(args, {
    string: Object.keys(flags).map(bare),
    boolean: Object.keys(switches).map(bare),
    unknown: (arg) => {
      if (arg.startsWith("-")) unknown.push(arg);
      return !arg.startsWith("-");
    },
  });

  const values = Object.entries(flags).flatMap(([flag, setting]) => {
    const value = parsed[bare(flag)];
    return typeof value === "string" ? [{ flag, setting, value }] : [];
  });
  const empty = values.find((v) => v.value === "" || v.value.startsWith("-"));
  const amount = recipe.amount ? (parsed._ as unknown[]).map(String).find((a) => /^\d+$/.test(a)) : undefined;

  const env: Env = {
    ...Object.fromEntries(values.map((v) => [v.setting, v.value])),
    ...Object.fromEntries(
      Object.entries(switches).flatMap(([flag, setting]) => parsed[bare(flag)] ? [[setting, "1"]] : []),
    ),
    ...(recipe.amount && amount ? { [recipe.amount]: amount } : {}),
  };

  const error = unknown.length
    ? `unknown argument ${unknown.join(" ")}, use ${usage}`
    : empty
    ? `${empty.flag} needs a value`
    : undefined;

  return { env, given: Object.keys(env), error };
};
