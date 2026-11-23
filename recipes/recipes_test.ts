import { assertEquals } from "@std/assert";
import { latin } from "../src/ocr.ts";
import { amountOf } from "../src/rewards.ts";
import { center, exact, has, like } from "../src/screen.ts";
import { line, picture } from "../src/testing.ts";
import { secondsIn } from "../src/time.ts";
import { colourAt, defaultItems, mayUse, refusal, tierOf, usableTitle } from "./backpack/tiles.ts";
import { contentDots, isFreeLabel, moreTo, redShapes, tabDots, trackSteps } from "./freebies/dots.ts";
import { withSetting } from "./heal/calibrate.ts";
import { alliesFrom, amountIn } from "./heal/window.ts";
import { findMarkers, findPins } from "./intel/markers.ts";
import { gemConfirm, maySpend, priceIn, priceNear } from "./shop/confirm.ts";

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

Deno.test("button texts match even when the reader mixes up l, I and 1", () => {
  assertEquals(like("hunt all").test("Hunt AIl"), true);
  assertEquals(like("claim all", true).test("C1aim All"), true);
  assertEquals(like("claim all", true).test("Read & Claim All"), false);
  assertEquals(like("read & claim all").test("Read&Claim AII"), true);
  assertEquals(like("hunt all").test("Hunt"), false);
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
    { kind: "check", size: 64, x: 304, y: 404 },
    { kind: "gold", size: 100, x: 209, y: 509 },
  ]);
});

Deno.test("intel pins keep apart when close, join their pieces and know their check", () => {
  const blue = [20, 90, 153];
  const purple = [48, 23, 115];
  const img = picture(1206, 2622, [
    { at: { x: 150, y: 1100, width: 60, height: 60 }, rgb: purple },
    { at: { x: 222, y: 1180, width: 60, height: 60 }, rgb: blue },
    { at: { x: 291, y: 1164, width: 24, height: 24 }, rgb: [80, 190, 57] },
    { at: { x: 800, y: 1280, width: 60, height: 24 }, rgb: blue },
    { at: { x: 800, y: 1340, width: 60, height: 24 }, rgb: blue },
    { at: { x: 600, y: 800, width: 150, height: 150 }, rgb: [255, 170, 20] },
  ]);
  assertEquals(findPins(img), [
    { x: 224, y: 292, colour: "flame", done: false },
    { x: 59, y: 377, colour: "purple", done: false },
    { x: 83, y: 403, colour: "blue", done: true },
    { x: 277, y: 441, colour: "blue", done: false },
  ]);
});

Deno.test("the question to spend gems is only answered when every price agrees", () => {
  const asked = [
    line("Purchase", 201, 346),
    line("Confirm to spend 15 gems to purchase this", 200, 414),
    line("item?", 199, 432),
    line("Don't show this again today", 214, 494),
    line("15", 211, 535),
  ];
  const confirm = gemConfirm(asked);
  assertEquals(confirm?.gems, 15);
  assertEquals(confirm?.button && center(confirm.button), { x: 211, y: 535 });
  assertEquals(confirm && maySpend(confirm, [15, 15]), true);
  assertEquals(confirm && maySpend(confirm, [15, 140]), false);
  assertEquals(confirm && maySpend(confirm, [15, undefined]), false);
  assertEquals(confirm && maySpend(confirm, [undefined, 15]), false);

  const noButton = gemConfirm(asked.slice(0, 4));
  assertEquals(noButton && maySpend(noButton, [15, 15]), false);
  const otherAmount = gemConfirm([
    ...asked.slice(0, 1),
    line("Confirm to spend 1,500 gems to purchase this", 200, 414),
    asked[4],
  ]);
  assertEquals(otherAmount?.gems, 1500);
  assertEquals(otherAmount && maySpend(otherAmount, [15, 15]), false);
  assertEquals(gemConfirm([line("Buy", 201, 331), line("15", 210, 555)]), undefined);
});

