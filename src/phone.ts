import { decodeBase64 } from "@std/encoding/base64";
import { decode } from "fast-png";
import { startOcr } from "./ocr.ts";
import { sleep } from "./wda.ts";

const check = <T extends { value?: unknown }>(res: T) => {
  const value = res.value as { error?: string; message?: string } | null | undefined;
  if (value?.message?.includes("Not authorized")) {
    throw new Error("the phone stopped accepting taps, unlock it, keep the screen on and start again");
  }
  if (value?.error) throw new Error(value.message ?? value.error);
  return res;
};

export const connectPhone = async (base: string) => {
  const post = (path: string, body: unknown) =>
    fetch(`${base}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then((r) => r.json()).then(check);

  const { sessionId } = await post("/session", { capabilities: { alwaysMatch: {} } });
  await post(`/session/${sessionId}/appium/settings`, {
    settings: { waitForIdleTimeout: 0, animationCoolOffTimeout: 0 },
  });
  const ocr = startOcr();

  const screenshot = async () => {
    const { value } = await fetch(`${base}/screenshot`).then((r) => r.json()).then(check);
    return decode(decodeBase64(value));
  };

  const tap = (point: { x: number; y: number }) => post(`/session/${sessionId}/wda/tap`, point);

  const type = async (keys: string[]) => {
    for (const key of keys) {
      await post(`/session/${sessionId}/wda/keys`, { value: [key] });
      await sleep(250);
    }
  };

  return { screenshot, tap, type, ocr: ocr.read, close: ocr.stop };
};

export type Phone = Awaited<ReturnType<typeof connectPhone>>;
