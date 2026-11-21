import { assertEquals } from "@std/assert";
import { changes } from "./decisions.ts";
import { told } from "./why.ts";

Deno.test("a decision is told on one line", () => {
  assertEquals(
    told({ at: "2026-11-21 22:47:31", task: "collect-backpack", decision: "left alone", item: "1m wood", row: 500 }),
    "22:47:31 collect-backpack  left alone item=1m wood row=500",
  );
  assertEquals(
    told({ at: "2026-11-21 22:47:31", task: "collect-pet", decision: "read the screen", texts: ["Hunt AIl @201,760"] }),
    "22:47:31 collect-pet       read the screen: Hunt AIl @201,760",
  );
});

Deno.test("only what changed in the state is written down", () => {
  assertEquals(changes({ opens: 0, leaving: false, tab: 1 }, { opens: 1, leaving: false, tab: 1 }), { opens: 1 });
  assertEquals(changes({ face: new Uint8Array([1, 2]) }, { face: new Uint8Array([3, 4]) }), {});
});
