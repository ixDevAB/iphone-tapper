import type { Image } from "./image.ts";
import { bounds, hits, regions } from "./pixels.ts";
import { scale } from "./screen.ts";

const step = 6;

const isGreen = (r: number, g: number, b: number) => g > 150 && g - r > 60 && g - b > 60;

export const greenButtons = (img: Image, top: number) => {
  const columns = Math.floor(img.width / step);
  const lit = hits(img, { x: 0, y: top, width: img.width, height: img.height - top }, isGreen, step);

  return regions(lit, columns)
    .map((cells) => bounds(cells, columns))
    .map((b) => ({
      width: (b.right - b.left + 1) * step,
      height: (b.bottom - b.top + 1) * step,
      x: Math.round((b.left + b.right + 1) * step / 2 / scale),
      y: Math.round((top + (b.top + b.bottom + 1) * step / 2) / scale),
    }))
    .filter((b) => b.width > 300 && b.height > 90 && b.height < 260);
};
