import type { TextLine } from "./ocr.ts";
import type { Phone } from "./phone.ts";
import { type Env, on } from "./recipe.ts";
import { center, closeDialog, exact } from "./screen.ts";
import { sleep } from "./time.ts";

export const staminaFlags = { "--stamina": "INTEL_STAMINA" };
export const staminaSwitches = {
  "--storehouse": "STAMINA_STOREHOUSE",
  "--gourmet": "STAMINA_STOREHOUSE",
  "--embrace": "STAMINA_EMBRACE",
};

export type Refills = { storehouse: boolean; embrace: boolean; meatBudget: number };

export const refillsFrom = (env: Env): Refills => ({
  storehouse: on(env, "STAMINA_STOREHOUSE"),
  embrace: on(env, "STAMINA_EMBRACE"),
  meatBudget: Math.floor(Number(env.INTEL_STAMINA || 0) / 10),
});

const claimBeside = (lines: TextLine[], title: string) => {
  const row = exact(lines, title)[0];
  return row ? exact(lines, "Claim").find((c) => Math.abs(center(c).y - center(row).y) < 30) : undefined;
};

export const staminaDialog = (lines: TextLine[]) => exact(lines, "Get More").length > 0;

export const refill = async (
  phone: Phone,
  lines: TextLine[],
  refills: Refills,
  meatUsed: number,
  needed: number,
  log: (text: string) => void,
) => {
  const bar = lines.map((l) => l.text.match(/^(\d+)\s*\/\s*(\d+)$/)).find((m) => m);
  const current = bar ? Number(bar[1]) : undefined;
  if (current !== undefined && current >= needed) {
    await phone.tap(closeDialog);
    await sleep(1000);
    return { meatUsed, current, enough: true, empty: undefined };
  }
  const feast = refills.storehouse ? claimBeside(lines, "Gourmet Feast") : undefined;
  const embrace = refills.embrace ? claimBeside(lines, "Comforting Embrace") : undefined;
  const use = meatUsed < refills.meatBudget ? exact(lines, "Use")[0] : undefined;
  const source = feast ?? embrace ?? use;
  if (!source) {
    await phone.tap(closeDialog);
    await sleep(1000);
    const shown = current === undefined ? "" : ` (${current})`;
    return {
      meatUsed,
      current,
      enough: false,
      empty: `out of stamina${shown}, add --storehouse, --embrace or --stamina 50 to refill`,
    };
  }
  const how = feast
    ? "claiming the storehouse feast"
    : embrace
    ? "claiming the comforting embrace"
    : `using a meat (${meatUsed + 1} of ${refills.meatBudget})`;
  log(`stamina ${current ?? "?"}, ${how}`);
  await phone.tap(center(source));
  await sleep(1500);
  return { meatUsed: source === use ? meatUsed + 1 : meatUsed, current, enough: false, empty: undefined };
};
