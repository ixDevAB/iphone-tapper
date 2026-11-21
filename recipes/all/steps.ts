import { decide, during } from "../../src/decisions.ts";
import type { Phone } from "../../src/phone.ts";
import { type Env, on, optionsOf, type Recipe, type Settings } from "../../src/recipe.ts";
import { clock } from "../../src/time.ts";
import { goHome } from "../../src/world.ts";
import { claimAlliance } from "../alliance/recipe.ts";
import { collectBackpack } from "../backpack/recipe.ts";
import { collectConquest } from "../conquest/recipe.ts";
import { collectDaily } from "../daily/recipe.ts";
import { claimFreebies } from "../freebies/recipe.ts";
import { intel } from "../intel/recipe.ts";
import { claimMail } from "../mail/recipe.ts";
import { collectPet } from "../pets/recipe.ts";
import { recruit } from "../recruit/recipe.ts";
import { shop } from "../shop/recipe.ts";
import { terrorHunt } from "../terror/recipe.ts";
import { claimVip } from "../vip/recipe.ts";

export const minute = 60;
export const hour = 60 * minute;
const dayMs = 24 * hour * 1000;
const retry = 30 * minute;

export type Step = { name: string; recipe: Recipe; every: number | "day"; env?: (env: Env) => Env };

const twoRallies = (env: Env) => ({
  ...env,
  AMOUNT: env.AMOUNT || "2",
  HUNT_ARCH: env.HUNT_ARCH || "diana",
  HUNT_CAV: env.HUNT_CAV || "fahd",
});

export const steps: Step[] = [
  { name: "intel", recipe: intel, every: 3 * hour },
  { name: "terror-hunt", recipe: terrorHunt, every: "day", env: twoRallies },
  { name: "claim-mail", recipe: claimMail, every: 2 * hour },
  { name: "claim-alliance", recipe: claimAlliance, every: 2 * hour },
  { name: "shop", recipe: shop, every: 30 * minute, env: (env) => ({ ...env, SHOP_BUY_VIP: "1" }) },
  { name: "recruit", recipe: recruit, every: 30 * minute },
  { name: "collect-pet", recipe: collectPet, every: 4 * hour },
  { name: "claim-freebies", recipe: claimFreebies, every: "day" },
  { name: "claim-vip", recipe: claimVip, every: "day" },
  { name: "collect-conquest", recipe: collectConquest, every: 4 * hour },
  { name: "collect-backpack", recipe: collectBackpack, every: 12 * hour },
  { name: "collect-daily", recipe: collectDaily, every: 4 * hour },
];

export const pick = (names: string[]) => names.flatMap((name) => steps.filter((s) => s.name === name));

export const againSwitch = { "--again": "RUN_AGAIN" };

export const nextReset = (after: number, resetHour: number) => {
  const day = new Date(after);
  const today = Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), resetHour);
  return today > after ? today : today + dayMs;
};

export const nextAt = (step: Step, ok: boolean, wants: number | void, now: number, resetHour: number) => {
  if (!ok) return now + (step.every === "day" ? retry : Math.min(step.every, retry)) * 1000;
  if (typeof wants === "number") return now + Math.max(minute, wants) * 1000;
  return step.every === "day" ? nextReset(now, resetHour) : now + step.every * 1000;
};

export const logged = async (
  settings: Settings,
  name: string,
  step: Step | undefined,
  run: () => Promise<void | number>,
) => {
  const startedAt = Date.now();
  const outer = during(name);
  await decide("started");
  const result = await run().then(
    (wants) => ({ ok: true, wants, error: undefined }),
    (e) => ({ ok: false, wants: undefined, error: String(e?.message ?? e) }),
  );
  if (result.error) console.log(`stopped: ${result.error}`);
  const finishedAt = Date.now();
  const next = step
    ? nextAt(step, result.ok, result.wants, finishedAt, Number(settings.env.DAY_RESET_UTC_HOUR || 0))
    : undefined;
  settings.runs.record({ task: name, startedAt, finishedAt, ok: result.ok, error: result.error, nextAt: next });
  await decide(result.ok ? "ended" : "ended early", result.error ? { why: result.error } : {});
  during(outer);
  return next;
};

export const runStep = (phone: Phone, settings: Settings, step: Step) =>
  logged(
    settings,
    step.name,
    step,
    () => step.recipe.run(phone, { ...settings, env: step.env ? step.env(settings.env) : settings.env }),
  );

export const doneToday = (settings: Settings, step: Step) => {
  const last = settings.runs.last(step.name);
  const waits = step.every === "day" && !on(settings.env, "RUN_AGAIN") && last?.ok && (last.nextAt ?? 0) > Date.now();
  return waits ? last.nextAt : undefined;
};

const at = (ms: number) => new Date(ms).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

export const sequence = (description: string, chosen: Step[]): Recipe => {
  const options = optionsOf(chosen.map((s) => s.recipe));
  return {
    description,
    ...options,
    switches: { ...options.switches, ...againSwitch },
    run: async (phone, settings) => {
      const time = clock(settings.env.CLOCK);
      for (const step of chosen) {
        const until = doneToday(settings, step);
        if (until) {
          console.log(
            `\n${time()} == ${step.name} == done today, due again at ${at(until)} (add --again to run it now)`,
          );
          continue;
        }
        console.log(`\n${time()} == ${step.name} ==`);
        await runStep(phone, settings, step);
        if (!(await goHome(phone, 5))) {
          console.log(`${time()} could not get back to the world map after ${step.name}, stopping`);
          return;
        }
      }
      console.log(`\n${time()} done`);
    },
  };
};