Deno.test("the price on the buy button is read from the button only", () => {
  const buy = [line("Buy", 201, 331), line("10", 66, 373), line("10 VIP XP", 139, 375), line("15", 210, 555)];
  assertEquals(priceNear(buy, { x: 200, y: 553 }), 15);
  assertEquals(priceNear(buy.slice(0, 3), { x: 200, y: 553 }), undefined);
  assertEquals(priceIn(["", "19"]), 19);
  assertEquals(priceIn(["1,900"]), 1900);
  assertEquals(priceIn(["19 gems", "x"]), undefined);
});

Deno.test("store red dots are told apart from the exclamation bubble", () => {
  const red = [230, 30, 30];
  const img = picture(1206, 2622, [
    { at: { x: 362, y: 332, width: 26, height: 26 }, rgb: red },
    { at: { x: 1108, y: 343, width: 58, height: 58 }, rgb: red },
    { at: { x: 1117, y: 352, width: 40, height: 40 }, rgb: [255, 255, 255] },
    { at: { x: 1091, y: 572, width: 26, height: 26 }, rgb: red },
    { at: { x: 300, y: 1200, width: 120, height: 40 }, rgb: red },
  ]);
  const shapes = redShapes(img);
  assertEquals(tabDots(shapes), [125]);
  assertEquals(contentDots(shapes), [{ x: 368, y: 195 }]);
  assertEquals(moreTo(shapes, "right"), true);
  assertEquals(moreTo(shapes, "left"), false);
});

Deno.test("a reward track is found from the step numbers the reader caught, the missed steps included", () => {
  const at = (text: string, x: number, y = 333) => ({ text, x, y });
  const read = [at("200", 96, 302), at("·60", 160, 302), at("5", 305, 302), at("1", 88), at("9", 292), at("12", 365)];
  assertEquals(trackSteps(read).map((s) => s.x), [88, 157, 227, 296, 365]);
  assertEquals(trackSteps(read)[0], { step: 1, x: 88, y: 333 });
  assertEquals(trackSteps([at("1", 88), at("3", 150), at("6", 219), at("9", 291), at("12", 363)]).length, 5);
  assertEquals(trackSteps([at("9", 292), at("12", 365)]), []);
  assertEquals(trackSteps([at("10", 67, 579), at("200", 107, 575), at("25", 160, 579)]), []);
  assertEquals(trackSteps([at("100", 54, 699), at("100", 148, 699), at("100", 240, 699)]), []);
});

Deno.test("free labels are recognised with a misread accent, longer texts are not", () => {
  assertEquals(["Frée", "Free", "Claimable", " claim "].map(isFreeLabel), [true, true, true, true]);
  assertEquals(["Claimable Daily:", "Claimed", "Free Refresh", "Buy All"].map(isFreeLabel), [
    false,
    false,
    false,
    false,
  ]);
});

Deno.test("a colour needs two of the three samples to agree", () => {
  const between = picture(1206, 1700, [
    { at: { x: 0, y: 0, width: 1206, height: 1700 }, rgb: [215, 190, 165] },
    { at: { x: 918, y: 1110, width: 223, height: 223 }, rgb: [60, 170, 80] },
    { at: { x: 918, y: 1389, width: 223, height: 223 }, rgb: [130, 110, 235] },
  ]);
  assertEquals(colourAt(between, 343, 407), "green");
  assertEquals(colourAt(between, 343, 500), "purple");
  assertEquals(colourAt(between, 343, 468), "none");
});

Deno.test("the size in the name gives the colour of a resource item", () => {
  assertEquals(tierOf("100 Iron"), "grey");
  assertEquals(tierOf("1K Stone (Secured)"), "green");
  assertEquals(tierOf("10K Bread"), "blue");
  assertEquals(tierOf("100K Wood (Secured)"), "blue");
  assertEquals(tierOf("1M Wood"), "purple");
  assertEquals(tierOf("10,000 Bread"), "blue");
  assertEquals(tierOf("5K Wood"), undefined);
  assertEquals(tierOf("TK Wood"), undefined);
});

