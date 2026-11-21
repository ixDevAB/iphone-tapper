import { difference, type Image, loadImage, type Point } from "../../src/image.ts";
import type { TextLine } from "../../src/ocr.ts";
import type { Phone } from "../../src/phone.ts";
import { saveShot } from "../../src/screen.ts";
import { sleep } from "../../src/time.ts";

export const healButton = { x: 267, y: 643 };
const cancelButton = { x: 75, y: 659 };
const confirmButton = { x: 285, y: 535 };
export const infantryBox = { x: 302, y: 362 };
const otherBoxes = [{ x: 302, y: 441 }, { x: 302, y: 523 }];

const ref = (file: string, x: number, y: number) => ({
  img: loadImage(new URL(`../../assets/heal/${file}`, import.meta.url)),
  x,
  y,
});
export type Ref = { img: Image } & Point;

export const refs = {
  heal: ref("heal.png", 786, 1919),
  help: ref("help.png", 790, 1935),
  cancel: ref("cancel.png", 150, 1925),
  confirm: ref("confirm.png", 745, 1570),
};
export const tiers = [
  { name: "XI", ref: ref("tier-xi.png", 203, 1098), setting: "TROOPS_PER_ALLY_XI", troops: 60 },
  { name: "X", ref: ref("tier-x.png", 203, 1098), setting: "TROOPS_PER_ALLY_X", troops: 140 },
];

export const shows = (screen: Image, r: Ref) => difference(screen, r.img, r.x, r.y) < 12;

export const amountIn = (lines: TextLine[], down = 0) => {
  const box = lines.find((l) => l.x > 0.65 && l.y > 0.39 + down && l.y < 0.43 + down && /^[\d,.\s]+$/.test(l.text));
  return box ? Number(box.text.replace(/\D/g, "")) : undefined;
};

export const typeInto = async (phone: Phone, box: Point, troops: number, shot?: string) => {
  await phone.tap(box);
  await sleep(800);
  if (shot) await saveShot(shot, await phone.screenshot());
  await phone.type([..."\b".repeat(6), ...String(troops), "\n"]);
  await sleep(800);
};

export const setBatch = async (phone: Phone, troops: number, shot?: string) => {
  await typeInto(phone, infantryBox, troops, shot);
  for (const box of otherBoxes) {
    await typeInto(phone, box, 0).catch(() => undefined);
  }
};

export const waitFor = async (phone: Phone, r: Ref, until: number): Promise<boolean> => {
  if (Date.now() > until) return false;
  if (shows(await phone.screenshot(), r)) return true;
  await sleep(300);
  return waitFor(phone, r, until);
};

export const cancelHeal = async (phone: Phone) => {
  if (!(await waitFor(phone, refs.cancel, Date.now() + 2000))) return false;
  await phone.tap(cancelButton);
  if (!(await waitFor(phone, refs.confirm, Date.now() + 3000))) {
    throw new Error("the cancel healing popup did not show up, stopping to be safe");
  }
  await phone.tap(confirmButton);
  return waitFor(phone, refs.heal, Date.now() + 5000);
};

export const alliesFrom = (lines: { text: string }[]) => {
  const text = lines.map((l) => l.text).join(" ");
  const count = text.match(/(\d+)\s*All[a-z1]{2,4}\b/i)?.[1];
  return count ? Number(count) : /Ally has help/i.test(text) ? 1 : undefined;
};
