import { decide } from "../../src/decisions.ts";
import { look, requireIphone } from "../../src/flow.ts";
import type { Phone } from "../../src/phone.ts";
import { on, type Recipe } from "../../src/recipe.ts";
import { center, saveShot } from "../../src/screen.ts";
import { clock, sleep } from "../../src/time.ts";
import { goHome } from "../../src/world.ts";
import {
  allianceFrom,
  allianceRows,
  type Card,
  cardsOn,
  fileName,
  fileTag,
  fileText,
  groupToFix,
  idFrom,
  kingdomFrom,
  known,
  type Member,
  membersFrom,
  nameFrom,
  type Names,
  powerFrom,
  powerText,
  sameName,
  signature,
  type Skipped,
  type Spot,
  tidyName,
  withName,
  withoutSkipped,
  withSkipped,
} from "./pure.ts";

const root = new URL("../../", import.meta.url);
const profileButton = { x: 26, y: 65 };
const leaderboardButton = { x: 250, y: 829 };
const powerTile = { x: 114, y: 222 };
const backArrowSpot = { x: 30, y: 77 };
const groups = ["R4", "R3", "R2", "R1"];
const listTitle = /^All\w{2,5}ce Members$/;

const see = async (phone: Phone) => {
  const seen = await look(phone);
  return { ...seen, spots: seen.lines.map((l): Spot => ({ text: l.text.trim(), ...center(l) })) };
};

type Seen = Awaited<ReturnType<typeof see>>;

const titled = (title: RegExp) => (spots: Spot[]) => spots.some((l) => l.y < 95 && title.test(l.text));

const anywhere = (title: RegExp) => (spots: Spot[]) => spots.some((l) => title.test(l.text));

const onList = (spots: Spot[]) => anywhere(listTitle)(spots) || cardsOn(spots).length >= 2;

const keep = async (seen: Seen, why: string) => {
  const name = `members-${new Date().toLocaleTimeString("sv-SE").replaceAll(":", "")}.png`;
  await saveShot(name, seen.png);
  await decide("kept a picture", { why, picture: `build/${name}` });
};

const waitFor = async (phone: Phone, test: (spots: Spot[]) => boolean, what: string, tries = 4): Promise<Seen> => {
  const seen = await see(phone);
  if (test(seen.spots)) return seen;
  if (tries <= 0) {
    await keep(seen, `did not get to ${what}`);
    throw new Error(`did not get to ${what}`);
  }
  await sleep(1500);
  return waitFor(phone, test, what, tries - 1);
};

const press = async (phone: Phone, point: { x: number; y: number }, wait = 1800) => {
  await phone.tap(point);
  await sleep(wait);
};

const drags = async (phone: Phone, times: number, from: number, to: number, seconds: number) => {
  if (times <= 0) return;
  await phone.drag({ x: 200, y: from }, { x: 200, y: to }, seconds);
  await sleep(450);
  return drags(phone, times - 1, from, to, seconds);
};

const step = async (phone: Phone, by: number, times = 1): Promise<void> => {
  if (times <= 0) return;
  await phone.slide({ x: 200, y: by > 0 ? 620 : 420 }, { x: 200, y: (by > 0 ? 620 : 420) - by });
  await sleep(700);
  return step(phone, by, times - 1);
};

const toTop = (phone: Phone) => drags(phone, 4, 300, 700, 0.5);

const toBottom = (phone: Phone) => drags(phone, 16, 700, 300, 0.5);

const toLeaderboard = async (phone: Phone) => {
  if (!(await goHome(phone, 8))) throw new Error("could not get to the world map");
  await press(phone, profileButton, 2200);
  await waitFor(phone, titled(/^Governor Profile$/), "your profile");
  await press(phone, leaderboardButton, 2200);
  await waitFor(phone, titled(/^Leaderboard$/), "the leaderboard");
  await press(phone, powerTile, 2200);
  return waitFor(phone, titled(/^Alliance Power$/), "the alliance power list");
};

