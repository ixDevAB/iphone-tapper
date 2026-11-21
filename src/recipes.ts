import { claimAll, collectAll } from "../recipes/all/recipe.ts";
import { claimAlliance } from "../recipes/alliance/recipe.ts";
import { backpackNames } from "../recipes/backpack/names.ts";
import { collectBackpack } from "../recipes/backpack/recipe.ts";
import { collectConquest } from "../recipes/conquest/recipe.ts";
import { collectDaily } from "../recipes/daily/recipe.ts";
import { claimFreebies } from "../recipes/freebies/recipe.ts";
import { calibrate } from "../recipes/heal/calibrate.ts";
import { heal } from "../recipes/heal/recipe.ts";
import { intel } from "../recipes/intel/recipe.ts";
import { claimMail } from "../recipes/mail/recipe.ts";
import { evening, morning } from "../recipes/morning/recipe.ts";
import { collectPet } from "../recipes/pets/recipe.ts";
import { recruit } from "../recipes/recruit/recipe.ts";
import { run } from "../recipes/run/recipe.ts";
import { shop } from "../recipes/shop/recipe.ts";
import { terrorHunt } from "../recipes/terror/recipe.ts";
import { collectOnline } from "../recipes/town/online.ts";
import { mysticTrial } from "../recipes/town/trials.ts";
import { trainTroops } from "../recipes/town/troops.ts";
import { collectWater } from "../recipes/town/water.ts";
import { claimVip } from "../recipes/vip/recipe.ts";
import type { Recipe } from "./recipe.ts";

export const recipes: Record<string, Recipe> = {
  heal,
  calibrate,
  intel,
  "collect-pet": collectPet,
  "terror-hunt": terrorHunt,
  "claim-mail": claimMail,
  "claim-alliance": claimAlliance,
  recruit,
  morning,
  evening,
  run,
  "collect-all": collectAll,
  "claim-all": claimAll,
  shop,
  "claim-freebies": claimFreebies,
  "claim-vip": claimVip,
  "collect-daily": collectDaily,
  "collect-conquest": collectConquest,
  "collect-backpack": collectBackpack,
  "backpack-names": backpackNames,
  "train-troops": trainTroops,
  "collect-water": collectWater,
  "collect-online": collectOnline,
  "mystic-trial": mysticTrial,
};
