import { assertEquals, assertRejects } from "@std/assert";
import { leaveRewards, openFromWorld, runFlow } from "./flow.ts";
import { backArrow, closeDialog } from "./screen.ts";
import { fakePhone, line } from "./testing.ts";
import { goHome, mapButton, marchesOn, onWorld } from "./world.ts";

Deno.test("a flow follows its screens until one gives a reason", async () => {
  const { phone, taps } = fakePhone([[line("Town", 361, 838)], [line("Shop")], [line("Town", 361, 838)]]);
  const button = { x: 10, y: 20 };
  const reason = await runFlow(phone, {
    name: "test",
    lostMs: 1000,
    start: { opens: 0, leaving: false },
    screen: async (s, { lines }) => {
      if (onWorld(lines)) return await openFromWorld(phone, s, button, 0, "done", "did not open");
      return { ...s, leaving: true };
    },
  });
  assertEquals(reason, "done");
  assertEquals(taps, [button]);
});

Deno.test("a flow gives up on a screen nobody recognises", async () => {
  const { phone } = fakePhone([[line("???")]]);
  const reason = await runFlow(phone, {
    name: "test",
    lostMs: -1,
    start: { done: 2 },
    screen: () => Promise.resolve(undefined),
    lost: (s) => `${s.done} done`,
  }).catch((e) => e.message);
  assertEquals(reason, "did not recognise the screen, see build/test-lost.png, 2 done");
});

Deno.test("opening from the world map stops after four tries", async () => {
  const { phone, taps } = fakePhone([]);
  await assertRejects(() => openFromWorld(phone, { opens: 4, leaving: false }, backArrow, 0, "done", "did not open"));
  assertEquals(await openFromWorld(phone, { opens: 1, leaving: false }, backArrow, 0, "done", "did not open"), {
    opens: 2,
    leaving: false,
  });
  assertEquals(taps.length, 1);
});

Deno.test("leaving rewards does nothing on other screens", async () => {
  const { phone, taps } = fakePhone([]);
  assertEquals(await leaveRewards(phone, [line("Town")]), false);
  assertEquals(taps, []);
});

Deno.test("going home stops at the world map", async () => {
  const { phone, taps } = fakePhone([[line("Town", 361, 838)]]);
  assertEquals(await goHome(phone, 5), true);
  assertEquals(taps, []);
  assertEquals(await goHome(fakePhone([[line("Shop")]]).phone, 0), false);
});

Deno.test("going home closes a window the back arrow leaves open and leaves the town map", async () => {
  const town = [line("Conquest", 40, 839), line("World", 362, 838)];
  const { phone, taps } = fakePhone([[line("Pet Skill")], [line("Pet Skill")], town, [line("Town", 361, 838)]]);
  assertEquals(await goHome(phone, 8), true);
  assertEquals(taps, [backArrow, closeDialog, mapButton]);
});

Deno.test("the town map is not taken for the world map", () => {
  assertEquals(onWorld([line("Conquest", 40, 839), line("World", 362, 838)]), false);
  assertEquals(onWorld([line("Conquest", 40, 839), line("Town", 361, 838)]), true);
  assertEquals(onWorld([line("Conquest", 40, 839)]), true);
  assertEquals(onWorld([line("Town", 44, 245), line("World", 362, 838)]), false);
});

Deno.test("marches are read from the counter under the top bar", () => {
  assertEquals(marchesOn([line("2/5", 100, 175)]), { used: 2, total: 5 });
  assertEquals(marchesOn([line("2/5", 100, 400)]), undefined);
  assertEquals(marchesOn([line("12/50", 100, 175)]), undefined);
});
