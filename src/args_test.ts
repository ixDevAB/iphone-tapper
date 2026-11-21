import { assertEquals } from "@std/assert";
import { readArgs } from "./args.ts";
import type { Recipe } from "./recipe.ts";
import { recipes } from "./recipes.ts";

const recipe: Recipe = {
  description: "",
  flags: { "--level": "HUNT_LEVEL", "-l": "HUNT_LEVEL", "--rss": "BACKPACK_RSS" },
  switches: { "--force": "CONQUEST_FORCE", "--gourmet": "STAMINA_STOREHOUSE" },
  amount: "AMOUNT",
  run: () => Promise.resolve(),
};

Deno.test("value flags, short flags, switches and the amount become settings", () => {
  const args = readArgs(recipe, ["3", "--level", "7", "--rss", "grey,green", "--gourmet"]);
  assertEquals(args.error, undefined);
  assertEquals(args.env, { HUNT_LEVEL: "7", BACKPACK_RSS: "grey,green", STAMINA_STOREHOUSE: "1", AMOUNT: "3" });
  assertEquals(args.given.toSorted(), ["AMOUNT", "BACKPACK_RSS", "HUNT_LEVEL", "STAMINA_STOREHOUSE"]);
  assertEquals(readArgs(recipe, ["-l", "9"]).env, { HUNT_LEVEL: "9" });
});

Deno.test("a number that belongs to a flag is not the amount", () => {
  assertEquals(readArgs(recipe, ["--level", "7"]).env, { HUNT_LEVEL: "7" });
});

Deno.test("nothing given sets nothing", () => {
  assertEquals(readArgs(recipe, []), { env: {}, given: [], error: undefined });
});

Deno.test("unknown flags and missing values are reported", () => {
  assertEquals(readArgs(recipe, ["--tier", "X"]).error?.startsWith("unknown argument --tier"), true);
  assertEquals(readArgs(recipe, ["--level"]).error, "--level needs a value");
  assertEquals(readArgs(recipe, ["--level", "--force"]).error, "--level needs a value");
});

Deno.test("rebuild is accepted by every recipe", () => {
  assertEquals(readArgs({ ...recipe, flags: undefined, switches: undefined }, ["--rebuild"]).env, { WDA_REBUILD: "1" });
});

Deno.test("a recipe without an amount ignores a bare number", () => {
  assertEquals(readArgs({ ...recipe, amount: undefined }, ["3"]).env, {});
});

Deno.test("the rounds accept the arguments of their tasks", () => {
  const morning = readArgs(recipes.morning, ["3", "--pan", "--gourmet", "--embrace", "--force", "--rss", "grey"]);
  assertEquals(morning.error, undefined);
  assertEquals(morning.env, {
    AMOUNT: "3",
    INTEL_PAN: "1",
    STAMINA_STOREHOUSE: "1",
    STAMINA_EMBRACE: "1",
    CONQUEST_FORCE: "1",
    BACKPACK_RSS: "grey",
  });
  assertEquals(readArgs(recipes.run, ["--only", "recruit,shop"]).env, { RUN_ONLY: "recruit,shop" });
  assertEquals(readArgs(recipes["collect-all"], ["--force"]).error, undefined);
  assertEquals(readArgs(recipes["claim-all"], ["--force"]).error?.startsWith("unknown argument --force"), true);
});

Deno.test("flags of one recipe are not accepted by another", () => {
  assertEquals(readArgs(recipes.intel, ["--tier", "X"]).error?.startsWith("unknown argument --tier"), true);
  assertEquals(readArgs(recipes.calibrate, ["-t", "X", "-s", "100", "--save"]).env, {
    CALIBRATE_TIER: "X",
    CALIBRATE_START: "100",
    CALIBRATE_SAVE: "1",
  });
});

Deno.test("the evening round leaves out the once a day tasks", () => {
  assertEquals(readArgs(recipes.evening, ["--pan", "--gourmet", "--rss", "grey"]).error, undefined);
  assertEquals(readArgs(recipes.evening, ["--level", "7"]).error?.startsWith("unknown argument --level"), true);
  assertEquals(/Terror rallies with|two Terror/.test(recipes.evening.description), false);
});
