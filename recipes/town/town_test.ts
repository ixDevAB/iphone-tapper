import { assertEquals, assertThrows } from "@std/assert";
import { line } from "../../src/testing.ts";
import { onTownMap, onWorldMap, row, secondsLeft } from "../../src/town.ts";
import { order, percentsIn, ratioFrom, ratiosFrom } from "./trials.ts";

Deno.test("a troop ratio is three whole numbers adding up to 100", () => {
  assertEquals(ratioFrom("50/10/40"), [50, 10, 40]);
  assertEquals(ratioFrom(" 45 / 20 / 35 "), [45, 20, 35]);
  assertEquals(ratioFrom("50/10/30"), undefined);
  assertEquals(ratioFrom("50/50"), undefined);
  assertEquals(ratioFrom("a/b/c"), undefined);
});

Deno.test("trial ratios come only from the settings", () => {
  const nexus = (env: Record<string, string>) => ratiosFrom(env).find((t) => t.name === "Knowledge Nexus")?.ratio;
  assertEquals(nexus({}), undefined);
  assertEquals(nexus({ TRIAL_KNOWLEDGE_NEXUS: "40/20/40" }), [40, 20, 40]);
  assertThrows(() => ratiosFrom({ TRIAL_MOLTEN_FORT: "60/60/10" }));
});

Deno.test("the troop ratio line is read as three percentages", () => {
  assertEquals(percentsIn(["Troop Ratio:", "50%", "10%", "40%"]), [50, 10, 40]);
  assertEquals(percentsIn(["Troop Ratio: 50 % 20% 30%"]), [50, 20, 30]);
});

Deno.test("percentages are lowered before others are raised", () => {
  assertEquals(order([50, 20, 30], [50, 10, 40]), [1, 2]);
  assertEquals(order([34, 33, 33], [60, 15, 25]), [1, 2, 0]);
  assertEquals(order([50, 10, 40], [50, 10, 40]), []);
});

Deno.test("a row of the town list gives its status and its button", () => {
  const lines = [
    line("Online Rewards", 125, 298),
    line("Completed", 125, 316),
    line("Fountain of Life", 126, 402),
    line("Available: 1,582/5,040", 125, 420),
    line("Infantry", 122, 402),
  ];
  assertEquals(row(lines, "Online Rewards"), { status: "Completed", button: { x: 226, y: 307 } });
  assertEquals(row(lines, "Fountain of Life")?.status, "Available: 1,582/5,040");
  assertEquals(row(lines, "Purifier"), undefined);
});

Deno.test("timers with and without days become seconds", () => {
  assertEquals(secondsLeft("00:02:28"), 148);
  assertEquals(secondsLeft("Opens in 02:16:25"), 8185);
  assertEquals(secondsLeft("7d 21:58:07"), 683887);
  assertEquals(secondsLeft("Completed"), undefined);
});

Deno.test("the town map and the world map are told apart by the last button", () => {
  assertEquals(onTownMap([line("World", 362, 838)]), true);
  assertEquals(onWorldMap([line("Town", 361, 838)]), true);
  assertEquals(onWorldMap([line("Town", 361, 838), line("My Island", 86, 73)]), false);
  assertEquals(onTownMap([line("Town", 44, 245)]), false);
});
