import { TextLineStream } from "@std/streams";
import { type Image, toPng } from "./image.ts";

const root = new URL("..", import.meta.url).pathname;
const bin = `${root}build/ocr`;

export type TextLine = { text: string; x: number; y: number; width: number; height: number };

export const ensureOcr = async () => {
  const built = await Deno.stat(bin).then((s) => s.mtime?.getTime() ?? 0, () => 0);
  const source = (await Deno.stat(`${root}src/ocr.swift`)).mtime?.getTime() ?? 0;
  if (built > source) return;
  await Deno.mkdir(`${root}build`, { recursive: true });
  const { code } = await new Deno.Command("swiftc", { args: ["-O", `${root}src/ocr.swift`, "-o", bin] }).output();
  if (code !== 0) throw new Error("could not build the text reader, is xcode installed?");
};

export const startOcr = () => {
  const child = new Deno.Command(bin, { stdin: "piped", stdout: "piped" }).spawn();
  const writer = child.stdin.getWriter();
  const reader = child.stdout.pipeThrough(new TextDecoderStream()).pipeThrough(new TextLineStream()).getReader();

  const read = async (img: Image) => {
    const path = await Deno.makeTempFile({ suffix: ".png" });
    await Deno.writeFile(path, toPng(img));
    await writer.write(new TextEncoder().encode(`${path}\n`));
    const { value } = await reader.read();
    await Deno.remove(path);
    return JSON.parse(value ?? "[]") as TextLine[];
  };

  return { read, stop: () => child.kill() };
};
