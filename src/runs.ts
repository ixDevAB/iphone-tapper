import { DatabaseSync } from "node:sqlite";

export type Run = { task: string; startedAt: number; finishedAt: number; ok: boolean; error?: string; nextAt?: number };

const file = new URL("../runs.db", import.meta.url).pathname;

const number = (value: unknown) => typeof value === "number" ? value : undefined;
const text = (value: unknown) => typeof value === "string" ? value : undefined;

export const openRuns = (path = file) => {
  const db = new DatabaseSync(path);
  db.exec(`
    create table if not exists runs (
      id integer primary key,
      task text not null,
      started_at integer not null,
      finished_at integer not null,
      ok integer not null,
      error text,
      next_at integer
    )
  `);
  const insert = db.prepare(
    "insert into runs (task, started_at, finished_at, ok, error, next_at) values (?, ?, ?, ?, ?, ?)",
  );
  const latest = db.prepare("select * from runs where task = ? order by id desc limit 1");
  const newest = db.prepare("select * from runs order by id desc limit ?");

  const read = (row: Record<string, unknown>): Run => ({
    task: text(row.task) ?? "",
    startedAt: number(row.started_at) ?? 0,
    finishedAt: number(row.finished_at) ?? 0,
    ok: row.ok === 1,
    error: text(row.error),
    nextAt: number(row.next_at),
  });

  return {
    record: (run: Run) => {
      insert.run(run.task, run.startedAt, run.finishedAt, run.ok ? 1 : 0, run.error ?? null, run.nextAt ?? null);
    },
    last: (task: string) => {
      const row = latest.get(task);
      return row ? read(row) : undefined;
    },
    recent: (limit: number) => newest.all(limit).map(read),
    close: () => db.close(),
  };
};

export type Runs = ReturnType<typeof openRuns>;
