import { decode, encode } from "fast-png";

export type Image = ReturnType<typeof decode>;
export type Point = { x: number; y: number };
export type Region = Point & { width: number; height: number };

export const fromPng = (png: Uint8Array) => decode(png);

export const loadImage = (url: URL) => decode(Deno.readFileSync(url));

export const crop = (img: Image, { x, y, width, height }: Region): Image => ({
  ...img,
  width,
  height,
  channels: 3,
  data: new Uint8Array(width * height * 3).map((_, k) => {
    const p = Math.floor(k / 3);
    return img.data[((y + Math.floor(p / width)) * img.width + x + (p % width)) * img.channels + (k % 3)];
  }),
});

export const scaleUp = (img: Image, k: number): Image => ({
  ...img,
  width: img.width * k,
  height: img.height * k,
  channels: 3,
  data: new Uint8Array(img.width * k * img.height * k * 3).map((_, i) => {
    const p = Math.floor(i / 3);
    const x = Math.floor((p % (img.width * k)) / k);
    const y = Math.floor(Math.floor(p / (img.width * k)) / k);
    return img.data[(y * img.width + x) * img.channels + (i % 3)];
  }),
});

export const brightText = (img: Image, min: number, spread: number): Image => ({
  ...img,
  channels: 1,
  data: new Uint8Array(img.width * img.height).map((_, p) => {
    const [r, g, b] = [0, 1, 2].map((c) => img.data[p * img.channels + c]);
    return Math.min(r, g, b) >= min && Math.max(r, g, b) - Math.min(r, g, b) <= spread ? 0 : 255;
  }),
});

export const difference = (screen: Image, ref: Image, x0: number, y0: number) => {
  const total = Array.from({ length: ref.width * ref.height }).reduce<number>((sum, _, p) => {
    const s = ((y0 + Math.floor(p / ref.width)) * screen.width + x0 + (p % ref.width)) * screen.channels;
    const r = p * ref.channels;
    return sum + Math.abs(screen.data[s] - ref.data[r]) + Math.abs(screen.data[s + 1] - ref.data[r + 1]) +
      Math.abs(screen.data[s + 2] - ref.data[r + 2]);
  }, 0);
  return total / (ref.width * ref.height * 3);
};

export const closest = (screen: Image, ref: Image, x0: number, y0: number, reach: number) => {
  const steps = Array.from({ length: reach * 2 + 1 }, (_, i) => i - reach);
  return Math.min(...steps.flatMap((dx) => steps.map((dy) => difference(screen, ref, x0 + dx, y0 + dy))));
};

export const toPng = (img: Image) =>
  encode({ width: img.width, height: img.height, data: img.data, channels: img.channels });
