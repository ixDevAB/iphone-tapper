import { decode } from "fast-png";
import { sleep } from "./wda.ts";

type Options = {
  tap: { x: number; y: number };
  intervalMs: number;
  checkEvery: number;
  maxIdleMs: number;
};

const time = () => new Date().toLocaleTimeString();

export const runTapper = async (base: string, { tap, intervalMs, checkEvery, maxIdleMs }: Options) => {
  const post = (path: string, body: unknown) =>
    fetch(`${base}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then((r) => r.json());

  const { sessionId } = await post("/session", { capabilities: { alwaysMatch: {} } });
  await post(`/session/${sessionId}/appium/settings`, {
    settings: { waitForIdleTimeout: 0, animationCoolOffTimeout: 0 },
  });
  const { value: size } = await fetch(`${base}/window/size`).then((r) => r.json());

  const isButton = async () => {
    const { value } = await fetch(`${base}/screenshot`).then((r) => r.json());
    const img = decode(Uint8Array.from(atob(value), (c) => c.charCodeAt(0)));
    const scale = img.width / size.width;
    const i = (Math.round(tap.y * scale) * img.width + Math.round(tap.x * scale)) * img.channels;
    const [r, g, b] = [img.data[i], img.data[i + 1], img.data[i + 2]];
    return r < 130 && g > 180 && b > 180;
  };

  const loop = async (taps: number, idleSince: number): Promise<number> => {
    if (Date.now() - idleSince > maxIdleMs) return taps;
    const ready = taps % checkEvery !== 0 || await isButton().catch(() => false);
    if (!ready) console.log(`${time()} heal button not visible, waiting`);
    if (ready) await post(`/session/${sessionId}/wda/tap`, tap).catch((e) => console.log(`tap failed: ${e.message}`));
    if (ready && taps % 10 === 0) console.log(`${time()} tap ${taps + 1}`);
    await sleep(ready ? intervalMs : 2000);
    return loop(ready ? taps + 1 : taps, ready ? Date.now() : idleSince);
  };

  console.log(`tapping (${tap.x}, ${tap.y}) every ${intervalMs}ms, press ctrl+c to stop`);
  const taps = await loop(0, Date.now());
  console.log(`no heal button for ${maxIdleMs / 1000}s, stopped after ${taps} taps`);
};
