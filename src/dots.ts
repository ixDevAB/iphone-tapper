import type { Image } from "./image.ts";

export type Box = { x: number; y: number; width: number; height: number };

export const redIn = (img: Image, r: Box) =>
  Array.from({ length: r.width * r.height }, (_, i) => {
    const p = ((r.y + Math.floor(i / r.width)) * img.width + r.x + (i % r.width)) * img.channels;
    return img.data[p] > 200 && img.data[p + 1] < 80 && img.data[p + 2] < 80 ? 1 : 0;
  }).reduce((sum: number, n) => sum + n, 0);

export const hasRedDot = (img: Image, r: Box) => redIn(img, r) > 40;
