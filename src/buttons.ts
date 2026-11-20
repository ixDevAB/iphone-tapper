import type { Image } from "./image.ts";

const step = 6;

const isGreen = (img: Image, x: number, y: number) => {
  const p = (y * img.width + x) * img.channels;
  const [r, g, b] = [img.data[p], img.data[p + 1], img.data[p + 2]];
  return g > 150 && g - r > 60 && g - b > 60;
};

export const greenButtons = (img: Image, top: number) => {
  const columns = Math.floor(img.width / step);
  const rowsCount = Math.floor((img.height - top) / step);
  const lit = Uint8Array.from({ length: columns * rowsCount }, (_, i) => isGreen(img, (i % columns) * step, top + Math.floor(i / columns) * step) ? 1 : 0);
  const seen = new Uint8Array(lit.length);

  const fill = (start: number) => {
    const stack = [start];
    const box = { left: columns, right: 0, top: rowsCount, bottom: 0, cells: 0 };
    seen[start] = 1;
    while (stack.length) {
      const i = stack.pop() as number;
      const cx = i % columns;
      const cy = Math.floor(i / columns);
      box.left = Math.min(box.left, cx);
      box.right = Math.max(box.right, cx);
      box.top = Math.min(box.top, cy);
      box.bottom = Math.max(box.bottom, cy);
      box.cells += 1;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = cx + dx;
        const ny = cy + dy;
        const n = ny * columns + nx;
        if (nx < 0 || ny < 0 || nx >= columns || ny >= rowsCount || seen[n] || !lit[n]) continue;
        seen[n] = 1;
        stack.push(n);
      }
    }
    return box;
  };

  return Array.from(lit.keys())
    .flatMap((i) => lit[i] && !seen[i] ? [fill(i)] : [])
    .map((b) => ({ width: (b.right - b.left + 1) * step, height: (b.bottom - b.top + 1) * step, x: Math.round((b.left + b.right + 1) * step / 2 / 3), y: Math.round((top + (b.top + b.bottom + 1) * step / 2) / 3) }))
    .filter((b) => b.width > 300 && b.height > 90 && b.height < 260);
};
