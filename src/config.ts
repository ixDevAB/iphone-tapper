import { parse } from "@std/dotenv";
import { pickTeam } from "./team.ts";

const file = await Deno.readTextFile(new URL("../.env", import.meta.url)).catch(() => "");

const env = parse(file);

const teamId = env.TEAM_ID || await pickTeam();

export const config = {
  teamId,
  bundleId: env.BUNDLE_ID || `wda.${teamId.toLowerCase()}.runner`,
  udid: env.DEVICE_UDID || undefined,
  intervalMs: Number(env.INTERVAL_MS || 300),
  maxIdleMs: Number(env.MAX_IDLE_SECONDS || 600) * 1000,
};
