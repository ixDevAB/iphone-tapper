# iPhone Tapper

Taps a button in an iPhone game over and over, controlled from your Mac. It was made for the **Heal Injured** window: it presses **Heal**, then **Help**, then **Heal** again, until all your troops are healed.

Every 100 taps it takes a screenshot of the phone to check that the button is still there. If a popup is in the way, it waits instead of tapping.

## What you need

- A Mac with Apple Silicon (M1 or newer)
- An iPhone and a USB cable
- **Xcode**, free from the Mac App Store
- An **Apple ID**. A free one works. A paid Apple Developer account is optional (see [Free or paid Apple account](#free-or-paid-apple-account)).
- **Deno**: open the Terminal app and paste `curl --fail --silent --show-error --location https://deno.land/install.sh | sh`

## First time setup

Do this once.

1. **Sign in to Xcode**
   Open Xcode, go to Xcode > Settings > Accounts, press **+** and sign in with your Apple ID.
   Select your account, press **Manage Certificates**, press **+** and choose **Apple Development**.

2. **Turn on Developer Mode on the iPhone**
   Settings > Privacy & Security > Developer Mode > On. The phone restarts.

3. **Connect the phone**
   Plug the iPhone into the Mac, unlock it and tap **Trust** if it asks.
   In Xcode, go to Window > Devices and Simulators, and wait until the phone shows up without warnings.

4. **Get the project and start it**
   In Terminal:
   ```sh
   git clone https://github.com/ixDevAB/iphone-tapper.git
   cd iphone-tapper
   deno task start
   ```
   The first start downloads and installs a helper app on your phone. This takes a few minutes. After that, starting is quick.

5. **Free Apple ID only:** the phone will say **Untrusted Developer**. Go to Settings > General > VPN & Device Management, tap your Apple ID and **Trust**. Then run `deno task start` again.

## Every time you use it

1. Plug in the iPhone and unlock it.
2. Open the game and go to the **Heal Injured** window.
3. In Terminal:
   ```sh
   cd iphone-tapper
   deno task start
   ```
4. Leave the phone alone. You will see "Automation Running" on the phone, that is normal.
5. Press **Ctrl + C** in Terminal to stop. It also stops by itself when there has been nothing to heal for 10 minutes.

**Tip:** set Settings > Display & Brightness > Auto-Lock to **Never** while it runs, otherwise the screen turns off and the tapping stops.

## Free or paid Apple account

| | Free Apple ID | Paid Apple Developer ($99/year) |
| --- | --- | --- |
| Works | Yes | Yes |
| Helper app lasts | 7 days, then run `deno task rebuild` | 1 year |
| Trust prompt on the phone | Once | No |

## Settings

Most people do not need to change anything. To change a setting, create a settings file once:

```sh
cp .env.example .env
open -e .env
```

Change a value, save, and start again.

| Setting | What it does | Default |
| --- | --- | --- |
| `TEAM_ID` | Which Apple developer team signs the helper app | Found automatically |
| `BUNDLE_ID` | Name of the helper app on the phone | Made from your team |
| `TAP_X`, `TAP_Y` | Where on the screen it taps | The Heal button on an iPhone 17 Pro |
| `INTERVAL_MS` | Pause between taps, in milliseconds | `300` |
| `CHECK_EVERY` | Take a screenshot to check the button every N taps | `100` |
| `MAX_IDLE_SECONDS` | Stop when the button has been missing this long | `600` |
| `DEVICE_UDID` | Pick a specific iPhone if several are connected | First connected iPhone |

On a different iPhone model the button may sit somewhere else, so ask someone technical to adjust `TAP_X` and `TAP_Y`.

## When something goes wrong

| What you see | What to do |
| --- | --- |
| `no iphone found` | Plug in the cable, unlock the phone, try again. |
| `is not reachable` | Unlock the phone and keep it unlocked while starting. |
| `no apple development certificate found` | Do step 1 of the first time setup. |
| `several developer teams found` | Create the settings file and copy one of the `TEAM_ID=` lines it shows into it. |
| `xcodebuild failed, see build.log` | Check that you are signed in to Xcode and that the phone is unlocked. |
| `webdriveragent did not start` | Unlock the phone, run `deno task rebuild`. |
| The phone says **Untrusted Developer** | Settings > General > VPN & Device Management, tap your Apple ID and **Trust**. |
| It worked last week but not today | Run `deno task rebuild` to reinstall the helper app. |

## Using Nix

If you use Nix, you can skip installing Deno. The flake gives you Deno and git, Xcode still comes from the App Store.

```sh
nix develop
deno task start
```

With direnv, run `direnv allow` once and the shell loads when you enter the folder.

## Good to know

- Tapping automatically may break the game's rules, and accounts can get banned for it. Use it at your own risk.
- The game still decides the timers. This only presses the buttons for you.
