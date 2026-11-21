import { assertEquals } from "@std/assert";
import { greenButtons } from "./buttons.ts";
import { hasRedDot, redIn } from "./dots.ts";
import { bounds, count, hsv, regions, share } from "./pixels.ts";
import { picture } from "./testing.ts";

Deno.test("hsv reads hue, saturation and value", () => {
  assertEquals(hsv(255, 0, 0), [0, 100, 100]);
  assertEquals(hsv(0, 255, 0), [120, 100, 100]);
  assertEquals(hsv(0, 0, 255), [240, 100, 100]);
  assertEquals(hsv(0, 0, 0), [0, 0, 0]);
});

Deno.test("regions groups touching cells with the same label", () => {
  const labels = [..."1102" + "0002" + "1000"].map(Number);
  assertEquals(regions(labels, 4), [[0, 1], [3, 7], [8]]);
});

Deno.test("regions joins diagonal neighbours only when asked", () => {
  const labels = [..."10" + "01"].map(Number);
  assertEquals(regions(labels, 2).length, 2);
  assertEquals(regions(labels, 2, true).length, 1);
});

Deno.test("bounds gives the box around cells", () => {
  assertEquals(bounds([5, 6, 9], 4), { left: 1, right: 2, top: 1, bottom: 2 });
});

Deno.test("count and share measure the pixels that pass a test", () => {
  const img = picture(10, 10, [{ at: { x: 0, y: 0, width: 5, height: 10 }, rgb: [255, 255, 255] }]);
  const white = (r: number) => r > 200;
  assertEquals(count(img, { x: 0, y: 0, width: 10, height: 10 }, white), 50);
  assertEquals(share(img, { x: 0, y: 0, width: 10, height: 10 }, white), 0.5);
  assertEquals(count(img, { x: 4, y: 2, width: 2, height: 2 }, white), 2);
});

Deno.test("a red dot needs more red pixels than the limit", () => {
  const img = picture(60, 60, [{ at: { x: 10, y: 10, width: 7, height: 7 }, rgb: [230, 30, 30] }]);
  const box = { x: 0, y: 0, width: 60, height: 60 };
  assertEquals(redIn(img, box), 49);
  assertEquals(hasRedDot(img, box), true);
  assertEquals(hasRedDot(img, box, 60), false);
});

Deno.test("green buttons are found with their centre in points", () => {
  const img = picture(1206, 600, [{ at: { x: 300, y: 300, width: 480, height: 150 }, rgb: [40, 200, 40] }]);
  const [button, ...rest] = greenButtons(img, 0);
  assertEquals(rest.length, 0);
  assertEquals(button, { width: 480, height: 150, x: 180, y: 125 });
});
