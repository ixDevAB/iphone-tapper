import { assertEquals } from "@std/assert";
import { acted, alike, fresh, sawScreen, words } from "./stuck.ts";

const drag = { kind: "dragged", at: [200, 640, 200, 400] };

const bottom = [
  [
    "Allfance Members",
    "Nami_",
    "2 527.8M",
    "Deckhand DOHAN",
    "@ 527.5M",
    "Lil Mama",
    "185.3M",
    "R3",
    "Warlords",
    "Strawhats",
    "Grandfleet",
    "TheFifthColumn",
    "Sasuke",
    "IwanToEatU Ace",
    "Yonkos",
  ],
  [
    "Alliance Members",
    "15M",
    "Nami_",
    "₩ 527.8M",
    "Deckhand DOHAN",
    "() 527.5M",
    "LiI Mama",
    "(* 185.3M",
    "R3",
    "Warlords",
    "Strawhats",
    "Grandfleet",
    "TheFifthColumn",
    "Sasuke",
    "IwanToEatU Ace",
    "Yonkos",
  ],
];

const repeat = (screens: string[][], times: number, action = drag) =>
  Array.from({ length: times }, (_, i) => screens[i % screens.length])
    .reduce((watch, texts) => acted(sawScreen(watch, texts), action), fresh);

Deno.test("the same drag on a list that no longer moves is counted however the icons were read", () => {
  assertEquals(repeat(bottom, 41).repeats, 41);
});

Deno.test("a list that scrolls, another action or a drag without a look starts the count again or leaves it", () => {
  const scrolling = [["Alliance Members", "Zed", "Fletcher", "Chopper"], [
    "Alliance Members",
    "Kaiber",
    "Truff",
    "Sasuke",
  ]];
  assertEquals(repeat(scrolling, 30).repeats, 1);
  assertEquals(acted(sawScreen(repeat(bottom, 10), bottom[0]), { kind: "tapped", at: [30, 77] }).repeats, 1);
  assertEquals(acted(repeat(bottom, 10), drag).repeats, 10);
  assertEquals(
    acted(sawScreen(repeat(bottom, 10), bottom[0]), { kind: "dragged", at: [203, 638, 199, 402] }).repeats,
    11,
  );
});

Deno.test("screens are compared by their words, not their numbers, icons or places", () => {
  assertEquals([...words(["2 527.8M @126,299", "Nami_ @118,283", "R3 @43,594"])], ["naml"]);
  assertEquals(alike(words(bottom[0]), words(bottom[1])), true);
  assertEquals(alike(words(["Alliance Power", "Ranking"]), words(["Alliance Members", "Yonkos"])), false);
});
