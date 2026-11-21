import { readArgs } from "./args.ts";
import { config } from "./config.ts";
import { findPhone } from "./device.ts";
import { ensureOcr } from "./ocr.ts";
import { connectPhone } from "./phone.ts";
import { on } from "./recipe.ts";
import { recipes } from "./recipes.ts";
import { openRuns } from "./runs.ts";
import { logged, steps } from "../recipes/all/steps.ts";
import { ensureWda, startWda } from "./wda.ts";

const name = Deno.args[0] ?? "";
const recipe = recipes[name];
if (!recipe) {
  console.log(`pick a recipe:\n${Object.entries(recipes).map(([n, r]) => `  just ${n}  ${r.description}`).join("\n")}`);
  Deno.exit(1);
}

const args = readArgs(recipe, Deno.args.slice(1));
if (args.error) {
  console.log(args.error);
  Deno.exit(1);
}
const runs = openRuns();
const settings = { ...config, env: { ...config.env, ...args.env }, given: args.given, runs };

const startedAt = Date.now();
const took = () => `${((Date.now() - startedAt) / 1000).toFixed(0)}s`;
const phone = await findPhone(config.udid);
console.log(`found ${phone.name} (${took()})`);

const base = `http://[${phone.tunnelIp}]:8100`;

await ensureOcr(settings.env);
await ensureWda(phone.udid, config.teamId, config.bundleId, on(settings.env, "WDA_REBUILD"));
const wda = await startWda(phone.udid, config.teamId, config.bundleId, base);
console.log(`the helper on the phone is ready (${took()})`);
const connected = await connectPhone(base);

const stop = () => {
  connected.close();
  runs.close();
  wda?.kill();
  Deno.exit(0);
};
Deno.addSignalListener("SIGINT", stop);

console.log(`${recipe.description}\npress ctrl+c to stop`);
await logged(settings, name, steps.find((s) => s.recipe === recipe), () => recipe.run(connected, settings));
stop();
