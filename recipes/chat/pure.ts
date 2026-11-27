export type Spot = { text: string; x: number; y: number };

const plain = (text: string) => text.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");

export const onChat = (spots: Spot[]) =>
  spots.some((l) => l.y < 95 && /^Chat$/.test(l.text)) &&
  spots.some((l) => l.y > 100 && l.y < 140 && l.text === "Alliance");

export const allianceField = (spots: Spot[]) => spots.find((l) => /^\[Alliance\]/.test(l.text));

export const sendButton = (spots: Spot[]) => spots.find((l) => l.text === "Send");

export const shows = (spots: Spot[], message: string, above = 10000) => {
  const wanted = plain(message);
  const start = wanted.slice(0, 12);
  return wanted.length > 0 && spots.some((l) => l.y < above && plain(l.text).includes(start));
};

export const chatBar = (spots: Spot[]) => {
  const label = spots.find((l) => l.y > 820 && /^(Conquest|Heroes|Backpack)$/.test(l.text));
  return label ? { x: 200, y: label.y - 68 } : undefined;
};