const tagsOnList = async (phone: Phone, seen: string[], tries: number): Promise<string[]> => {
  const now = allianceRows((await see(phone)).spots).map((r) => r.tag);
  const all = [...new Set([...seen, ...now])];
  if (tries <= 0 || (all.length === seen.length && seen.length > 0)) return all;
  await drags(phone, 1, 700, 400, 0.6);
  return tagsOnList(phone, all, tries - 1);
};

const rowOf = async (phone: Phone, tag: string, tries: number): Promise<{ x: number; y: number }> => {
  const row = allianceRows((await see(phone)).spots).find((r) => r.tag === tag);
  if (row) return { x: 200, y: row.y };
  if (tries <= 0) throw new Error(`${tag} is not in the alliance power list`);
  await drags(phone, 1, 700, 400, 0.6);
  return rowOf(phone, tag, tries - 1);
};

const fromRanking = async (phone: Phone, tag: string) => {
  await drags(phone, 3, 300, 700, 0.5);
  await sleep(600);
  await press(phone, await rowOf(phone, tag, 12), 2200);
  const info = await waitFor(phone, anywhere(/^Alliance Info$/), `the info of ${tag}`);
  const total = Number(info.spots.map((l) => l.text.match(/^(\d{1,3})\/100$/)?.[1]).find((n) => n) ?? 0);
  const members = info.spots.find((l) => l.text === "Members" && l.y > 380 && l.y < 480);
  if (!members) throw new Error(`no Members button in the info of ${tag}`);
  await press(phone, { x: members.x, y: members.y }, 2200);
  await waitFor(phone, anywhere(listTitle), `the member list of ${tag}`);
  return total;
};

const openAlliance = async (phone: Phone, tag: string) => {
  await toLeaderboard(phone);
  return fromRanking(phone, tag);
};

const reopen = async (phone: Phone, tag: string) => {
  const onRanking = titled(/^Alliance Power$/)((await see(phone)).spots);
  return onRanking ? fromRanking(phone, tag).catch(() => openAlliance(phone, tag)) : openAlliance(phone, tag);
};

const ownTag = async (phone: Phone) => {
  if (!(await goHome(phone, 8))) throw new Error("could not get to the world map");
  await press(phone, profileButton, 2200);
  const seen = await waitFor(phone, titled(/^Governor Profile$/), "your profile");
  const tag = allianceFrom(seen.spots);
  if (!tag) throw new Error("could not read your alliance from your profile");
  return tag;
};

const namesFile = new URL("alliance_members_names.json", root);

const readNames = (): Promise<Names> => Deno.readTextFile(namesFile).then(JSON.parse, () => ({}));

type Store = {
  refresh: boolean;
  powered: Set<string>;
  tag: string;
  names: Names;
  members: Member[];
  skipped: Skipped[];
  kingdoms: string[];
  path?: URL;
  scannedAt: string;
  expected: number;
};

const existing = async (tag: string) => {
  const names = await Array.fromAsync(Deno.readDir(root)).catch(() => []);
  const found = names.map((e) => e.name.match(new RegExp(`^alliance_members_${fileTag(tag)}_(\\d+)\\.json$`))).find((
    m,
  ) => m);
  if (!found) return undefined;
  const stored = await Deno.readTextFile(new URL(found[0], root)).then(JSON.parse, () => ({}));
  return { kingdom: found[1], members: membersFrom(stored) };
};

const kingdomOf = (store: Store) =>
  Object.entries(Object.groupBy(store.kingdoms, (k) => k)).toSorted((a, b) =>
    (b[1]?.length ?? 0) - (a[1]?.length ?? 0)
  )[0]
    ?.[0] ?? "0";

const save = async (store: Store) => {
  const kingdom = kingdomOf(store);
  const path = new URL(fileName(store.tag, kingdom), root);
  await Deno.writeTextFile(
    path,
    fileText({ scannedAt: store.scannedAt, alliance: store.tag, kingdom }, store.members, store.skipped),
  );
  store.path = path;
};

