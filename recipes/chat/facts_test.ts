import { assertEquals } from "@std/assert";
import facts from "./facts.json" with { type: "json" };
import { dayOfYear, factFor, fill, pickChoice } from "./facts.ts";

Deno.test("there is one short plain fact for every day of the year, from all over the world", () => {
  assertEquals(facts.length, 365);
  assertEquals(new Set(facts.map((f) => f.fact)).size, 365);
  assertEquals(facts.filter((f) => f.fact.length > 120 || /[^\x20-\x7e]/.test(f.fact) || !f.fact.endsWith(".")), []);
  const europe = facts.filter((f) => f.region === "Europe").length;
  assertEquals(europe <= 55, true);
  assertEquals(new Set(facts.map((f) => f.region)).size, 8);
  assertEquals(facts.filter((f, i) => i > 0 && facts[i - 1].region === f.region).length <= 12, true);
});

Deno.test("the fact follows the day of the year and fills the message", () => {
  const few = [{ region: "a", fact: "One." }, { region: "b", fact: "Two." }, { region: "c", fact: "Three." }];
  assertEquals(dayOfYear(new Date(2026, 0, 1)), 1);
  assertEquals(dayOfYear(new Date(2026, 11, 31)), 365);
  assertEquals(dayOfYear(new Date(2028, 11, 31)), 366);
  assertEquals(factFor(new Date(2026, 0, 1), few), "One.");
  assertEquals(factFor(new Date(2026, 0, 2), few), "Two.");
  assertEquals(factFor(new Date(2026, 0, 4), few), "One.");
  assertEquals(fill("Good morning KON!  {daily_fact}", new Date(2026, 0, 3), few), "Good morning KON! Three.");
  assertEquals(fill("Good morning KON!", new Date(2026, 0, 3), few), "Good morning KON!");
  assertEquals(fill(" {daily_fact} ", new Date(2026, 0, 3), []), "");
  assertEquals(factFor(new Date(2028, 11, 31)), facts[0].fact);
});

Deno.test("a rand part is only written the given share of the time", () => {
  const day = new Date(2026, 0, 1);
  const few = [{ region: "a", fact: "One." }];
  const template = `Good morning! {rand%20 "Rally at reset."} {daily_fact}`;
  assertEquals(fill(template, day, few, () => 0.1), "Good morning! Rally at reset. One.");
  assertEquals(fill(template, day, few, () => 0.2), "Good morning! One.");
  assertEquals(fill(template, day, few, () => 0.9), "Good morning! One.");
  assertEquals(fill(`{rand%100 'always'} {rand%0 "never"}`, day, few, () => 0.999), "always");
  assertEquals(fill(`{rand%50 "fact: {daily_fact}"}`, day, few, () => 0.4), "fact: One.");
  assertEquals(fill(`{rand%50 "maybe"}`, day, few, () => 0.6), "");
  assertEquals(fill(`{rand%2.5 "rare"} hi`, day, few, () => 0.02), "rare hi");
  const rolls = [0.1, 0.9];
  assertEquals(fill(`{rand%50 "a"} {rand%50 "b"}`, day, few, () => rolls.shift() ?? 1), "a");
});

Deno.test("with | only one of the texts is written, each with its own share of one roll", () => {
  const day = new Date(2026, 0, 1);
  const few = [{ region: "a", fact: "One." }];
  const beer = `hi {rand%5 'get WALKER a beer' | rand%0.5 'get WALKER a beer, stat!'}`;
  assertEquals(fill(beer, day, few, () => 0.049), "hi get WALKER a beer");
  assertEquals(fill(beer, day, few, () => 0.05), "hi get WALKER a beer, stat!");
  assertEquals(fill(beer, day, few, () => 0.0549), "hi get WALKER a beer, stat!");
  assertEquals(fill(beer, day, few, () => 0.055), "hi");
  assertEquals(fill(beer, day, few, () => 0.99), "hi");
  const rolls = Array.from({ length: 1000 }, (_, i) => i / 1000);
  const texts = rolls.map((r) => fill(beer, day, few, () => r));
  assertEquals(texts.filter((m) => m.endsWith("beer")).length, 50);
  assertEquals(texts.filter((m) => m.endsWith("stat!")).length, 5);
  assertEquals(
    texts.filter((m) => m.includes("beer") && m.includes("stat!") && m.indexOf("beer") !== m.lastIndexOf("beer"))
      .length,
    0,
  );
  assertEquals(fill(`{rand%30 "a" | rand%30 "b" | "the rest"}`, day, few, () => 0.1), "a");
  assertEquals(fill(`{rand%30 "a" | rand%30 "b" | "the rest"}`, day, few, () => 0.5), "b");
  assertEquals(fill(`{rand%30 "a" | rand%30 "b" | "the rest"}`, day, few, () => 0.7), "the rest");
  assertEquals(fill(`{rand%50 'a | b' | rand%50 "it's {daily_fact}"}`, day, few, () => 0.2), "a | b");
  assertEquals(fill(`{rand%50 'a | b' | rand%50 "it's {daily_fact}"}`, day, few, () => 0.7), "it's One.");
  assertEquals(pickChoice([], 10), "");
});
