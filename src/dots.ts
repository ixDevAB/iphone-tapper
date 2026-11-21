import type { Image, Region } from "./image.ts";
import { count } from "./pixels.ts";

export const isRed = (r: number, g: number, b: number) => r > 200 && g < 80 && b < 80;

export const redIn = (img: Image, r: Region) => count(img, r, isRed);

export const hasRedDot = (img: Image, r: Region, least = 40) => redIn(img, r) > least;
