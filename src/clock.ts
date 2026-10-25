export const clock = (format = "24h") => () =>
  new Date().toLocaleTimeString(format === "12h" ? "en-US" : "en-GB", { hour12: format === "12h" });
