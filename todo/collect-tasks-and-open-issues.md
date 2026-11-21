# Open issues

Updated 2026-11-21.

- Unnamed rewards left in assets/rewards: unknown-19, 28 and 29 are gear pieces from sets not seen by name yet (a grey hood, a grey gauntlet, a green steel helmet), unknown-20 is a light-blue star token. The Conquest idle income list shows gear names when an item is tapped, so collect-conquest could read them before it claims.
- common armor and uncommon armor in assets/rewards are made-up names. The real ones follow the gear sets (Warrior's, Ranger's, Scout's and so on).
- aena emblem in assets/backpack is probably a misread hero name.
- A single task that gets lost leaves the game on that screen, so the next single task fails with it. The rounds go back to the world map between tasks.
- recruit: the text reader reads the Heroes screen upside down. The task works around it by reading only the button strip.
- claim-freebies takes over three minutes to find nothing.
- claim-alliance printed "contributed 1 time, attempts left 0/25" on a second run, so the attempts count was probably misread.
- collect-daily ran clean but had nothing to claim, so its Claim All press is only verified by hand.
- collect-conquest: only the "no red dot" path ran after the rewrite, the claim itself did not. It also printed 132,000 hero xp for 1h19 of idle time at 10,000 per hour once, so the amount was probably read as 132K instead of 13.2K.
- collect-backpack used 100K Wood (Secured) and 1M Wood with only grey and green allowed (2026-11-21 21:47): a stray text put a row 32 points too high and the colour vote tied. Fixed with rows from the picture, a two of three colour vote and a check that the name agrees with the colour. Checked by replaying that screen and by a scan of the live backpack without tapping; a real run after the fix has not been done.
- collect-backpack left the 5,000 Hero XP item alone after selecting it: the text reader returned the X of XP as a look-alike letter, so the name did not match. The reader now corrects such letters for every task. Not run on the phone since.
- collect-backpack was rewritten to pick items by their pictures, to cover the Other tab and to use the plain chests and VIP XP items. It has not run on the phone at all since, not even with --dry-run. Do a dry run first and read `just decisions`. Not known: what using a chest or a VIP XP item looks like afterwards, and whether an item stays open after it was used (the task stops if it does).
- collect-backpack skipped the Trial Chest (22:27): the rewards popup of the chest before it was still open when it chose the next tile. It now waits for the backpack list to be back first. Not run since.
- collect-backpack re-opens Birthday Nameplate (30-Day) on every run: its saved picture does not match closely enough.
- collect-backpack skipped the green 1K Wood: its name was read as "TK Wood". Names are now corrected for that before they are checked.
- The step by step log (decisions.log) has only been tried with made-up lines, not during a run.
- collect-backpack: clearing the tab red dots was never checked.
- shop: no purchase ran after the rewrite, there was no free refresh left.
- terror-hunt, heal, calibrate, morning and run have not been run since the rewrite. Pets: ally treasure Claim All is untested. Terror: skipping the hero lookups is untested.
- Intel stopped with markers left and did not press Pan in one morning run. The next run saves build/intel-end.png and build/intel-pan.png.
- The daily reset is assumed to be 00:00 UTC (DAY_RESET_UTC_HOUR).
- Over Wi-Fi the helper takes minutes to start. Use the cable.
- collect-water only knows the Fountain of Life. The Purifier was not found on the island: the buildings to the right of the fountain turned out to be Court of ..., Small Coliseum, Whispering Path and Reservoir. Island buildings show Dismantle and Retrieve buttons when selected, so no more guessing taps there.
- collect-water: its own run found nothing to collect (the fountain had just been emptied by hand), so the tap on the water bubble is untested in the task.
- train-troops: its run found all three buildings training, so its Train press is untested in the task. Done by hand it collected the finished troops and started 1,517 of the top tier.
- mystic-trial ran Knowledge Nexus (31-7 to 32-5) and Molten Fort (five losses at 34-8). Coliseum, Forest of Life, Crystal Cave and Radiant Spire were not open, so their names and screens are untested. A lost fight costs an attempt, a won one seems not to.
- The town tasks and mystic-trial are not part of morning, run or collect-all yet.
