import { loadTiles, nameUnknowns } from "./naming.ts";

const rewardsDir = new URL("../assets/rewards/", import.meta.url);
const backpackDir = new URL("../assets/backpack/", import.meta.url);

const named = await nameUnknowns(rewardsDir, loadTiles(backpackDir));
named.forEach((n) => console.log(`${n.from} is ${n.to}`));
const left = [...Deno.readDirSync(rewardsDir)].filter((e) => /^unknown-\d+\.png$/.test(e.name)).length;
console.log(`${named.length} named, ${left} still unknown`);