const skip = async (store: Store, username: string, rank: string, why: string) => {
  store.skipped = withSkipped(store.skipped, { username, rank, why });
  await save(store);
  await decide("skipped a member", { alliance: store.tag, username, rank, why });
};

const readProfile = async (
  phone: Phone,
  tries: number,
): Promise<{ id?: string; kingdom?: string; alliance?: string; name: string; power?: string }> => {
  const seen = await waitFor(phone, titled(/^Governor Profile$/), "a profile", 3);
  const id = idFrom(seen.spots);
  if (!id && tries > 0) {
    await sleep(1200);
    return readProfile(phone, tries - 1);
  }
  return {
    id,
    kingdom: kingdomFrom(seen.spots),
    alliance: allianceFrom(seen.spots),
    name: nameFrom(seen.spots),
    power: powerFrom(seen.spots),
  };
};

const visit = async (
  phone: Phone,
  store: Store,
  card: { name: string; x: number; y: number },
  rank: string,
  log: (t: string) => void,
) => {
  const opened = async (tries: number): Promise<Seen> => {
    await press(phone, { x: card.x, y: card.y }, 1500);
    const seen = await see(phone);
    const there = seen.spots.some((l) => l.text === "View") || titled(/^Governor Profile$/)(seen.spots);
    return there || tries <= 0 ? seen : opened(tries - 1);
  };
  const menu = await opened(1);
  const view = menu.spots.find((l) => l.text === "View");
  if (!view && !titled(/^Governor Profile$/)(menu.spots)) {
    await keep(menu, `no menu opened for ${card.name}`);
    await skip(store, card.name, rank, "no menu opened");
    log(`${card.name}: no menu opened, skipped`);
    return "skipped";
  }
  if (view) await press(phone, { x: view.x, y: view.y }, 2200);
  const profile = await readProfile(phone, 1);
  if (!profile.id || profile.alliance !== store.tag) {
    await skip(store, card.name, rank, profile.id ? `profile says alliance ${profile.alliance}` : "id not read");
    log(`${card.name}: not recorded (id ${profile.id}, alliance ${profile.alliance})`);
  } else {
    const username = tidyName(profile.name);
    const already = store.members.find((m) => m.playerId === profile.id);
    const names = withName(store.names, profile.id, already?.username ?? username, card.name);
    if (names !== store.names) {
      store.names = names;
      await Deno.writeTextFile(namesFile, JSON.stringify(names, null, 2) + "\n");
    }
    if (already) {
      already.rank = already.rank || rank;
      already.power = profile.power ?? already.power;
    } else {store.members.push({
        username,
        playerId: profile.id,
        rank,
        ...(profile.power ? { power: profile.power } : {}),
      });}
    if (profile.power) store.powered.add(profile.id);
    if (profile.kingdom) store.kingdoms.push(profile.kingdom);
    store.skipped = withoutSkipped(withoutSkipped(store.skipped, card.name), username);
    await save(store);
    await decide("read a member", { alliance: store.tag, username, playerId: profile.id, rank });
    log(`${store.members.length}/${store.expected || "?"}: ${username} ${profile.id} #${profile.kingdom}`);
  }
  await press(phone, backArrowSpot, 1800);
  const returned = async (tries: number): Promise<Seen | undefined> => {
    const seen = await see(phone);
    if (anywhere(listTitle)(seen.spots)) return seen;
    if (tries <= 0 || titled(/^Alliance Power$/)(seen.spots)) return undefined;
    await sleep(1500);
    return returned(tries - 1);
  };
  const back = await returned(1);
  if (!back) return "left";
  const title = back.spots.find((l) => listTitle.test(l.text));
  if (title && back.spots.some((l) => l.text === "View")) await press(phone, { x: title.x, y: title.y }, 1000);
  return "stayed";
};

