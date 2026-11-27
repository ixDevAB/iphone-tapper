import { assertEquals } from "@std/assert";
import facts from "./facts.json" with { type: "json" };
import dated from "./on_this_day.json" with { type: "json" };
import { dailyFact, dateKey, dayOfYear, fill, generalFact, onThisDay, pickChoice } from "./facts.ts";

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
  assertEquals(generalFact(new Date(2026, 0, 1), few), "One.");
  assertEquals(generalFact(new Date(2026, 0, 2), few), "Two.");
  assertEquals(generalFact(new Date(2026, 0, 4), few), "One.");
  assertEquals(
    fill("Good morning KON!  {daily_fact}", new Date(2026, 0, 3), { general: few, dated: [] }),
    "Good morning KON! Three.",
  );
  assertEquals(fill("Good morning KON!", new Date(2026, 0, 3), { general: few, dated: [] }), "Good morning KON!");
  assertEquals(fill(" {daily_fact} ", new Date(2026, 0, 3), { general: [], dated: [] }), "");
  assertEquals(generalFact(new Date(2028, 11, 31)), facts[0].fact);
});

Deno.test("a rand part is only written the given share of the time", () => {
  const day = new Date(2026, 0, 1);
  const few = [{ region: "a", fact: "One." }];
  const template = `Good morning! {rand%20 "Rally at reset."} {daily_fact}`;
  assertEquals(fill(template, day, { general: few, dated: [] }, () => 0.1), "Good morning! Rally at reset. One.");
  assertEquals(fill(template, day, { general: few, dated: [] }, () => 0.2), "Good morning! One.");
  assertEquals(fill(template, day, { general: few, dated: [] }, () => 0.9), "Good morning! One.");
  assertEquals(fill(`{rand%100 'always'} {rand%0 "never"}`, day, { general: few, dated: [] }, () => 0.999), "always");
  assertEquals(fill(`{rand%50 "fact: {daily_fact}"}`, day, { general: few, dated: [] }, () => 0.4), "fact: One.");
  assertEquals(fill(`{rand%50 "maybe"}`, day, { general: few, dated: [] }, () => 0.6), "");
  assertEquals(fill(`{rand%2.5 "rare"} hi`, day, { general: few, dated: [] }, () => 0.02), "rare hi");
  const rolls = [0.1, 0.9];
  assertEquals(fill(`{rand%50 "a"} {rand%50 "b"}`, day, { general: few, dated: [] }, () => rolls.shift() ?? 1), "a");
});

Deno.test("with | only one of the texts is written, each with its own share of one roll", () => {
  const day = new Date(2026, 0, 1);
  const few = [{ region: "a", fact: "One." }];
  const beer = `hi {rand%5 'get WALKER a beer' | rand%0.5 'get WALKER a beer, stat!'}`;
  assertEquals(fill(beer, day, { general: few, dated: [] }, () => 0.049), "hi get WALKER a beer");
  assertEquals(fill(beer, day, { general: few, dated: [] }, () => 0.05), "hi get WALKER a beer, stat!");
  assertEquals(fill(beer, day, { general: few, dated: [] }, () => 0.0549), "hi get WALKER a beer, stat!");
  assertEquals(fill(beer, day, { general: few, dated: [] }, () => 0.055), "hi");
  assertEquals(fill(beer, day, { general: few, dated: [] }, () => 0.99), "hi");
  const rolls = Array.from({ length: 1000 }, (_, i) => i / 1000);
  const texts = rolls.map((r) => fill(beer, day, { general: few, dated: [] }, () => r));
  assertEquals(texts.filter((m) => m.endsWith("beer")).length, 50);
  assertEquals(texts.filter((m) => m.endsWith("stat!")).length, 5);
  assertEquals(
    texts.filter((m) => m.includes("beer") && m.includes("stat!") && m.indexOf("beer") !== m.lastIndexOf("beer"))
      .length,
    0,
  );
  assertEquals(fill(`{rand%30 "a" | rand%30 "b" | "the rest"}`, day, { general: few, dated: [] }, () => 0.1), "a");
  assertEquals(fill(`{rand%30 "a" | rand%30 "b" | "the rest"}`, day, { general: few, dated: [] }, () => 0.5), "b");
  assertEquals(
    fill(`{rand%30 "a" | rand%30 "b" | "the rest"}`, day, { general: few, dated: [] }, () => 0.7),
    "the rest",
  );
  assertEquals(
    fill(`{rand%50 'a | b' | rand%50 "it's {daily_fact}"}`, day, { general: few, dated: [] }, () => 0.2),
    "a | b",
  );
  assertEquals(
    fill(`{rand%50 'a | b' | rand%50 "it's {daily_fact}"}`, day, { general: few, dated: [] }, () => 0.7),
    "it's One.",
  );
  assertEquals(pickChoice([], 10), "");
});

