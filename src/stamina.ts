import type { TextLine } from "./ocr.ts";
import type { Phone } from "./phone.ts";
import { center, exact } from "./screen.ts";
import { sleep } from "./wda.ts";

const closeDialog = { x: 373, y: 175 };

export type Refills = { storehouse: boolean; embrace: boolean; meatBudget: number };

export const refillsFrom = (env: Record<string, string>): Refills => ({
  storehouse: Deno.args.includes("--storehouse") || Deno.args.includes("--gourmet"),
  embrace: Deno.args.includes("--embrace"),
  meatBudget: Math.floor(Number(env.INTEL_STAMINA || 0) / 10),
});

const claimBeside = (lines: TextLine[], title: string) => {
  const row = exact(lines, title)[0];
  return row ? exact(lines, "Claim").find((c) => Math.abs(center(c).y - center(row).y) < 30) : undefined;
};

export const staminaDialog = (lines: TextLine[]) => exact(lines, "Get More").length > 0;

export const refill = async (phone: Phone, lines: TextLine[], refills: Refills, meatUsed: number, needed: number, log: (text: string) => void) => {
  const bar = lines.map((l) => l.text.match(/^(\d+)\s*\/\s*(\d+)$/)).find((m) => m);
  const current = bar ? Number(bar[1]) : undefined;
  if (current !== undefined && current >= needed) {
    await phone.tap(closeDialog);
    await sleep(1000);
    return { meatUsed, enough: true, empty: undefined };
  }
  const feast = refills.storehouse ? claimBeside(lines, "Gourmet Feast") : undefined;
  const embrace = refills.embrace ? claimBeside(lines, "Comforting Embrace") : undefined;
  const use = meatUsed < refills.meatBudget ? exact(lines, "Use")[0] : undefined;
  const source = feast ?? embrace ?? use;
  if (!source) {
    await phone.tap(closeDialog);
    await sleep(1000);
    return { meatUsed, enough: false, empty: `out of stamina${current === undefined ? "" : ` (${current})`}, add --storehouse, --embrace or --stamina 50 to refill` };
  }
  log(`stamina ${current ?? "?"}, ${feast ? "claiming the storehouse feast" : embrace ? "claiming the comforting embrace" : `using a meat (${meatUsed + 1} of ${refills.meatBudget})`}`);
  await phone.tap(center(source));
  await sleep(1500);
  return { meatUsed: source === use ? meatUsed + 1 : meatUsed, enough: false, empty: undefined };
};
