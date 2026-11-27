import { assertEquals } from "@std/assert";
import {
  allianceFrom,
  allianceRows,
  cardsOn,
  fileName,
  fileText,
  groupToFix,
  headersOn,
  idFrom,
  isOpen,
  kingdomFrom,
  known,
  membersFrom,
  nameFrom,
  powerFrom,
  powerText,
  sameName,
  signature,
  tagOf,
  tidyName,
} from "./pure.ts";

const at = (text: string, x: number, y: number) => ({ text, x, y });

Deno.test("the alliance tag is taken off a name however the closing bracket was read", () => {
  assertEquals(
    ["[KON|Pieti1988", "[KON|Redbarron", "[KONDEXTER", "[KON]King", "Konrad", "KONG", "[ KON ] Sig"].map(tidyName),
    ["Pieti1988", "Redbarron", "DEXTER", "King", "Konrad", "KONG", "Sig"],
  );
});

Deno.test("the tag of an alliance is read from its row", () => {
  assertEquals(
    ["[XLE]StrawHatPirates", "[VALValhalla", "[GRD|GHOSTFIRE", "[WOO]WarriorsOfOdin 35,269", "Power"].map(tagOf),
    ["XLE", "VAL", "GRD", "WOO", undefined],
  );
  assertEquals(
    allianceRows([
      at("Alliance Power", 112, 76),
      at("[RYL]RoyalOrder", 190, 556),
      at("[KON]LateKonoha", 193, 330),
      at("[KON]LateKonoha", 203, 807),
    ]),
    [{ tag: "RYL", x: 190, y: 556 }, { tag: "KON", x: 193, y: 330 }],
  );
});

Deno.test("member cards are found by a name above a power line, and the leader card is not one", () => {
  const lines = [
    at("King Rupert", 197, 234),
    at("509.5M", 197, 260),
    at("Phelian", 108, 375),
    at("623.9M", 126, 394),
    at("Pele13", 295, 375),
    at("707.2M", 309, 393),
  ];
  assertEquals(cardsOn(lines).map((c) => c.name), ["Phelian", "Pele13"]);
  assertEquals(cardsOn(lines).map((c) => c.key), ["L6239", "R7072"]);
});

Deno.test("a group is open when its members sit under it, and neighbours do not share them", () => {
  const lines = [
    at("R4", 44, 333),
    at("R3", 43, 372),
    at("R2", 44, 411),
    at("Xilverblue", 116, 454),
    at("417.9M", 122, 472),
    at("R1", 44, 709),
    at("kaladin", 108, 751),
    at("508.8M", 120, 769),
  ];
  const headers = headersOn(lines);
  const cards = cardsOn(lines);
  assertEquals(headers.map((h) => isOpen(headers, cards, h)), [false, false, true, true]);
  assertEquals(groupToFix(lines, "R3")?.text, "R2");
  assertEquals(groupToFix(lines, "R2")?.text, "R1");
  assertEquals(groupToFix(lines.filter((l) => !["R1", "kaladin", "508.8M"].includes(l.text)), "R2"), undefined);
});

Deno.test("known players are matched by their exact name, never by a similar one", () => {
  const members = [{ username: "Hesani", playerId: "1", rank: "R3" }, {
    username: "°°FahZhao°°",
    playerId: "2",
    rank: "R4",
  }];
  assertEquals(known(members, "hesani")?.playerId, "1");
  assertEquals(known(members, "FahZhao")?.playerId, "2");
  assertEquals(known(members, "Hermione"), undefined);
  assertEquals(known(members, "???"), undefined);
});

