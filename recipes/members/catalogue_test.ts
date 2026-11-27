import { assertEquals } from "@std/assert";
import { findPlayer, latestName, sawOnList, sawProfile } from "./catalogue.ts";

Deno.test("a player keeps every name they were seen with under their id", () => {
  const first = sawProfile(
    {},
    "1",
    { name: "SON WODONG", alliance: "KON", kingdom: "323", power: "540M" },
    "2026-11-23",
  );
  assertEquals(first.renamedFrom, undefined);
  const again = sawProfile(first.catalogue, "1", { name: "SON WODONG" }, "2026-11-24");
  assertEquals(again.renamedFrom, undefined);
  assertEquals(again.catalogue["1"].names, [{ name: "SON WODONG", first: "2026-11-23", last: "2026-11-24" }]);
  const renamed = sawProfile(
    again.catalogue,
    "1",
    { name: "Monkey King", alliance: "XLE", power: "542.6M" },
    "2026-11-25",
  );
  assertEquals(renamed.renamedFrom, "SON WODONG");
  assertEquals(renamed.catalogue["1"].names.map((n) => n.name), ["SON WODONG", "Monkey King"]);
  assertEquals(latestName(renamed.catalogue["1"]), "Monkey King");
  assertEquals(renamed.catalogue["1"].alliance, "XLE");
  assertEquals(renamed.catalogue["1"].kingdom, "323");
  const back = sawProfile(renamed.catalogue, "1", { name: "SON WODONG" }, "2026-11-26");
  assertEquals(back.renamedFrom, undefined);
  assertEquals(latestName(back.catalogue["1"]), "SON WODONG");
});

Deno.test("a player is found by any name or list reading, within an alliance when one is given", () => {
  const { catalogue } = sawProfile({}, "7", { name: "Kïnû Îç°řü§", alliance: "XLE" }, "2026-11-23");
  assertEquals(findPlayer(catalogue, "King Îç'rüs"), undefined);
  const read = sawOnList(catalogue, "7", "King Îç'rüs", "258.4M");
  assertEquals(read["7"].readAs, ["King Îç'rüs"]);
  assertEquals(read["7"].power, "258.4M");
  assertEquals(sawOnList(read, "7", "King Îç'rüs")["7"].readAs, ["King Îç'rüs"]);
  assertEquals(findPlayer(read, "King Îç'rüs"), "7");
  assertEquals(findPlayer(read, "King Îç'rüs", "XLE"), "7");
  assertEquals(findPlayer(read, "King Îç'rüs", "KON"), undefined);
  assertEquals(sawOnList(read, "8", "Nobody"), read);
});