Deno.test("the daily fact is what happened on this day four times in five, and a general fact otherwise", () => {
  const from = {
    general: [{ region: "a", fact: "General." }],
    dated: [{ date: "11-27", year: 1895, region: "Europe", fact: "On this day in 1895, something happened." }],
  };
  const day = new Date(2026, 10, 27);
  const other = new Date(2026, 10, 28);
  assertEquals(dateKey(day), "11-27");
  assertEquals(dateKey(new Date(2028, 1, 29)), "02-29");
  assertEquals(onThisDay(day, from.dated), "On this day in 1895, something happened.");
  assertEquals(onThisDay(other, from.dated), "");
  assertEquals(dailyFact(day, from, 79.9), "On this day in 1895, something happened.");
  assertEquals(dailyFact(day, from, 80), "General.");
  assertEquals(dailyFact(other, from, 10), "General.");
  assertEquals(dailyFact(day, { general: [], dated: from.dated }, 99), "On this day in 1895, something happened.");
  const rolls = Array.from({ length: 1000 }, (_, i) => i / 1000);
  assertEquals(rolls.filter((r) => fill("{daily_fact}", day, from, () => r).startsWith("On this day")).length, 800);
  assertEquals(
    fill("{on_this_day} / {history_fact}", day, from, () => 0.99),
    "On this day in 1895, something happened. / General.",
  );
  assertEquals(fill("{on_this_day}", other, from, () => 0.1), "General.");
  const two = [0.9, 0.1];
  assertEquals(
    fill("{rand%50 'x'} {daily_fact}", day, from, () => two.shift() ?? 1),
    "On this day in 1895, something happened.",
  );
});

Deno.test("every date of the year, 29 February included, has one event that happened on it", () => {
  const lengths = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const dates = lengths.flatMap((days, month) =>
    Array.from(
      { length: days },
      (_, day) => `${String(month + 1).padStart(2, "0")}-${String(day + 1).padStart(2, "0")}`,
    )
  );
  assertEquals(dated.map((d) => d.date), dates);
  assertEquals(
    dated.filter((d) => {
      const year = d.year < 0 ? `${-d.year} BC` : String(d.year);
      return !d.fact.startsWith(`On this day in ${year}, `) || d.fact.length > 125 || /[^\x20-\x7e]/.test(d.fact) ||
        !d.fact.endsWith(".") || !d.source.startsWith("https://en.wikipedia.org/");
    }),
    [],
  );
  assertEquals(dated.filter((d) => d.region === "Europe").length <= 40, true);
  assertEquals(onThisDay(new Date(2028, 1, 29)).startsWith("On this day in 1940, "), true);
});

Deno.test("a choice can be the name of a fact list, so the share is written in the message itself", () => {
  const from = {
    general: [{ region: "a", fact: "General." }],
    dated: [{ date: "11-27", year: 1895, region: "Europe", fact: "On this day in 1895, something happened." }],
  };
  const day = new Date(2026, 10, 27);
  const today = "On this day in 1895, something happened.";
  for (
    const template of [
      "{rand%80onthisday|history_fact}",
      "{rand%80 on_this_day | history_fact}",
      "{rand%80 on_this_day|rand%20 history_fact}",
    ]
  ) {
    assertEquals(fill(template, day, from, () => 0.79), today);
    assertEquals(fill(template, day, from, () => 0.8), "General.");
    const rolls = Array.from({ length: 1000 }, (_, i) => i / 1000);
    assertEquals(rolls.filter((r) => fill(template, day, from, () => r) === today).length, 800);
  }
  assertEquals(fill("Hi! {rand%30 history_fact | 'Nothing today.'}", day, from, () => 0.5), "Hi! Nothing today.");
  assertEquals(fill("{rand%50 on_this_day}", day, from, () => 0.7), "");
  assertEquals(fill("{rand%100 hello}", day, from, () => 0.7), "hello");
});
