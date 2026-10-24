import { parse } from "@std/dotenv";

const file = await Deno.readTextFile(new URL("../.env", import.meta.url)).catch(() => {
  throw new Error("missing .env file, copy .env.example to .env and fill it in");
});

const env = parse(file);

const required = (key: string) => {
  const value = env[key];
  if (!value) throw new Error(`${key} is missing in .env`);
  return value;
};

export const config = {
  teamId: required("TEAM_ID"),
  bundleId: required("BUNDLE_ID"),
  udid: env.DEVICE_UDID || undefined,
  tap: { x: Number(env.TAP_X || 267), y: Number(env.TAP_Y || 643) },
  intervalMs: Number(env.INTERVAL_MS || 300),
  checkEvery: Number(env.CHECK_EVERY || 100),
  maxIdleMs: Number(env.MAX_IDLE_SECONDS || 600) * 1000,
};
