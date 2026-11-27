import { sameName } from "./pure.ts";

export type Named = { name: string; first: string; last: string };
export type Known = { names: Named[]; readAs: string[]; alliance?: string; kingdom?: string; power?: string };
export type Catalogue = Record<string, Known>;

export const latestName = (known: Known) =>
  known.names.toSorted((a, b) => a.last.localeCompare(b.last)).at(-1)?.name ?? "";

const calledBy = (known: Known) => [...known.names.map((n) => n.name), ...known.readAs];

export const findPlayer = (catalogue: Catalogue, name: string, alliance?: string) =>
  Object.entries(catalogue).find(([, known]) =>
    (!alliance || known.alliance === alliance) && calledBy(known).some((n) => sameName(n, name))
  )?.[0];

export const sawProfile = (
  catalogue: Catalogue,
  playerId: string,
  seen: { name: string; alliance?: string; kingdom?: string; power?: string },
  date: string,
) => {
  const before = catalogue[playerId] ?? { names: [], readAs: [] };
  const same = before.names.find((n) => sameName(n.name, seen.name));
  const names = !seen.name
    ? before.names
    : same
    ? before.names.map((n) => n === same ? { ...n, last: date } : n)
    : [...before.names, { name: seen.name, first: date, last: date }];
  const renamedFrom = seen.name && !same && before.names.length ? latestName(before) : undefined;
  const after: Known = {
    ...before,
    names,
    alliance: seen.alliance ?? before.alliance,
    kingdom: seen.kingdom ?? before.kingdom,
    power: seen.power ?? before.power,
  };
  return { catalogue: { ...catalogue, [playerId]: after }, renamedFrom };
};

export const sawOnList = (catalogue: Catalogue, playerId: string, reading: string, power?: string): Catalogue => {
  const known = catalogue[playerId];
  if (!known) return catalogue;
  const has = !reading || calledBy(known).some((n) => sameName(n, reading));
  return {
    ...catalogue,
    [playerId]: { ...known, readAs: has ? known.readAs : [...known.readAs, reading], power: power ?? known.power },
  };
};

export const catalogueText = (catalogue: Catalogue) =>
  JSON.stringify(Object.fromEntries(Object.entries(catalogue).toSorted(([a], [b]) => a.localeCompare(b))), null, 2) +
  "\n";
