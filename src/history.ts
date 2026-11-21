import { openRuns } from "./runs.ts";

const at = (ms: number) => new Date(ms).toLocaleString("sv-SE").slice(0, 16);

const runs = openRuns();
const rows = runs.recent(Number(Deno.args[0] || 30)).toReversed();
runs.close();

console.log(
  rows.length
    ? rows.map((r) => {
      const took = `${Math.round((r.finishedAt - r.startedAt) / 1000)}s`.padStart(5);
      const next = r.nextAt ? `  next ${at(r.nextAt)}` : "";
      return `${at(r.startedAt)}  ${r.task.padEnd(17)} ${took}  ${r.ok ? "ok" : `failed: ${r.error}`}${next}`;
    }).join("\n")
    : "no runs yet",
);