Deno.test("a resource is only used when its name and its colour both say it is allowed", () => {
  const small = ["grey", "green"];
  assertEquals(mayUse("1K Stone", "green", small), true);
  assertEquals(mayUse("100 Iron", "grey", small), true);
  assertEquals(mayUse("1M Wood", "green", small), false);
  assertEquals(mayUse("1M Wood (Secured)", "green", small), false);
  assertEquals(mayUse("100K Wood (Secured)", "grey", small), false);
  assertEquals(mayUse("1M Wood", "purple", small), false);
  assertEquals(mayUse("1K Stone", "blue", small), false);
  assertEquals(mayUse("1M Wood", "purple", ["purple"]), true);
  assertEquals(mayUse("5K Wood", "green", small), false);
  assertEquals(mayUse("1 Gems", "none", small), true);
  assertEquals(mayUse("1,000 Hero XP", "blue", small), true);
  assertEquals(mayUse("Lv.1 Custom Resource Chest", "green", small), false);
});

Deno.test("of everything in the backpack only the listed things may be used", () => {
  const dir = new URL("../assets/backpack/", import.meta.url);
  const names = [...Deno.readDirSync(dir)].map((e) => e.name.replace(/\.png$/, ""));
  const seen = ["grey", "green", "blue", "purple", "orange", "none"];
  const usable = names.filter((name) => seen.some((colour) => mayUse(name, colour, ["grey", "green"], defaultItems)));
  const expected = /^((100|1k) (bread|wood|stone|iron)( \(secured\))?|[\d,]+ gems|[\d,.]+k? hero xp)$/;
  assertEquals(names.length > 200, true);
  assertEquals(usable.filter((name) => !expected.test(name) && !defaultItems.includes(name)), []);
  assertEquals(usable.includes("1k wood"), true);
  assertEquals(usable.includes("trial chest"), true);
  assertEquals(usable.includes("1m wood"), false);
});
Deno.test("a misread look-alike letter does not hide the hero xp item", () => {
  const misread = "5,000 Hero \u0425P";
  assertEquals(usableTitle(misread), false);
  assertEquals(latin(misread), "5,000 Hero XP");
  assertEquals(refusal(latin(misread), "blue", "blue", { colours: ["grey", "green"], items: [] }), undefined);
});

Deno.test("a refused item comes with the reason", () => {
  const small = { colours: ["grey", "green"], items: defaultItems };
  assertEquals(refusal("1K Stone", "green", "green", small), undefined);
  assertEquals(refusal("1M Wood", "green", "purple", small), "it is purple and only grey, green may be used");
  assertEquals(
    refusal("1K Stone", "blue", "green", small),
    "its name says green but the tile looked blue before it was opened",
  );
  assertEquals(refusal("1K Stone", "green", "none", small), "its name says green but the open tile looks none");
  assertEquals(refusal(undefined, "green", "green", small), "its name is not known");
  assertEquals(refusal("Governor Stamina", "blue", "blue", small), "it is not on the list of things to use");
  assertEquals(refusal("5K Wood", "green", "green", small), "the size in its name is not one it knows");
});

Deno.test("the plain chests and vip xp items are used, other chests are not", () => {
  const small = { colours: ["grey", "green"], items: defaultItems };
  for (
    const name of ["Trial Chest", "Badland Treasure", "Reserve Chest", "Countess Chest", "10 VIP XP", "100 VIP XP"]
  ) {
    assertEquals(refusal(name, "orange", "none", small), undefined);
  }
  assertEquals(refusal("governor gear materials chest", "purple", "purple", small), undefined);
  assertEquals(refusal("Lucky Hero Gear Chest", "orange", "orange", small), "it is not on the list of things to use");
  assertEquals(
    refusal("Lv.1 Custom Resource Chest", "green", "green", small),
    "it is not on the list of things to use",
  );
  assertEquals(
    refusal("Trial Chest", "orange", "orange", { colours: ["grey"], items: [] }),
    "it is not on the list of things to use",
  );
});
