# iPhone Tapper

Presses buttons in iPhone games for you, controlled from your Mac. It comes with ready-made **recipes**, for example healing all your troops in Kingshot.

It looks at the phone screen before every tap and only presses the buttons the recipe allows. Everything else, like Speed Up or buttons that cost gems, is never touched.

## Recipes

### Heal troops

```sh
just heal
```

Start the recipe on the world map or with the **Heal Injured** window open. If the window is not open, it presses the green injured button (the plus with a percentage) to open it. It presses **Heal**, then **Help**, then **Heal** again, until all your troops are healed.

| It presses **Heal**                                                                         | Then **Help**                                                                                              |
| ------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| <img src="docs/images/heal.png" width="280" alt="Heal Injured window with the Heal button"> | <img src="docs/images/help.png" width="280" alt="Heal Injured window while healing, with the Help button"> |

If the button shows **Speed Up** or anything else, it waits until **Heal** comes back.

**It heals more when more allies help.** It starts with 60 Infantry per round, or more if you tell it how many allies are online:

```sh
just heal --allies 5
```

On the first round and every 10th round after that it reads the "5 Allies have helped you" message and sizes the batch to that. If it could not read that message for a while and 10 heals in a row finish within 3 seconds of Help, it tries one ally more. Slower heals mean the allies are at their limit, so it stops growing. It reads the tier badge (XI or X) on the top troop and uses the right amount per ally: 60 for XI and 140 for X. How much one ally heals is different for every player, so change `TROOPS_PER_ALLY_XI` and `TROOPS_PER_ALLY_X` in the [settings](#settings) to match yours.

On those same rounds it prints how many injured troops are left and roughly how long that will take at the current pace.

**It cancels heals the allies cannot finish.** It remembers how many allies each heal was sized for. If fewer help and the heal has not finished 10 seconds after Help, it presses **Cancel healing** and **Confirm** (all resources are refunded) and starts over with a smaller batch.

It only heals Infantry: when it changes the batch it also sets the Archers and Cavalry boxes to 0. After typing a new amount it reads the box back, and if the box shows something else it carries on with what the box shows. After a cancel it keeps the smaller batch for 5 minutes before growing again.

**It stops when allies stop helping.** At the smallest batch it waits up to 4 minutes for the heal timer, then stops by itself.

### Measure troops per ally

Use this to find your own `TROOPS_PER_ALLY_XI` and `TROOPS_PER_ALLY_X` instead of guessing them.

1. Open the **Heal Injured** window when allies are online. The tier you want to measure must be one of the three troops at the top.
2. Start it:
   ```sh
   just calibrate
   ```
3. It heals 10 Infantry, then 20, then 30, and so on, pressing **Help** each time and reading how many allies helped:
   ```
   14:36:32 300 troops finished with 6 assists (50.0 per assist), one assist heals at least 50.0 and no upper limit yet
   14:36:47 310 troops finished with 5 assists (62.0 per assist), one assist heals at least 62.0 and no upper limit yet
   14:37:02 320 troops did not finish, cancelled with 4 assists (80.0 per assist), one assist heals at least 62.0 and less than 80.0
   ```
4. A heal only counts when the assists finish it within 3 seconds of Help (`FAST_FINISH_SECONDS`), the same rule the heal recipe uses. A heal that is still running after that is cancelled (all resources are refunded). A heal that finishes in time but only because the last few seconds ran out on its timer does not count either. From then on it picks amounts between "at least" and "less than" and keeps going until the two are less than one troop apart. If the very first heal does not finish, it goes back to your current setting times the number of assists, and from there down in steps until one finishes.
5. Then it confirms the result: it heals that many troops per assist until 5 heals have finished with exactly the expected number of assists. If one of them does not finish, it lowers the value by 1 and starts the 5 over.
6. It stops and prints the result, for example `TROOPS_PER_ALLY_XI=62`. The rounds may have been lucky, so it suggests one less (`61`) as the safer choice, and that is the value `--save` writes.
7. Run it again with `--tier X` for the next tier.

It starts small on purpose. To get to the limit faster, start higher, and use a smaller step for a more exact result:

```sh
just calibrate --start 300 --increment 5
```

It measures tier XI unless you name another tier. It finds the first troop with that badge among the three at the top of the window, so you can measure X while XI troops are still injured:

```sh
just calibrate --tier X --start 100
```

A reading that contradicts what already failed is thrown away: if 66 per assist failed, a later heal that seems to finish at 78 per assist means the assist count was read wrong.

It remembers the best amount so far and the lowest amount that failed for each tier in `build/calibrate.json`, so you can stop it with Ctrl + C and the next run continues where it was. Add `--fresh` to forget that and start over.

The short forms `-t`, `-s`, `-i` and `-a` work for `--tier`, `--start`, `--increment` and `--allies`. An argument it does not know stops it before anything is pressed.

Add `--save` to write the safer value (the result minus one) to `.env`, so the heal recipe uses it from the next start:

```sh
just calibrate --start 300 --save
```

It only presses **Heal** when the amount box shows the amount it typed. If the Heal button is not showing at the start, it waits up to 30 seconds for it.

### Intel missions

```sh
just intel
```

Open the world map (or the Intel Mission screen) and start it. For every marker it presses **View** and then does what the mission needs:

| Marker | What it presses                                               |
| ------ | ------------------------------------------------------------- |
| Tent   | **Rescue**                                                    |
| Animal | **Attack**, then **Deploy** with the troops the game suggests |
| Fight  | **Conquer**, then **Fight** with the squad already set        |

It does not wait for marches: it sends one and takes the next marker right away. When no marker is left it waits a moment for the marches, presses **Claim All**, and carries on with any new markers that show up. It also collects before it stops for lack of stamina.

Animals need a free march. When the march list on the world map shows all marches in use (for example 6/6), it waits up to a minute for one to come back, and skips that animal if none does. Tents and fights do not need a march.

```sh
just intel --pan
just intel --storehouse --embrace --stamina 50
```

- `--pan` presses the Pan skill once at the start, if it is available.
- Without more arguments it stops when the stamina is below 12.
- `--storehouse` lets it claim the Gourmet Feast (150 stamina) when it runs out.
- `--embrace` lets it claim the Comforting Embrace (50 stamina).
- `--stamina 50` lets it gain up to 50 stamina from meat, 10 at a time.

It never presses **Buy & Use** or anything else that costs gems.

When it stops it prints what it did and what it collected:

```
intel done: 3 blue animal, 2 gold fight, 1 purple tent
rewards:
  15,000 hero xp
  3 epic conquest skill book
  2 shards of edwin
  250 unknown-02
```

It recognises rewards by their picture. The pictures are in `assets/rewards` and the file name is the name it prints. A reward it has not seen before is saved there as `unknown-28.png` and so on: rename the file to name it.

```sh
open assets/rewards
```

### Collect from the pets

```sh
just collect-pet
```

Start it on the world map. It opens the pet skills and uses **Scent Mastery** and **Gift of the King** when they are ready, or tells you how long their cooldown still is. Then it goes to **Beast Cage** and **Adventure**, where it:

- presses **Claim All** when adventures have finished
- presses **Hunt All** to send the pets out again (each hunt costs 10 stamina, so it stops hunting when the game says there is not enough)
- opens **Ally Treasure** when it has a red bubble, presses every **Share**, and presses **Claim** under Alliance Shares while claims are left for today

It prints everything it collected at the end, the same way as the intel task.

### Terror rallies

```sh
just terror-hunt 3
```

Start it on the world map. For each rally it opens the search, picks **Terror** at level 8, presses **Search**, **Rally**, **Hold a rally** (with the rally time the game has selected) and **Deploy**. The number is how many rallies to hold; without it, it holds one.

```sh
just terror-hunt 3 --level 7
just terror-hunt 2 --cav fahd --arch diana
just terror-hunt 5 --storehouse --stamina 50
```

- `--level 7` hunts another level.
- `--arch`, `--inf` and `--cav` put a hero in the rally by name. It opens **Select Heroes**, finds the hero by its picture and presses **Change**. The pictures are in `assets/heroes`, named after the hero. A hero it has no picture of yet is looked up once through **View** and saved there. With heroes named, it waits for the rally to come back before it starts the next one, because the heroes have to be home again.
- Without heroes it starts the next rally right away, as long as a march is free.
- A rally costs 25 stamina. `--storehouse`, `--embrace` and `--stamina 50` refill it the same way as for the intel task; without them it stops when the stamina runs out.

### Claim the mail

```sh
just claim-mail
```

Start it on the world map. It opens the mail, goes through the five tabs (Wars, Alliance, System, Reports, Starred) and presses **Read & Claim All** on each. It never presses **Delete Read**. At the end it prints what it claimed.

### Claim from the alliance

```sh
just claim-alliance
```

Start it on the world map. It opens **Alliance**, then:

- **Chests**: opens the big chest at the top when it has a red dot, then presses **Claim All** on the Alliance Gift tab and on the Loot Chest tab
- **Tech**: opens **Covenant-Making** and presses the bread **Contribute** button until the attempts are down to 0

It never presses the gem Contribute button or **Go**. At the end it prints what it claimed.

### Free hero recruits

```sh
just recruit
```

Start it on the world map. It opens **Heroes** and **Recruit Heroes** and presses every green **Free** recruit button. It never presses the yellow buttons that cost keys. When nothing is free it tells you how long until the next one.

### Morning round

```sh
just morning --pan --gourmet --embrace
```

Start it on the world map. It runs twelve tasks one after the other and returns to the world map between them:

1. the intel missions (`--pan`, `--gourmet`, `--embrace` and `--stamina 50` work as for the intel task; `--gourmet` is the same as `--storehouse`)
2. two Terror rallies with Diana as archer and Fahd as cavalry (change with a number, `--arch`, `--cav`, `--inf` and `--level`)
3. all the mail
4. the alliance chests and contributions
5. the Nomadic Merchant, including the VIP XP item for gems
6. the free hero recruits
7. the pet skills, pet adventures and ally treasure
8. the free items in the store
9. the VIP claims
10. the Conquest idle income (only with a red dot, or with `--force`)
11. the Backpack (gems, hero XP, grey and green resources, or the colours from `--rss`)
12. the daily missions, last so it also claims what the other steps completed

If one task stops early, the round carries on with the next one.

### Nomadic Merchant

```sh
just shop
just shop --buy-vip
```

Start it on the world map. It opens **Shop** and buys every Nomadic Merchant item that costs resources (bread, wood, stone, iron). When only gem items are left it presses **Free Refresh** and starts over, until there is no free refresh left.

It never buys with gems, with one exception: with `--buy-vip` it also buys the VIP XP item (the yellow V). A gem purchase opens a **Buy** window, and it only confirms when that window says VIP XP.

### Free items in the store

```sh
just claim-freebies
```

Start it on the world map. It opens the store (the shopping cart), opens every tab that has a red dot, and scrolls down through it looking for things marked **Free**, **Claimable** or **Claim**. It claims those. It never presses a button with a price on it, and it skips a label that sits next to a price.

### VIP claims

```sh
just claim-vip
```

Start it on the world map. It opens the VIP screen and claims the **daily free bundle** and the **daily sign-in chest**, then uses the VIP XP items you own. It never presses **Buy & Use**.

### Daily missions

```sh
just collect-daily
```

Start it on the world map. It opens the daily missions (the scroll icon), goes to the **Daily** tab and presses **Claim All** until nothing is left.

### Conquest idle income

```sh
just collect-conquest
just collect-conquest --force
```

Start it on the world map. When the **Conquest** button has a red dot, it opens Conquest and claims the idle income. Without the dot it does nothing, unless you add `--force`.

### Backpack

```sh
just collect-backpack
just collect-backpack --rss grey,green,blue
```

Start it on the world map. It opens the **Backpack** and uses, a whole stack at a time:

- all gems
- all hero XP
- the grey and green resource items (bread, wood, stone, iron, also the secured ones)

`--rss` picks which resource colours to use: `grey`, `green`, `blue`, `purple`. It confirms the alert about the city protection limit. It never uses chests or anything else. At the end it opens every tab once to clear the red dots.

### Collect all and claim all

```sh
just collect-all
just claim-all
```

`collect-all` runs the pets, Conquest, the Backpack and the daily missions, one after the other. `claim-all` runs the mail, the alliance, the store freebies and VIP. Both start on the world map, and the arguments of the single tasks still work, for example `just collect-all --force --rss grey,green,blue`.

### Keep running all day

```sh
just run --pan --gourmet --embrace
```

Start it on the world map and leave it. It starts every task once, in the same order as the morning round, and then starts each one again when it is due. In between it sleeps and tells you until when.

| Task                                         | Runs again                          |
| -------------------------------------------- | ----------------------------------- |
| recruit                                      | when the next free recruit is ready |
| shop                                         | when the merchant refreshes         |
| claim-mail, claim-alliance                   | every 2 hours                       |
| intel                                        | every 3 hours                       |
| collect-pet, collect-conquest, collect-daily | every 4 hours                       |
| collect-backpack                             | every 12 hours                      |
| claim-freebies, claim-vip, terror-hunt       | once a day                          |

```sh
just run --only recruit,shop
just run --skip terror-hunt,intel
```

`--only` runs just the tasks you list, `--skip` leaves some out. The other arguments work as for the morning round. Keep the phone unlocked on the game, on the cable, and keep the Mac awake. If a task finds another screen, it stops and gets its next turn later.

### What ran and when

```sh
just runs
just runs 100
```

Every run is saved in `runs.db`. The once a day tasks (terror-hunt, claim-freebies, claim-vip) are skipped by the rounds when they already went well since the daily reset (00:00 UTC, change with `DAY_RESET_UTC_HOUR`), and `just run` picks up its schedule where it left off. Add `--again` to run everything anyway. A task you start by itself always runs.

### Without just

`just <recipe>` is short for `deno task start <recipe>`. If you do not have [just](https://just.systems) (it comes with `nix develop`), this does the same:

```sh
deno task start heal --allies 5
```

### Working on the code

```sh
just fmt
just check
just test
```

## What you need

- A Mac with Apple Silicon (M1 or newer)
- An iPhone and a USB cable
- An **Apple ID**. A free one works. A paid Apple Developer account is optional (see [Free or paid Apple account](#free-or-paid-apple-account)).
- **Nix**. The project's flake gives you all the tools it needs.

**Not using Nix?** Install [Deno](https://deno.com) instead with `curl --fail --silent --show-error --location https://deno.land/install.sh | sh`, install Xcode from the App Store, and skip every `nix develop` below.

## First time setup

Do this once.

1. **Get the project**
   ```sh
   nix run nixpkgs#git -- clone https://github.com/ixDevAB/iphone-tapper.git
   cd iphone-tapper
   nix develop
   ```
   `nix develop` gives you all the tools for this project. Run it every time you open a new Terminal.

2. **Install Xcode**
   Sign in to the App Store app on your Mac first, then:
   ```sh
   mas install 497799835
   ```
   This takes a while. Open Xcode once when it is done and accept the license.

3. **Sign in to Xcode**
   In Xcode, go to Xcode > Settings > Accounts, press **+** and sign in with your Apple ID.
   Select your account, press **Manage Certificates**, press **+** and choose **Apple Development**.

4. **Connect the phone**
   Plug the iPhone into the Mac, unlock it and tap **Trust** if it asks.
   In Xcode, go to Window > Devices and Simulators, and wait until the phone shows up.

5. **Turn on Developer Mode on the iPhone**
   See [Developer Mode on the iPhone](#developer-mode-on-the-iphone) below. When it is on, Xcode shows the phone without warnings.

6. **Start a recipe**
   ```sh
   just heal
   ```
   The first start installs a helper app on your phone. This takes a few minutes. After that, starting is quick.

7. **Free Apple ID only:** the phone will say **Untrusted Developer**. Go to Settings > General > VPN & Device Management, tap your Apple ID and **Trust**. Then start the recipe again.

## Developer Mode on the iPhone

Developer Mode lets your Mac install the helper app on the phone. You only turn it on once.

1. **Connect the phone to the Mac first** (step 4 above), with Xcode open. The Developer Mode switch does not show up on the phone until it has been connected to a Mac with Xcode.
2. On the iPhone, open **Settings > Privacy & Security**.
3. Scroll all the way down to **Developer Mode** and tap it.
4. Turn the switch **on** and tap **Restart**.
5. After the restart, unlock the phone. A message asks if you want to turn on Developer Mode: tap **Turn On** and enter your passcode.

**Don't see Developer Mode?** Unplug the phone, plug it in again with Xcode open, wait a minute, and look again. You can also check that the phone is on a recent iOS version (Settings > General > Software Update).

**To turn it off later:** Settings > Privacy & Security > Developer Mode > off. The recipes stop working until you turn it on again.

## Every time you use it

1. Plug in the iPhone and unlock it.
2. Open the game on the right screen, for Kingshot the **Heal Injured** window.
3. In Terminal:
   ```sh
   cd iphone-tapper
   nix develop
   just heal
   ```
4. Leave the phone alone. You will see "Automation Running" on the phone, that is normal.
5. Press **Ctrl + C** in Terminal to stop. It also stops by itself when there has been nothing to press for 10 minutes.

**Tip:** set Settings > Display & Brightness > Auto-Lock to **Never** while it runs. When the phone locks, it stops accepting taps.

## Free or paid Apple account

|                           | Free Apple ID                   | Paid Apple Developer ($99/year) |
| ------------------------- | ------------------------------- | ------------------------------- |
| Works                     | Yes                             | Yes                             |
| Helper app lasts          | 7 days, then run `just rebuild` | 1 year                          |
| Trust prompt on the phone | Once                            | No                              |

## Settings

Most people do not need to change anything. To change a setting, create a settings file once:

```sh
cp .env.example .env
open -e .env
```

Change a value, save, and start again.

| Setting                      | What it does                                                                                                | Default                |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------- | ---------------------- |
| `TEAM_ID`                    | Which Apple developer team signs the helper app                                                             | Found automatically    |
| `BUNDLE_ID`                  | Name of the helper app on the phone                                                                         | Made from your team    |
| `INTERVAL_MS`                | Pause after each tap, in milliseconds                                                                       | `0`                    |
| `MAX_IDLE_SECONDS`           | Stop when there has been nothing to press this long                                                         | `600`                  |
| `CLOCK`                      | Time format in the output: `24h` (14:52:08) or `12h` (2:52:08 PM)                                           | `24h`                  |
| `TROOPS_PER_ALLY_XI`         | Heal: how many tier XI troops one helping ally heals                                                        | `60`                   |
| `TROOPS_PER_ALLY_X`          | Heal: how many tier X troops one helping ally heals                                                         | `140`                  |
| `TROOPS_PER_ALLY`            | Heal: troops per ally for any other tier                                                                    | `60`                   |
| `CALIBRATE_START`            | Heal: how many troops the first measuring heal uses (same as `--start`)                                     | `10`                   |
| `CALIBRATE_STEP`             | Heal: how many troops each measuring heal adds (same as `--increment`)                                      | `10`                   |
| `CALIBRATE_TIER`             | Heal: which tier to measure, `XI` or `X` (same as `--tier`)                                                 | `XI`                   |
| `CALIBRATE_MAX`              | Heal: stop measuring at this many troops                                                                    | `2000`                 |
| `CALIBRATE_MAX_ROUNDS`       | Heal: give up measuring, and give up confirming, after this many heals                                      | `40`                   |
| `CALIBRATE_SETTLE_SECONDS`   | Heal: keep reading the assist message this long after a heal finished                                       | `2`                    |
| `CALIBRATE_LEFT_SECONDS`     | Heal: a heal with this many seconds or fewer left on its timer after the assists does not count as finished | `15`                   |
| `CALIBRATE_CONFIRM`          | Heal: how many finished heals confirm the result                                                            | `5`                    |
| `HELP_DELAY_MS`              | Heal: pause between pressing Heal and pressing Help, in milliseconds                                        | `100`                  |
| `ALLY_TIMEOUT_SECONDS`       | Heal: at the smallest batch, stop when a heal has not finished this long after Help                         | `240`                  |
| `CANCEL_AFTER_SECONDS`       | Heal: cancel a bigger heal that has not finished this long after Help                                       | `10`                   |
| `START_ALLIES`               | Heal: how many allies to size the first batch for (same as `--allies`)                                      | `1`                    |
| `GROW_AFTER_ROUNDS`          | Heal: try one ally more after this many heals in a row finished                                             | `10`                   |
| `CHECK_ALLIES_EVERY`         | Heal: read how many allies helped on the first round and then every N rounds                                | `10`                   |
| `FAST_FINISH_SECONDS`        | Heal: a heal only counts toward growing if it finished this fast after Help                                 | `3`                    |
| `MAX_ALLIES`                 | Heal: never size a batch for more allies than this                                                          | `20`                   |
| `HOLD_AFTER_CANCEL_SECONDS`  | Heal: after a cancel, do not grow the batch again for this long                                             | `300`                  |
| `INTEL_STAMINA`              | Intel: how much stamina it may gain from meat (same as `--stamina`)                                         | `0`                    |
| `INTEL_STAMINA_NEEDED`       | Intel: refill or stop when the stamina is below this                                                        | `12`                   |
| `INTEL_MARCH_WAIT_SECONDS`   | Intel: how long to wait for a free march before skipping an animal                                          | `60`                   |
| `INTEL_COLLECT_WAIT_SECONDS` | Intel: how long to wait for marches before collecting the rewards                                           | `30`                   |
| `HUNT_LEVEL`                 | Terror: which level to search for (same as `--level`)                                                       | `8`                    |
| `HUNT_RETURN_MINUTES`        | Terror: how long to wait at most for a rally to come back                                                   | `20`                   |
| `SHOP_MAX_BUYS`              | Shop: stop after this many purchases in one run                                                             | `200`                  |
| `BACKPACK_RSS`               | Backpack: which resource colours to use (same as `--rss`)                                                   | `grey,green`           |
| `BACKPACK_MAX_USES`          | Backpack: stop after using this many stacks                                                                 | `60`                   |
| `DEVICE_UDID`                | Pick a specific iPhone if several are connected                                                             | First connected iPhone |

The recipes are made on an iPhone 17 Pro. On other models the buttons sit elsewhere and the recipe tells you it does not fit.

## When something goes wrong

| What you see                                 | What to do                                                                                                                                                    |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `command not found: deno`                    | Run `nix develop` first.                                                                                                                                      |
| `no iphone found`                            | Plug in the cable, unlock the phone, try again.                                                                                                               |
| `is not reachable`                           | Unlock the phone and keep it unlocked while starting.                                                                                                         |
| `no apple development certificate found`     | Do step 3 of the first time setup.                                                                                                                            |
| `several developer teams found`              | Create the settings file and copy one of the `TEAM_ID=` lines it shows into it.                                                                               |
| `the phone stopped accepting taps`           | The phone locked. Unlock it, set Auto-Lock to Never and start again.                                                                                          |
| `lost the connection to the phone`           | The cable came loose or the phone locked. Plug it in, unlock it and start again.                                                                              |
| `xcodebuild failed, see build.log`           | Check that you are signed in to Xcode and that the phone is unlocked.                                                                                         |
| Starting takes minutes                       | The phone is connected over Wi-Fi. Plug in the cable.                                                                                                         |
| `webdriveragent did not start`               | Unlock the phone, run `just rebuild`.                                                                                                                         |
| `accurate text recognition is not answering` | The Mac cannot read small text right now. Healing still works, but it cannot check the amount box or count allies well. Restarting the Mac may bring it back. |
| The phone says **Untrusted Developer**       | Settings > General > VPN & Device Management, tap your Apple ID and **Trust**.                                                                                |
| It worked last week but not today            | Run `just rebuild` to reinstall the helper app.                                                                                                               |

**Tip for direnv users:** run `direnv allow` once and the tools load by themselves when you enter the folder, so you can skip `nix develop`.

## Good to know

- Tapping automatically may break the game's rules, and accounts can get banned for it. Use it at your own risk.
- The game still decides the timers. This only presses the buttons for you.
