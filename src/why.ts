const file = new URL("../decisions.log", import.meta.url);

export const told = (entry: Record<string, unknown>) => {
  const { at, task, decision, texts, text, ...rest } = entry;
  const details = Object.entries(rest)
    .map(([key, value]) => `${key}=${typeof value === "string" ? value : JSON.stringify(value)}`)
    .join(" ");
  const read = Array.isArray(texts) ? texts.join(" | ") : typeof text === "string" ? text : "";
  return `${String(at).slice(11)} ${String(task).padEnd(17)} ${decision}${details ? ` ${details}` : ""}${
    read ? `: ${read}` : ""
  }`;
};

if (import.meta.main) {
  const [count = "60", ...words] = Deno.args;
  const lines = (await Deno.readTextFile(file).catch(() => "")).split("\n").filter((l) => l);
  const wanted = lines.filter((l) => words.every((w) => l.toLowerCase().includes(w.toLowerCase())));
  const shown = wanted.slice(-Number(count)).flatMap((l) => {
    try {
      return [told(JSON.parse(l))];
    } catch {
      return [];
    }
  });
  console.log(shown.length ? shown.join("\n") : "nothing written down yet");
}
