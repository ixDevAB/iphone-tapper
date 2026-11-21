import type { Image, Region } from "./image.ts";

type Test = (r: number, g: number, b: number) => boolean;

export const hsv = (r: number, g: number, b: number) => {
  const max = Math.max(r, g, b);
  const d = max - Math.min(r, g, b);
  const h = d === 0 ? 0 : max === r ? ((g - b) / d + 6) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, max ? (d / max) * 100 : 0, max / 2.55];
};

export const rgbAt = (img: Image, x: number, y: number) => {
  const p = (y * img.width + x) * img.channels;
  return [img.data[p], img.data[p + 1], img.data[p + 2]];
};

export const hits = (img: Image, r: Region, test: Test, step = 1): number[] => {
  const columns = Math.floor(r.width / step);
  const rows = Math.floor(r.height / step);
  return Array.from({ length: columns * rows }, (_, i) => {
    const [red, green, blue] = rgbAt(img, r.x + (i % columns) * step, r.y + Math.floor(i / columns) * step);
    return test(red, green, blue) ? 1 : 0;
  });
};

export const count = (img: Image, r: Region, test: Test, step = 1) =>
  hits(img, r, test, step).reduce((sum, n) => sum + n, 0);

export const share = (img: Image, r: Region, test: Test, step = 1) => {
  const all = hits(img, r, test, step);
  return all.reduce((sum, n) => sum + n, 0) / all.length;
};

const beside = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const around = [...beside, [1, 1], [-1, -1], [1, -1], [-1, 1]];

export const regions = (labels: ArrayLike<number>, width: number, diagonal = false) => {
  const height = Math.floor(labels.length / width);
  const seen = new Uint8Array(labels.length);

  const fill = (start: number) => {
    const stack = [start];
    const cells: number[] = [];
    seen[start] = 1;
    while (stack.length) {
      const i = stack.pop() as number;
      cells.push(i);
      const cx = i % width;
      const cy = Math.floor(i / width);
      for (const [dx, dy] of diagonal ? around : beside) {
        const nx = cx + dx;
        const ny = cy + dy;
        const n = ny * width + nx;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height || seen[n] || labels[n] !== labels[start]) continue;
        seen[n] = 1;
        stack.push(n);
      }
    }
    return cells;
  };

  return Array.from({ length: labels.length }, (_, i) => i).flatMap((i) => labels[i] && !seen[i] ? [fill(i)] : []);
};

export const bounds = (cells: number[], width: number) =>
  cells.reduce(
    (box, i) => ({
      left: Math.min(box.left, i % width),
      right: Math.max(box.right, i % width),
      top: Math.min(box.top, Math.floor(i / width)),
      bottom: Math.max(box.bottom, Math.floor(i / width)),
    }),
    { left: Infinity, right: -Infinity, top: Infinity, bottom: -Infinity },
  );
