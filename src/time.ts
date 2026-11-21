export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const clock = (format = "24h") => () =>
  new Date().toLocaleTimeString(format === "12h" ? "en-US" : "en-GB", { hour12: format === "12h" });

export const secondsIn = (text: string) => text.split(":").map(Number).reduce((sum, n) => sum * 60 + n, 0);
