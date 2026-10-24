export type Recipe = {
  description: string;
  screenWidth: number;
  tap: { x: number; y: number };
  buttons: { name: string; ref: string; x: number; y: number; counts?: boolean }[];
};

export const recipes: Record<string, Recipe> = {
  "kingshot-heal": {
    description: "Kingshot: presses Heal, then Help, until all troops are healed. Never presses Speed Up or Finish.",
    screenWidth: 1206,
    tap: { x: 267, y: 643 },
    buttons: [
      { name: "heal", ref: "heal.png", x: 786, y: 1919, counts: true },
      { name: "help", ref: "help.png", x: 790, y: 1935 },
    ],
  },
};
