import { difference, type Image, loadImage, type Region } from "../../src/image.ts";
import { share } from "../../src/pixels.ts";
import { scale } from "../../src/screen.ts";

const columns = [72, 201, 329];
const rows = [{ icon: 347, price: 420 }, { icon: 508, price: 581 }];
const vip = loadImage(new URL("../../assets/shop/vip.png", import.meta.url));
const vipRegion = { dx: -60, dy: -48, width: 120, height: 63 };
const shifts = [-6, -3, 0, 3, 6];

const isBlue = (r: number, _g: number, b: number) => b > 190 && r < 110 && b - r > 110;
const isCream = (r: number, g: number, b: number) => r > 215 && g > 200 && b > 170;

export const blueShare = (img: Image, r: Region) => share(img, r, isBlue, 3);

export const slotsIn = (img: Image) =>
  rows.flatMap((row) =>
    columns.map((x) => {
      const pill = { x: x * scale - 150, y: row.price * scale - 45, width: 300, height: 90 };
      const at = { x: x * scale + vipRegion.dx, y: row.icon * scale + vipRegion.dy };
      const isVip = Math.min(...shifts.flatMap((dx) =>
        shifts.map((dy) => difference(img, vip, at.x + dx, at.y + dy))
      )) < 18;
      return {
        x,
        y: row.price,
        present: share(img, pill, isCream, 3) > 0.25,
        diamonds: blueShare(img, pill) > 0.015,
        vip: isVip,
      };
    })
  );
