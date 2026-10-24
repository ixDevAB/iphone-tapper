import { decode } from "fast-png";
import type { Recipe } from "./recipes.ts";
import { sleep } from "./wda.ts";

type Options = {
  intervalMs: number;
  maxIdleMs: number;
};

type Image = ReturnType<typeof decode>;

const maxDiff = 12;

const diff = (screen: Image, ref: Image, x0: number, y0: number) => {
  const total = Array.from({ length: ref.width * ref.height }).reduce<number>((sum, _, p) => {
    const s = ((y0 + Math.floor(p / ref.width)) * screen.width + x0 + (p % ref.width)) * screen.channels;
    const r = p * ref.channels;
    return sum + Math.abs(screen.data[s] - ref.data[r]) + Math.abs(screen.data[s + 1] - ref.data[r + 1]) +
      Math.abs(screen.data[s + 2] - ref.data[r + 2]);
  }, 0);
  return total / (ref.width * ref.height * 3);
};

const time = () => new Date().toLocaleTimeString();

const check = <T extends { value?: unknown }>(res: T) => {
  const value = res.value as { error?: string; message?: string } | null | undefined;
  if (value?.message?.includes("Not authorized")) {
    throw new Error("the phone stopped accepting taps, unlock it, keep the screen on and start again");
  }
  if (value?.error) throw new Error(value.message ?? value.error);
  return res;
};

export const runTapper = async (base: string, name: string, recipe: Recipe, { intervalMs, maxIdleMs }: Options) => {
  const buttons = recipe.buttons.map((b) => ({
    ...b,
    img: decode(Deno.readFileSync(new URL(`../recipes/${name}/${b.ref}`, import.meta.url))),
  }));

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

  const visible = async () => {
    const { value } = await fetch(`${base}/screenshot`).then((r) => r.json()).then(check);
    const screen = decode(Uint8Array.from(atob(value), (c) => c.charCodeAt(0)));
    if (screen.width !== recipe.screenWidth) {
      throw new Error(`this recipe only works on a ${recipe.screenWidth} pixel wide screen (iPhone 17 Pro)`);
    }
    return buttons.find((b) => diff(screen, b.img, b.x, b.y) < maxDiff);
  };

  const loop = async (count: number, last: string | undefined, idleSince: number): Promise<number> => {
    if (Date.now() - idleSince > maxIdleMs) return count;
    const button = await visible();
    const next = button?.counts ? count + 1 : count;
    if (!button && last) console.log(`${time()} nothing to press, waiting`);
    if (button) await post(`/session/${sessionId}/wda/tap`, recipe.tap);
    if (button) console.log(`${time()} ${button.name}${button.counts ? ` ${next}` : ""}`);
    await sleep(button ? intervalMs : 1000);
    return loop(next, button?.name, button ? Date.now() : idleSince);
  };

  console.log(`${recipe.description}\npress ctrl+c to stop`);
  const count = await loop(0, "start", Date.now());
  console.log(`nothing to press for ${maxIdleMs / 1000}s, stopped after ${count}`);
};
