export type Action = { kind: string; at: number[] };

type Watch = { screen: Set<string>; fresh: boolean; last?: { action: Action; screen: Set<string> }; repeats: number };

export const fresh: Watch = { screen: new Set(), fresh: false, repeats: 0 };

export const words = (texts: string[]) =>
  new Set(
    texts.map((t) => t.replace(/@-?\d+,-?\d+$/, "").toLowerCase().replace(/[^a-z]/g, "").replace(/i/g, "l")).filter((
      w,
    ) => w.length >= 3),
  );

export const alike = (a: Set<string>, b: Set<string>) => {
  const shared = [...a].filter((w) => b.has(w)).length;
  const all = a.size + b.size - shared;
  return all === 0 || shared / all >= 0.8;
};

const sameAction = (a: Action, b: Action) =>
  a.kind === b.kind && a.at.length === b.at.length && a.at.every((n, i) => Math.abs(n - b.at[i]) <= 6);

export const sawScreen = (watch: Watch, texts: string[]): Watch => ({ ...watch, screen: words(texts), fresh: true });

export const acted = (watch: Watch, action: Action): Watch => {
  if (!watch.fresh) return watch;
  const same = watch.last && sameAction(watch.last.action, action) && alike(watch.last.screen, watch.screen);
  return { ...watch, fresh: false, last: { action, screen: watch.screen }, repeats: same ? watch.repeats + 1 : 1 };
};

export const said = (action: Action, repeats: number) =>
  `stuck: ${action.kind} ${repeats} times in a row and the screen stayed the same`;
