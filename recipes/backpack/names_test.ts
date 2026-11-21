import { assertEquals } from "@std/assert";
import { line, picture } from "../../src/testing.ts";
import { alike, blank, countAt, fileName, gearTitle, latin, panelIn, signatureOf, titleIn, withGaps } from "./names.ts";

Deno.test("rows the reader missed are filled in from the row spacing", () => {
  assertEquals(withGaps([197, 290, 476, 569]), [197, 290, 383, 476, 569]);
  assertEquals(withGaps([200, 293]), [200, 293]);
  assertEquals(withGaps([]), []);
});

Deno.test("look-alike cyrillic letters become latin", () => {
  assertEquals(latin("5,000 Hero ХP"), "5,000 Hero XP");
});

Deno.test("names become file names", () => {
  assertEquals(fileName(" 10K Bread  (Secured) "), "10k bread (secured)");
  assertEquals(fileName("Lv.3: Chest/Box"), "lv.3 chest box");
  assertEquals(fileName("TK Wood"), "1k wood");
  assertEquals(fileName("IM Construction Speedup"), "1m construction speedup");
  assertEquals(fileName("Treasure Chart"), "treasure chart");
});

Deno.test("the title is the first text line of the panel", () => {
  const lines = [
    line("830", 85, 240),
    line("1K Resource", 160, 369),
    line("Supply Chest", 250, 370),
    line("Grants 1K Bread, Wood, Stone, or Iron resources.", 200, 390),
    line("Use", 280, 515),
  ];
  assertEquals(titleIn(lines, { top: 347 }), "1K Resource Supply Chest");
  assertEquals(titleIn(lines, { top: 600 }), "");
});

Deno.test("the count is the number under the right of a tile", () => {
  const lines = [line("4,925", 74, 223), line("606", 174, 222), line("10 K", 154, 166)];
  assertEquals(countAt(lines, { x: 60, y: 197 }), "4,925");
  assertEquals(countAt(lines, { x: 155, y: 197 }), "606");
  assertEquals(countAt(lines, { x: 249, y: 197 }), "");
  assertEquals(countAt([line("Lv.14", 76, 223)], { x: 60, y: 197 }), "Lv.14");
});

Deno.test("an open item panel is found by its cream band", () => {
  const closed = picture(1206, 2622, [{ at: { x: 0, y: 0, width: 1206, height: 2622 }, rgb: [215, 190, 165] }]);
  const open = picture(1206, 2622, [
    { at: { x: 0, y: 0, width: 1206, height: 2622 }, rgb: [215, 190, 165] },
    { at: { x: 60, y: 1041, width: 1086, height: 620 }, rgb: [253, 243, 236] },
  ]);
  assertEquals(panelIn(closed), undefined);
  assertEquals(panelIn(open), { top: 348 });
});

Deno.test("pictures of the same item are alike even when shifted a little", () => {
  const item = (dx: number, rgb: number[]) =>
    signatureOf(picture(180, 140, [
      { at: { x: 0, y: 0, width: 180, height: 140 }, rgb: [40, 110, 200] },
      { at: { x: 50 + dx, y: 40, width: 80, height: 60 }, rgb },
    ]));
  assertEquals(alike(item(0, [230, 160, 60]), item(4, [230, 160, 60])), true);
  assertEquals(alike(item(0, [230, 160, 60]), item(0, [90, 60, 40])), false);
});

Deno.test("an empty slot has no picture in it", () => {
  const empty = picture(180, 140, [{ at: { x: 0, y: 0, width: 180, height: 140 }, rgb: [215, 190, 165] }]);
  const item = picture(180, 140, [
    { at: { x: 0, y: 0, width: 180, height: 140 }, rgb: [40, 110, 200] },
    { at: { x: 50, y: 40, width: 80, height: 60 }, rgb: [230, 160, 60] },
  ]);
  assertEquals(blank(signatureOf(empty)), true);
  assertEquals(blank(signatureOf(item)), false);
});

Deno.test("a gear name is the line under the gear details title", () => {
  const lines = [
    line("Gear Details", 202, 267),
    line("+79", 92, 300),
    line("Champion's Gloves", 178, 303),
    line("Legendary", 153, 324),
    line("Unequip", 320, 309),
  ];
  assertEquals(gearTitle(lines, 267), "Champion's Gloves");
});