Deno.test("the file is grouped by rank with the totals on top", () => {
  const members = [
    { username: "King Rupert", playerId: "5", rank: "R5" },
    { username: "[KON|Redbarron", playerId: "3", rank: "R3" },
    { username: "ARMINIUS", playerId: "4", rank: "R4" },
    { username: "Newcomer", playerId: "9", rank: "" },
  ];
  const parsed = JSON.parse(fileText({ scannedAt: "2026-11-23", alliance: "KON", kingdom: "323" }, members));
  assertEquals(Object.keys(parsed), [
    "scannedAt",
    "alliance",
    "kingdom",
    "count",
    "r5",
    "r4",
    "r3",
    "r2",
    "r1",
    "unranked",
    "skipped",
  ]);
  assertEquals(parsed.count, 4);
  assertEquals(parsed.r3, [{ username: "Redbarron", playerId: "3" }]);
  assertEquals(membersFrom(parsed).map((m) => `${m.rank}:${m.username}`), [
    "R5:King Rupert",
    "R4:ARMINIUS",
    "R3:Redbarron",
    ":Newcomer",
  ]);
  assertEquals(fileName("XLE", "323", "2026-11-24"), "alliance_members_XLE_323_2026-11-24.json");
});

Deno.test("a profile gives its id, kingdom, alliance and name", () => {
  const lines = [
    at("Governor Profile", 117, 75),
    at("[KON]King Rupert", 216, 642),
    at("D: 79557575", 195, 671),
    at("Alliance: KON", 193, 738),
    at("Kingdom: #323", 201, 760),
  ];
  assertEquals(idFrom(lines), "79557575");
  assertEquals(kingdomFrom(lines), "323");
  assertEquals(allianceFrom(lines), "KON");
  assertEquals(nameFrom(lines), "[KON]King Rupert");
});

Deno.test("a list that did not move reads the same however the icons and letters were read", () => {
  const first = [
    at("Nami_", 118, 283),
    at("2 527.8M", 126, 299),
    at("Lil Mama", 295, 433),
    at("185.3M", 293, 449),
    at("R3", 43, 594),
  ];
  const second = [
    at("Nami", 117, 282),
    at("₩ 527.8M", 126, 298),
    at("15M", 138, 225),
    at("LiI Mama", 295, 433),
    at("(* 185.3M", 294, 448),
    at("R3", 43, 594),
  ];
  assertEquals(signature(first), signature(second));
  assertEquals(signature(first), "R3|L5278|R1853");
  assertEquals(known([{ username: "LiI Mama", playerId: "1", rank: "R4" }], "Lil Mama")?.playerId, "1");
});

Deno.test("a name read a little differently on the list and on the profile is the same player", () => {
  const saved = "* DEATH 'oz -*";
  assertEquals(["* DEATH oz +*", "* DEATH oZ -*", "* DEATH olz -*-"].map((n) => sameName(saved, n)), [
    true,
    true,
    true,
  ]);
  assertEquals(
    [sameName("Eve", "Eva"), sameName("Bryce", "Bruce"), sameName("Declan", "Raven"), sameName("", "")],
    [false, false, false, false],
  );
});

Deno.test("a member with power in billions is a card too", () => {
  const cards = cardsOn([
    at("Smockes", 124, 445),
    at("₩ 1,4B", 116, 461),
    at("Sasquatch", 297, 446),
    at("₩ 634.5M", 294, 461),
  ]);
  assertEquals(cards.map((c) => `${c.name} ${c.key}`), ["Smockes L14B", "Sasquatch R6345"]);
});

Deno.test("an alliance tag keeps its letter case, so xLe is not XLE", () => {
  assertEquals(["[xLe|MiniXLE", "[XLE]StrawHatPirates"].map(tagOf), ["xLe", "XLE"]);
  assertEquals(allianceFrom([at("Alliance: xLe", 191, 738)]), "xLe");
  assertEquals(fileName("xLe", "323", "2026-11-24"), "alliance_members_x-Le-_323_2026-11-24.json");
});

Deno.test("power is read from a card and from a profile, without the icon in front of it", () => {
  assertEquals(["₩ 527.8M", "1,4B", "623.9M Q", "(* 86.7M", "Kills: 33.4M Q", "Mace"].map(powerText), [
    "527.8M",
    "1.4B",
    "623.9M",
    "86.7M",
    "33.4M",
    undefined,
  ]);
  assertEquals(cardsOn([at("Smockes", 124, 445), at("₩ 1,4B", 116, 461)])[0].power, "1.4B");
  assertEquals(
    powerFrom([at("ID: 31274007", 192, 672), at("517.4M", 193, 694), at("Kills: 5.8M Q", 195, 715)]),
    "517.4M",
  );
});
