import { assertEquals } from "@std/assert";
import { crop } from "./image.ts";
import { freeName, likeness, nameFor, pick, shrunk } from "./naming.ts";
import { picture } from "./testing.ts";

const tile = (rgb: number[]) =>
  picture(216, 216, [
    { at: { x: 0, y: 0, width: 216, height: 216 }, rgb: [200, 180, 140] },
    { at: { x: 70, y: 60, width: 70, height: 80 }, rgb },
  ]);

Deno.test("a reward icon is the middle of the backpack tile at nine tenths of its size", () => {
  const sword = shrunk(tile([200, 30, 30]));
  const shield = shrunk(tile([30, 60, 200]));
  assertEquals([sword.width, sword.height], [194, 194]);
  const icon = crop(sword, { x: 48, y: 42, width: 96, height: 84 });
  assertEquals(likeness(sword, icon), 0);
  assertEquals(likeness(shield, icon) > 30, true);
  assertEquals(nameFor(icon, [{ name: "sword", img: sword }, { name: "shield", img: shield }]), "sword");
});

Deno.test("a name is only given when one picture fits clearly better than the others", () => {
  assertEquals(pick([{ name: "feast bag", d: 11.1 }, { name: "100k bread", d: 37.7 }]), "feast bag");
  assertEquals(
    pick([{ name: "100 enhancement xp part", d: 11.2 }, { name: "10 enhancement xp part", d: 13.9 }]),
    undefined,
  );
  assertEquals(pick([{ name: "liz shard", d: 19.5 }, { name: "luna shard", d: 50.9 }]), "liz shard");
  assertEquals(pick([{ name: "lucky hero gear chest", d: 23.2 }, { name: "charm chest", d: 24.8 }]), undefined);
  assertEquals(pick([{ name: "mobilization chest", d: 40 }, { name: "lesser truegold", d: 70 }]), undefined);
  assertEquals(
    pick([{ name: "weapon scraps", d: 7.9 }, { name: "weapon scraps", d: 9 }, { name: "arrow", d: 48 }]),
    "weapon scraps",
  );
  assertEquals(pick([]), undefined);
});

Deno.test("a second picture of a reward gets a number after its name", () => {
  assertEquals(freeName(["gems", "speedup"], "feast bag"), "feast bag");
  assertEquals(freeName(["weapon scraps"], "weapon scraps"), "weapon scraps~2");
  assertEquals(freeName(["weapon scraps", "weapon scraps~2"], "weapon scraps"), "weapon scraps~3");
});
