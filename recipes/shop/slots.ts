import { difference, type Image, loadImage } from "../../src/image.ts";

const columns = [72, 201, 329];
const rows = [{ icon: 347, price: 420 }, { icon: 508, price: 581 }];
const vip = loadImage(new URL("../../assets/shop/vip.png", import.meta.url));
const vipRegion = { dx: -60, dy: -48, width: 120, height: 63 };

const share = (img: Image, x0: number, y0: number, width: number, height: number, test: (r: number, g: number, b: number) => boolean) => {
  const hits = Array.from({ length: Math.floor(width / 3) * Math.floor(height / 3) }, (_, i) => {
    const p = ((y0 + Math.floor(i / Math.floor(width / 3)) * 3) * img.width + x0 + (i % Math.floor(width / 3)) * 3) * img.channels;
    return test(img.data[p], img.data[p + 1], img.data[p + 2]) ? 1 : 0;
  });
  return hits.reduce((sum: number, n) => sum + n, 0) / hits.length;
};

export const blueShare = (img: Image, x0: number, y0: number, width: number, height: number) => share(img, x0, y0, width, height, (r, _g, b) => b > 190 && r < 110 && b - r > 110);

export const slotsIn = (img: Image) =>
  rows.flatMap((row) =>
    columns.map((x) => {
      const pill = { x: x * 3 - 150, y: row.price * 3 - 45, width: 300, height: 90 };
      const blue = blueShare(img, pill.x, pill.y, pill.width, pill.height);
      const cream = share(img, pill.x, pill.y, pill.width, pill.height, (r, g, b) => r > 215 && g > 200 && b > 170);
      const isVip = Math.min(...[-6, -3, 0, 3, 6].flatMap((dx) => [-6, -3, 0, 3, 6].map((dy) => difference(img, vip, x * 3 + vipRegion.dx + dx, row.icon * 3 + vipRegion.dy + dy)))) < 18;
      return { x, y: row.price, present: cream > 0.25, diamonds: blue > 0.015, vip: isVip };
    })
  );
