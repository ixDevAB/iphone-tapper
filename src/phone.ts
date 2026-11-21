import { decodeBase64 } from "@std/encoding/base64";
import { decode } from "fast-png";
import { startOcr } from "./ocr.ts";
import { sleep } from "./time.ts";

const check = <T extends { value?: unknown }>(res: T) => {
  const value = res.value as { error?: string; message?: string } | null | undefined;
  if (value?.message?.includes("Not authorized")) {
    throw new Error("the phone stopped accepting taps, unlock it, keep the screen on and start again");
  }
  if (value?.error) throw new Error(value.message ?? value.error);
  return res;
};

const lost = (): never => {
  throw new Error("lost the connection to the phone, check the cable, unlock it and start again");
};

export const connectPhone = async (base: string) => {
  const post = (path: string, body: unknown) =>
    fetch(`${base}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20000),
    }).then((r) => r.json(), lost).then(check);

  const { sessionId } = await post("/session", { capabilities: { alwaysMatch: {} } });
  await post(`/session/${sessionId}/appium/settings`, {
    settings: { waitForIdleTimeout: 0, animationCoolOffTimeout: 0 },
  });
  const ocr = startOcr();

  const snap = async () => {
    const { value } = await fetch(`${base}/screenshot`, { signal: AbortSignal.timeout(20000) })
      .then((r) => r.json(), lost)
      .then(check);
    return decodeBase64(value);
  };

  const screenshot = async () => decode(await snap());

  const tap = (point: { x: number; y: number }) => post(`/session/${sessionId}/wda/tap`, point);

  const drag = (from: { x: number; y: number }, to: { x: number; y: number }, seconds = 0.6) =>
    post(`/session/${sessionId}/wda/dragfromtoforduration`, {
      fromX: from.x,
      fromY: from.y,
      toX: to.x,
      toY: to.y,
      duration: seconds,
    });

  const type = async (keys: string[]) => {
    for (const key of keys) {
      await post(`/session/${sessionId}/wda/keys`, { value: [key] });
      await sleep(250);
    }
  };

  return { screenshot, snap, tap, drag, type, ocr: ocr.read, ocrPng: ocr.readPng, close: ocr.stop };
};

export type Phone = Awaited<ReturnType<typeof connectPhone>>;
