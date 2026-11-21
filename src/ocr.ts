import { TextLineStream } from "@std/streams";
import { type Image, toPng } from "./image.ts";

const root = new URL("..", import.meta.url).pathname;
const bin = `${root}build/ocr`;

export type TextLine = { text: string; x: number; y: number; width: number; height: number };

const lookalikes: Record<string, string> = {
  "А": "A",
  "В": "B",
  "Е": "E",
  "К": "K",
  "М": "M",
  "Н": "H",
  "О": "O",
  "Р": "P",
  "С": "C",
  "Т": "T",
  "Х": "X",
  "а": "a",
  "е": "e",
  "о": "o",
  "р": "p",
  "с": "c",
  "х": "x",
};

export const latin = (text: string) => [...text].map((c) => lookalikes[c] ?? c).join("");

const mode = { accurate: true };
const probeImage = `${root}docs/images/heal.png`;

const build = async () => {
  const built = await Deno.stat(bin).then((s) => s.mtime?.getTime() ?? 0, () => 0);
  const source = (await Deno.stat(`${root}src/ocr.swift`)).mtime?.getTime() ?? 0;
  if (built > source) return;
  await Deno.mkdir(`${root}build`, { recursive: true });
  const { code } = await new Deno.Command("swiftc", { args: ["-O", `${root}src/ocr.swift`, "-o", bin] }).output();
  if (code !== 0) throw new Error("could not build the text reader, is xcode installed?");
};

const accurateAnswers = async (probeMs: number) => {
  const child = new Deno.Command(bin, { stdin: "piped", stdout: "piped", stderr: "null" }).spawn();
  const writer = child.stdin.getWriter();
  await writer.write(new TextEncoder().encode(`${probeImage}\n`));
  const reader = child.stdout.getReader();
  const timer = Promise.withResolvers<boolean>();
  const timeout = setTimeout(() => timer.resolve(false), probeMs);
  const answered = await Promise.race([reader.read().then((r) => !r.done), timer.promise]);
  clearTimeout(timeout);
  child.kill();
  await child.status.catch(() => undefined);
  return answered;
};

export const ensureOcr = async (env: Record<string, string> = {}) => {
  const setting = (name: string) => env[name] ?? Deno.env.get(name);
  mode.accurate = setting("OCR_ACCURATE") !== "0";
  await build();
  if (!mode.accurate || await accurateAnswers(Number(setting("OCR_ACCURATE_SECONDS") || 8) * 1000)) return;
  mode.accurate = false;
  console.log(
    "accurate text recognition is not answering on this mac right now, using fast recognition, so amounts and ally counts may not be readable",
  );
};

export const startOcr = () => {
  const child = new Deno.Command(bin, {
    stdin: "piped",
    stdout: "piped",
    env: mode.accurate ? {} : { OCR_ACCURATE: "0" },
  }).spawn();
  const writer = child.stdin.getWriter();
  const reader = child.stdout.pipeThrough(new TextDecoderStream()).pipeThrough(new TextLineStream()).getReader();

  const readPng = async (png: Uint8Array) => {
    const path = await Deno.makeTempFile({ suffix: ".png" });
    await Deno.writeFile(path, png);
    await writer.write(new TextEncoder().encode(`${path}\n`));
    const { value } = await reader.read();
    await Deno.remove(path);
    return (JSON.parse(value ?? "[]") as TextLine[]).map((l) => ({ ...l, text: latin(l.text) }));
  };

  const read = (img: Image) => readPng(toPng(img));

  return { read, readPng, stop: () => child.kill() };
};
