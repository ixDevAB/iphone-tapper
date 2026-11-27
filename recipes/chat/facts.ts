import facts from "./facts.json" with { type: "json" };

export type Fact = { region: string; fact: string };

export const dayOfYear = (date: Date) =>
  Math.round(
    (Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) - Date.UTC(date.getFullYear(), 0, 1)) / 86400000,
  ) + 1;

export const factFor = (date: Date, all: Fact[] = facts) =>
  all.length ? all[(dayOfYear(date) - 1) % all.length].fact : "";

type Choice = { percent?: number; text: string };

const factMark = "\u0000fact\u0000";
const group = /\{\s*(rand%[^{}]*)\}/g;
const choice = /^\s*(?:rand%(\d+(?:\.\d+)?)\s*)?(["'])(.*?)\2\s*(?:\||$)/;

const choicesIn = (body: string): Choice[] => {
  const found = body.match(choice);
  if (!found) return [];
  const [whole, percent, , text] = found;
  return [
    { percent: percent === undefined ? undefined : Number(percent), text },
    ...choicesIn(body.slice(whole.length)),
  ];
};

export const pickChoice = (choices: Choice[], roll: number) => {
  const picked = choices.reduce<{ text?: string; from: number }>((state, c) => {
    if (state.text !== undefined) return state;
    const to = c.percent === undefined ? 100 : state.from + c.percent;
    return roll >= state.from && roll < to ? { text: c.text, from: to } : { from: to };
  }, { from: 0 });
  return picked.text ?? "";
};

export const fill = (template: string, date: Date, all: Fact[] = facts, random: () => number = Math.random) =>
  template
    .replaceAll("{daily_fact}", factMark)
    .replace(group, (_, body: string) => pickChoice(choicesIn(body), random() * 100))
    .replaceAll(factMark, factFor(date, all))
    .replace(/\s+/g, " ")
    .trim();
