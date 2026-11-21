import { config } from "./config.ts";
import { findPhone } from "./device.ts";
import { ensureOcr } from "./ocr.ts";
import { connectPhone } from "./phone.ts";
import { recipes } from "./recipes.ts";
import { ensureWda, startWda } from "./wda.ts";

const name = Deno.args[0] ?? "";
const recipe = recipes[name];
if (!recipe) {
  console.log(`pick a recipe:\n${Object.entries(recipes).map(([n, r]) => `  deno task ${n}  ${r.description}`).join("\n")}`);
  Deno.exit(1);
}

const valueFlags: Record<string, string> = {
  "--allies": "START_ALLIES",
  "-a": "START_ALLIES",
  "--start": "CALIBRATE_START",
  "-s": "CALIBRATE_START",
  "--tier": "CALIBRATE_TIER",
  "-t": "CALIBRATE_TIER",
  "--increment": "CALIBRATE_STEP",
  "-i": "CALIBRATE_STEP",
  "--stamina": "INTEL_STAMINA",
  "--level": "HUNT_LEVEL",
  "--rss": "BACKPACK_RSS",
  "--only": "RUN_ONLY",
  "--skip": "RUN_SKIP",
  "--arch": "HUNT_ARCH",
  "--inf": "HUNT_INF",
  "--cav": "HUNT_CAV",
};
const switches = ["--save", "--fresh", "--rebuild", "--pan", "--storehouse", "--gourmet", "--embrace", "--buy-vip", "--force"];

const unknown = Deno.args.filter((arg) => arg.startsWith("-") && !(arg in valueFlags) && !switches.includes(arg));
if (unknown.length) {
  console.log(`unknown argument ${unknown.join(" ")}, use ${[...Object.keys(valueFlags), ...switches].join(" ")}`);
  Deno.exit(1);
}

Deno.args.forEach((arg, i) => {
  const setting = valueFlags[arg];
  const value = Deno.args[i + 1];
  if (!setting) return;
  if (value === undefined || value.startsWith("-")) {
    console.log(`${arg} needs a value`);
    Deno.exit(1);
  }
  config.env[setting] = value;
});

const amount = Deno.args.slice(1).find((arg, i, all) => /^\d+$/.test(arg) && !(all[i - 1] in valueFlags));
if (amount) config.env.AMOUNT = amount;

const startedAt = Date.now();
const took = () => `${((Date.now() - startedAt) / 1000).toFixed(0)}s`;
const phone = await findPhone(config.udid);
console.log(`found ${phone.name} (${took()})`);

const base = `http://[${phone.tunnelIp}]:8100`;

await ensureOcr();
await ensureWda(phone.udid, config.teamId, config.bundleId, Deno.args.includes("--rebuild"));
const wda = await startWda(phone.udid, config.teamId, config.bundleId, base);
console.log(`the helper on the phone is ready (${took()})`);
const connected = await connectPhone(base);

const stop = () => {
  connected.close();
  wda?.kill();
  Deno.exit(0);
};
Deno.addSignalListener("SIGINT", stop);

console.log(`${recipe.description}\npress ctrl+c to stop`);
await recipe.run(connected, config).catch((e) => console.log(`stopped: ${e.message}`));
stop();
