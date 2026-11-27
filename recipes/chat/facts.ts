import general from "./facts.json" with { type: "json" };
import dated from "./on_this_day.json" with { type: "json" };

export type Fact = { region: string; fact: string };
export type Dated = Fact & { date: string; year: number };
export type Sources = { general: Fact[]; dated: Dated[] };

const sources: Sources = { general, dated };
const onThisDayShare = 80;

export const dayOfYear = (date: Date) =>
  Math.round(
    (Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) - Date.UTC(date.getFullYear(), 0, 1)) / 86400000,
  ) + 1;

export const dateKey = (date: Date) =>
  `${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

export const generalFact = (date: Date, all: Fact[] = general) =>
  all.length ? all[(dayOfYear(date) - 1) % all.length].fact : "";

export const onThisDay = (date: Date, all: Dated[] = dated) => all.find((d) => d.date === dateKey(date))?.fact ?? "";

export const dailyFact = (date: Date, from: Sources, roll: number) => {
  const today = onThisDay(date, from.dated);
  const any = generalFact(date, from.general);
  return today && (roll < onThisDayShare || !any) ? today : any;
};

type Choice = { percent?: number; text: string };

const marks = {
  daily: "\u0000daily\u0000",
  today: "\u0000today\u0000",
  general: "\u0000general\u0000",
};
const group = /\{\s*(rand%[^{}]*)\}/g;
const choice = /^\s*(?:rand%(\d+(?:\.\d+)?)\s*)?(?:(["'])(.*?)\2|([A-Za-z_]+))\s*(?:\||$)/;

const named: Record<string, string> = {
  daily_fact: marks.daily,
  dailyfact: marks.daily,
  on_this_day: marks.today,
  onthisday: marks.today,
  history_fact: marks.general,
  historyfact: marks.general,
};

const choicesIn = (body: string): Choice[] => {
  const found = body.match(choice);
  if (!found) return [];
  const [whole, percent, , quoted, word] = found;
  const text = quoted ?? named[word.toLowerCase()] ?? word;
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

export const fill = (template: string, date: Date, from: Sources = sources, random: () => number = Math.random) => {
  const chosen = template
    .replaceAll("{daily_fact}", marks.daily)
    .replaceAll("{on_this_day}", marks.today)
    .replaceAll("{history_fact}", marks.general)
    .replace(group, (_, body: string) => pickChoice(choicesIn(body), random() * 100));
  const daily = chosen.includes(marks.daily) ? dailyFact(date, from, random() * 100) : "";
  return chosen
    .replaceAll(marks.daily, daily)
    .replaceAll(marks.today, onThisDay(date, from.dated) || generalFact(date, from.general))
    .replaceAll(marks.general, generalFact(date, from.general))
    .replace(/\s+/g, " ")
    .trim();
};
