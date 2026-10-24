import { config } from "./config.ts";
import { findPhone } from "./device.ts";
import { ensureOcr } from "./ocr.ts";
import { connectPhone } from "./phone.ts";
import { recipes } from "./recipes.ts";
import { ensureWda, startWda } from "./wda.ts";

const name = Deno.args.find((a) => !a.startsWith("--")) ?? "";
const recipe = recipes[name];
if (!recipe) {
  console.log(`pick a recipe:\n${Object.entries(recipes).map(([n, r]) => `  deno task ${n}  ${r.description}`).join("\n")}`);
  Deno.exit(1);
}

const phone = await findPhone(config.udid);
console.log(`found ${phone.name}`);

const base = `http://[${phone.tunnelIp}]:8100`;

await ensureOcr();
await ensureWda(phone.udid, config.teamId, config.bundleId, Deno.args.includes("--rebuild"));
const wda = await startWda(phone.udid, config.teamId, config.bundleId, base);
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