const settle = async (phone: Phone, group: string, tries: number, opened = 0): Promise<void> => {
  const seen = await see(phone);
  if (!onList(seen.spots)) throw new Error("left the member list");
  const wrong = groupToFix(seen.spots, group);
  if (!wrong) return;
  const own = wrong.text === group;
  if (own && opened >= 2) return;
  if (tries <= 0) throw new Error(`could not get ${group} into the right state`);
  await press(phone, { x: 200, y: wrong.y }, 1800);
  return settle(phone, group, tries - 1, own ? opened + 1 : opened);
};

const prepare = async (phone: Phone, group: string) => {
  await toTop(phone);
  await settle(phone, group, 10);
  await toBottom(phone);
  await settle(phone, group, 10);
  await toTop(phone);
  await settle(phone, group, 10);
};

const scanGroup = async (
  phone: Phone,
  store: Store,
  group: string,
  budget: { left: number },
  log: (t: string) => void,
) => {
  await prepare(phone, group);
  log(`${group} is open`);
  const cards = { visited: [] as Card[], skipped: [] as Card[] };
  const seenBefore = (c: Card) => cards.visited.some((v) => v.key === c.key && sameName(v.name, c.name));

  const pass = async (
    quiet: number,
    last: string,
    scrolled: number,
    lifted = false,
    before: string[] = [],
    backs = 0,
  ): Promise<void> => {
    if (quiet >= 3 || budget.left <= 0) return;
    const seen = await waitFor(phone, onList, "the member list", 3);
    const all = cardsOn(seen.spots);
    if (before.length >= 2 && all.length >= 2 && backs < 2 && !all.some((c) => before.includes(c.key))) {
      await decide("scrolled too far, going back a little", { before, now: all.map((c) => c.key) });
      await step(phone, -150);
      return pass(quiet, last, scrolled, lifted, before, backs + 1);
    }
    const keys = all.map((c) => c.key);
    const shown = all.filter((c) => c.y >= 270);
    shown.forEach((c) => {
      const match = known(store.members, c.name, store.names);
      if (match && !match.rank) match.rank = group;
      if (match && c.power) {
        match.power = c.power;
        store.powered.add(match.playerId);
      }
    });
    await save(store);
    const next = store.refresh
      ? undefined
      : shown.find((c: Card) => !seenBefore(c) && !known(store.members, c.name, store.names));
    if (next && next.y > 590 && !lifted) {
      await step(phone, 200);
      return pass(0, "", scrolled + 1, true, keys);
    }
    if (next) {
      cards.visited.push(next);
      budget.left -= 1;
      const went = await visit(phone, store, next, group, log);
      if (went === "skipped") cards.skipped.push(next);
      if (went !== "left") return pass(0, "", scrolled);
      const again = Math.max(0, scrolled - 1);
      await reopen(phone, store.tag);
      await settle(phone, group, 10);
      await step(phone, 200, again);
      return pass(0, "", again);
    }
    const now = signature(seen.spots);
    await step(phone, 200);
    return pass(now === last ? quiet + 1 : 0, now, scrolled + 1, false, keys);
  };

  await pass(0, "", 0);
  if (!cards.skipped.length || budget.left <= 0) return;
  log(`${group}: trying the ${cards.skipped.length} skipped again`);
  cards.visited = cards.visited.filter((v) => !cards.skipped.includes(v));
  await reopen(phone, store.tag);
  await settle(phone, group, 10);
  await pass(0, "", 0);
};

const scanLeader = async (phone: Phone, store: Store, budget: { left: number }, log: (t: string) => void) => {
  await toTop(phone);
  const seen = await see(phone);
  const label = seen.spots.find((l) => l.text === "R5" && l.x < 90 && l.y > 190 && l.y < 320);
  const name = label
    ? seen.spots.find((l) => l.y > label.y + 12 && l.y < label.y + 40 && l.x > 150 && !/\d\s*[KMB]$/.test(l.text))
    : undefined;
  const leader = name && known(store.members, name.text, store.names);
  const power = name && seen.spots.find((l) => l.y > name.y + 15 && l.y < name.y + 40 && powerText(l.text));
  if (leader && power) {
    leader.power = powerText(power.text) ?? leader.power;
    store.powered.add(leader.playerId);
  }
  if (!name || leader || budget.left <= 0 || store.refresh) return;
  budget.left -= 1;
  if ((await visit(phone, store, { name: name.text, x: 200, y: name.y }, "R5", log)) === "left") {
    await reopen(phone, store.tag);
  }
};

