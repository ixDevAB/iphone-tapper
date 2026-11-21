import { decode, encode } from "fast-png";
import type { Image, Region } from "./image.ts";
import type { TextLine } from "./ocr.ts";
import type { Phone } from "./phone.ts";
import { points } from "./screen.ts";

export const line = (text: string, x = 0, y = 0): TextLine => ({
  text,
  x: x / points.width,
  y: y / points.height,
  width: 0,
  height: 0,
});

export const picture = (width: number, height: number, patches: { at: Region; rgb: number[] }[] = []): Image => {
  const data = new Uint8Array(width * height * 3);
  for (const { at, rgb } of patches) {
    for (const i of Array.from({ length: at.width * at.height }, (_, k) => k)) {
      data.set(rgb, ((at.y + Math.floor(i / at.width)) * width + at.x + (i % at.width)) * 3);
    }
  }
  return decode(encode({ width, height, data, channels: 3 }));
};

export const fakePhone = (screens: TextLine[][]) => {
  const taps: { x: number; y: number }[] = [];
  const shown = { index: 0 };
  const phone = {
    screenshot: () => Promise.resolve(picture(points.width * 3, 3)),
    snap: () => Promise.resolve(new Uint8Array()),
    ocrPng: () => Promise.resolve(screens[Math.min(shown.index++, screens.length - 1)]),
    tap: (point: { x: number; y: number }) => {
      taps.push(point);
      return Promise.resolve({});
    },
  };
  return { phone: phone as unknown as Phone, taps };
};
