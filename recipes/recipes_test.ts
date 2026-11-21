import { assertEquals } from "@std/assert";
import { amountOf } from "../src/rewards.ts";
import { center, exact, has } from "../src/screen.ts";
import { line, picture } from "../src/testing.ts";
import { secondsIn } from "../src/time.ts";
import { colourAt, rowsIn } from "./backpack/tiles.ts";
import { withSetting } from "./heal/calibrate.ts";
import { alliesFrom, amountIn } from "./heal/window.ts";
import { findMarkers } from "./intel/markers.ts";

Deno.test("reward amounts understand separators and units", () => {
  assertEquals(amountOf("x1,234"), 1234);
  assertEquals(amountOf("13.2K"), 13200);
  assertEquals(amountOf("2M"), 2000000);
  assertEquals(amountOf("no number"), 1);
});

Deno.test("timers become seconds", () => {
  assertEquals(secondsIn("01:02:03"), 3723);
  assertEquals(secondsIn("05:30"), 330);
});

Deno.test("text lines are found by exact text and by pattern", () => {
  const lines = [line(" Claim ", 100, 200), line("Claim All", 300, 400)];
  assertEquals(exact(lines, "claim").length, 1);
  assertEquals(center(exact(lines, "Claim")[0]), { x: 100, y: 200 });
  assertEquals(has(lines, /^claim all$/i), true);
});

Deno.test("the ally count is read from the help text", () => {
  assertEquals(alliesFrom([{ text: "5 Allies have helped" }]), 5);
  assertEquals(alliesFrom([{ text: "12 Alles" }]), 12);
  assertEquals(alliesFrom([{ text: "Ally has helped" }]), 1);
  assertEquals(alliesFrom([{ text: "Heal" }]), undefined);
});

Deno.test("the batch amount is read from the infantry box", () => {
  const box = { text: "1,260", x: 0.7, y: 0.4, width: 0.1, height: 0.02 };
  assertEquals(amountIn([box]), 1260);
  assertEquals(amountIn([{ ...box, y: 0.5 }]), undefined);
  assertEquals(amountIn([{ ...box, y: 0.5 }], 0.1), 1260);
});

Deno.test("a setting is replaced in or added to the env file", () => {
  assertEquals(withSetting("A=1\nB=2\n", "A", 5), "A=5\nB=2\n");
  assertEquals(withSetting("A=1", "B", 2), "A=1\nB=2\n");
  assertEquals(withSetting("", "B", 2), "B=2\n");
});

Deno.test("backpack rows come from the counts under the tiles", () => {
  const lines = [
    line("12", 80, 226),
    line("3", 175, 228),
    line("1,500", 80, 321),
    line("7", 270, 320),
    line("Use", 200, 600),
  ];
  assertEquals(rowsIn(lines), [200, 294]);
});

Deno.test("backpack tile colours are read from the tile frame", () => {
  const green = picture(1206, 900, [{ at: { x: 0, y: 0, width: 1206, height: 900 }, rgb: [60, 170, 80] }]);
  const white = picture(1206, 900, [{ at: { x: 0, y: 0, width: 1206, height: 900 }, rgb: [240, 240, 240] }]);
  assertEquals(colourAt(green, 155, 200), "green");
  assertEquals(colourAt(white, 155, 200), "none");
});

Deno.test("intel markers are found by colour, checks included", () => {
  const img = picture(1206, 2622, [
    { at: { x: 300, y: 900, width: 60, height: 60 }, rgb: [20, 90, 153] },
    { at: { x: 600, y: 1500, width: 60, height: 60 }, rgb: [133, 80, 13] },
    { at: { x: 900, y: 1200, width: 24, height: 24 }, rgb: [80, 190, 57] },
    { at: { x: 100, y: 2000, width: 12, height: 12 }, rgb: [20, 90, 153] },
  ]);
  assertEquals(findMarkers(img), [
    { kind: "blue", size: 100, x: 109, y: 309 },
    { kind: "check", size: 16, x: 303, y: 403 },
    { kind: "gold", size: 100, x: 209, y: 509 },
  ]);
});