const scanOne = async (phone: Phone, tag: string, limit: number, refresh: boolean, log: (t: string) => void) => {
  log(`== ${tag} ==`);
  const expected = await openAlliance(phone, tag);
  const before = await existing(tag);
  const store: Store = {
    tag,
    members: before?.members ?? [],
    skipped: [],
    names: await readNames(),
    kingdoms: before ? [before.kingdom] : [],
    scannedAt: new Date().toISOString().slice(0, 10),
    expected,
    refresh,
    powered: new Set(),
  };
  const budget = { left: limit };
  await scanLeader(phone, store, budget, log);
  for (const group of groups) {
    await scanGroup(phone, store, group, budget, log);
  }
  await save(store);
  if (store.skipped.length) {
    await decide("members not read", { alliance: tag, players: store.skipped });
    log(`${tag}: not read: ${store.skipped.map((s) => `${s.username} (${s.rank}, ${s.why})`).join(", ")}`);
  }
  const stale = store.members.filter((m) => !store.powered.has(m.playerId)).map((m) => m.username);
  if (refresh) {
    log(`${tag}: power updated for ${store.members.length - stale.length} of ${store.members.length} players`);
    if (stale.length) log(`${tag}: power not read for ${stale.join(", ")}`);
    await decide("updated power", { alliance: tag, updated: store.members.length - stale.length, notRead: stale });
  }
  const missing = store.expected && store.members.length !== store.expected ? `, the game says ${store.expected}` : "";
  log(
    `${tag}: ${store.members.length} players saved in ${
      store.path ? store.path.pathname.split("/").pop() : "no file"
    }${missing}`,
  );
};

const split = (text = "") => text.split(",").map((t) => t.trim()).filter((t) => t);

export const allianceMembers: Recipe = {
  description:
    "Reads the name and player id of every member of the alliances you name (or all of them with --all, or your own with no name) from their profiles and saves one file per alliance, alliance_members_<alliance>_<kingdom>.json, grouped by rank. A player already in the file is not opened again. Each player's power is saved too and updated from the list on every run; --power only updates power and opens nobody.",
  words: "MEMBERS_TAGS",
  flags: { "--limit": "MEMBERS_LIMIT" },
  switches: { "--all": "MEMBERS_ALL", "--power": "MEMBERS_POWER" },
  run: async (phone, settings) => {
    const time = clock(settings.env.CLOCK);
    const log = (text: string) => console.log(`${time()} ${text}`);
    await requireIphone(phone);
    const first = await see(phone);
    if (first.spots.some((l) => l.y < 45 && /^\d{1,2}:\d{2}\b/.test(l.text))) {
      throw new Error("the game is not in front on the phone, open it and start again");
    }
    const limit = Number(settings.env.MEMBERS_LIMIT || 100000);
    const refresh = on(settings.env, "MEMBERS_POWER");
    const named = split(settings.env.MEMBERS_TAGS);
    const tags = on(settings.env, "MEMBERS_ALL")
      ? await toLeaderboard(phone).then(() => tagsOnList(phone, [], 12))
      : named.length
      ? named
      : [await ownTag(phone)];
    log(`alliances: ${tags.join(", ")}`);

    const results = await tags.reduce<Promise<string[]>>(async (done, tag) => {
      const so = await done;
      const failed = await scanOne(phone, tag, limit, refresh, log).then(
        () => undefined,
        (e) => String(e?.message ?? e),
      );
      if (failed) log(`${tag}: stopped, ${failed}`);
      return [...so, ...(failed ? [`${tag}: ${failed}`] : [])];
    }, Promise.resolve([]));
    await goHome(phone, 8);
    if (results.length) throw new Error(results.join("; "));
  },
};
