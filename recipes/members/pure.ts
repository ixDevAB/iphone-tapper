export type Spot = { text: string; x: number; y: number };
export type Player = { username: string; playerId: string; power?: string };
export type Member = Player & { rank: string };
export type Skipped = { username: string; rank: string; why: string };
export type Card = { name: string; key: string; x: number; y: number; power?: string };

export const ranks = ["r5", "r4", "r3", "r2", "r1"];

export const tidyName = (name: string) => name.replace(/^\[\s*[A-Za-z0-9]{3}\s*[\]|)Il1]?\s*/, "").trim();

export const norm = (text: string) =>
  text.toLowerCase().replace(/[i1|]/g, "l").replace(/0/g, "o").replace(/[^a-z0-9]/g, "");

export const tagOf = (text: string) => text.match(/^\[\s*([A-Za-z0-9]{3})/)?.[1];

export const powerText = (text: string) => {
  const found = text.match(/(\d[\d.,:]*)\s*([KMB])(?![A-Za-z])/);
  return found ? `${found[1].replace(/[,:]/g, ".")}${found[2]}` : undefined;
};

export const cardsOn = (lines: Spot[]): Card[] =>
  lines.flatMap((name) => {
    const power = lines.find((l) =>
      /\d[\d.,:]*\s*[KMB]$/.test(l.text) && l.y - name.y > 12 && l.y - name.y < 26 && Math.abs(l.x - name.x) < 45
    );
    if (!power || name.y < 190 || name.y > 770 || /^\W*[\d.,:]+\s*[KMB]$/.test(name.text)) return [];
    return [{
      name: name.text,
      key: `${name.x < 200 ? "L" : "R"}${
        (power.text.match(/([\d.,:]+)\s*[KM]$/)?.[1] ?? power.text.slice(-6)).replace(/[^\dB]/g, "")
      }`,
      x: name.x,
      y: name.y + 20,
      power: powerText(power.text),
    }];
  });

export const headersOn = (lines: Spot[]) =>
  lines
    .filter((l) => /^R[1-4]$/.test(l.text) && l.x < 70 && l.y > 190 && l.y < 800)
    .toSorted((a, b) => a.y - b.y);

export const signature = (lines: Spot[]) =>
  [...headersOn(lines).map((h) => h.text), ...cardsOn(lines).map((c) => c.key)].join("|");

export const cardOwner = (headers: Spot[], card: { y: number }) => headers.filter((h) => h.y < card.y - 30).at(-1);

export const isOpen = (headers: Spot[], cards: { y: number }[], header: Spot) =>
  cards.some((c) => cardOwner(headers, c) === header);

export const groupToFix = (lines: Spot[], group: string) => {
  const headers = headersOn(lines);
  const cards = cardsOn(lines);
  const closing = headers.find((h) => h.text !== group && isOpen(headers, cards, h));
  const opening = headers.find((h) => h.text === group && !isOpen(headers, cards, h));
  return closing ?? opening;
};

const distance = (a: string, b: string) =>
  [...a].reduce(
    (row, ca, i) =>
      [...b].reduce((next, cb, j) => [...next, Math.min(row[j + 1] + 1, next[j] + 1, row[j] + (ca === cb ? 0 : 1))], [
        i + 1,
      ]),
    Array.from({ length: b.length + 1 }, (_, j) => j),
  )[b.length];

export const sameName = (one: string, other: string) => {
  const [a, b] = [norm(one), norm(other)];
  const short = Math.min(a.length, b.length);
  if (short === 0) return false;
  return a === b || distance(a, b) <= (short >= 10 ? 2 : short >= 6 ? 1 : 0);
};

export type Names = Record<string, string[]>;

export const known = (members: Member[], name: string, names: Names = {}) =>
  members.find((m) => sameName(m.username, name) || (names[m.playerId] ?? []).some((n) => sameName(n, name)));

export const withName = (names: Names, playerId: string, username: string, read: string): Names =>
  sameName(username, read) || (names[playerId] ?? []).some((n) => sameName(n, read))
    ? names
    : { ...names, [playerId]: [...(names[playerId] ?? []), read] };

export const grouped = (members: Member[]) => {
  const sorted = members.toSorted((a, b) => a.username.toLowerCase().localeCompare(b.username.toLowerCase()));
  const byRank = Object.fromEntries(
    ranks.map((rank) => [rank, sorted.filter((m) => m.rank.toLowerCase() === rank).map(plain)]),
  );
  const unranked = sorted.filter((m) => !ranks.includes(m.rank.toLowerCase())).map(plain);
  return unranked.length ? { ...byRank, unranked } : byRank;
};

const plain = ({ username, playerId, power }: Member): Player => ({
  username: tidyName(username),
  playerId,
  ...(power ? { power } : {}),
});

export const fileText = (
  head: { scannedAt: string; alliance: string; kingdom: string },
  members: Member[],
  skipped: Skipped[] = [],
) => JSON.stringify({ ...head, count: members.length, ...grouped(members), skipped }, null, 2) + "\n";

export const withSkipped = (skipped: Skipped[], one: Skipped) => [
  ...skipped.filter((s) => !sameName(s.username, one.username)),
  one,
];

export const withoutSkipped = (skipped: Skipped[], name: string) => skipped.filter((s) => !sameName(s.username, name));

export const membersFrom = (stored: Record<string, unknown>): Member[] =>
  Object.entries(stored).flatMap(([key, list]) =>
    Array.isArray(list) && key !== "skipped"
      ? (list as Player[]).map((p) => ({ ...p, rank: ranks.includes(key) ? key.toUpperCase() : "" }))
      : []
  );

export const idFrom = (lines: Spot[]) => lines.map((l) => l.text.match(/^I?D:\s*(\d{5,})$/)).find((m) => m)?.[1];

export const powerFrom = (lines: Spot[]) => {
  const id = lines.find((l) => /^I?D:\s*\d{5,}$/.test(l.text));
  const below = id &&
    lines.find((l) => l.y - id.y > 10 && l.y - id.y < 34 && Math.abs(l.x - id.x) < 45 && powerText(l.text));
  return below ? powerText(below.text) : undefined;
};

export const kingdomFrom = (lines: Spot[]) => lines.map((l) => l.text.match(/^Kingdom:\s*#?(\d+)/)).find((m) => m)?.[1];

export const allianceFrom = (lines: Spot[]) =>
  lines.map((l) => l.text.match(/^Alliance:\s*([A-Za-z0-9]{3})/)).find((m) => m)?.[1];

export const nameFrom = (lines: Spot[]) =>
  lines.find((l) => l.y > 620 && l.y < 660 && l.x < 330 && l.text.length > 2 && !/^[•.\s]+$/.test(l.text))?.text ?? "";

export const allianceRows = (lines: Spot[]) =>
  lines.flatMap((l) => {
    const tag = tagOf(l.text);
    return tag && l.y > 150 && l.y < 800 ? [{ tag, x: l.x, y: l.y }] : [];
  });

export const fileTag = (alliance: string) => alliance.replace(/[a-z]/g, (letter) => `${letter}-`);

export const fileName = (alliance: string, kingdom: string) => `alliance_members_${fileTag(alliance)}_${kingdom}.json`;
