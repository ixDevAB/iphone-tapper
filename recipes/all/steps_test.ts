import { assertEquals } from "@std/assert";
import type { Settings } from "../../src/recipe.ts";
import { openRuns } from "../../src/runs.ts";
import { doneToday, hour, logged, nextAt, nextReset, pick, steps } from "./steps.ts";

const noon = Date.UTC(2026, 10, 21, 12);
const [vip] = pick(["claim-vip"]);
const [mail] = pick(["claim-mail"]);

const settingsWith = (env = {}): Settings => ({
  intervalMs: 0,
  maxIdleMs: 0,
  env,
  given: [],
  runs: openRuns(":memory:"),
});

Deno.test("the day resets at the given utc hour", () => {
  assertEquals(nextReset(noon, 0), Date.UTC(2026, 10, 22, 0));
  assertEquals(nextReset(noon, 18), Date.UTC(2026, 10, 21, 18));
  assertEquals(nextReset(Date.UTC(2026, 10, 21, 0), 0), Date.UTC(2026, 10, 22, 0));
});

Deno.test("a task is due after its interval, its own timer, the reset or a short retry", () => {
  assertEquals(nextAt(mail, true, undefined, noon, 0), noon + 2 * hour * 1000);
  assertEquals(nextAt(mail, true, 90, noon, 0), noon + 90 * 1000);
  assertEquals(nextAt(vip, true, undefined, noon, 0), Date.UTC(2026, 10, 22, 0));
  assertEquals(nextAt(vip, false, undefined, noon, 0), noon + 30 * 60 * 1000);
});

Deno.test("only once a day tasks that went well count as done today", async () => {
  const settings = settingsWith();
  assertEquals(doneToday(settings, vip), undefined);
  await logged(settings, vip.name, vip, () => Promise.reject(new Error("the vip screen did not open")));
  assertEquals(settings.runs.last(vip.name)?.error, "the vip screen did not open");
  assertEquals(doneToday(settings, vip), undefined);
  const next = await logged(settings, vip.name, vip, () => Promise.resolve());
  assertEquals(doneToday(settings, vip), next);
  assertEquals(doneToday({ ...settings, env: { RUN_AGAIN: "1" } }, vip), undefined);
  await logged(settings, mail.name, mail, () => Promise.resolve());
  assertEquals(doneToday(settings, mail), undefined);
  assertEquals(settings.runs.recent(10).map((r) => r.task), ["claim-mail", "claim-vip", "claim-vip"]);
});

Deno.test("every step has a name of its own", () => {
  assertEquals(new Set(steps.map((s) => s.name)).size, steps.length);
});
