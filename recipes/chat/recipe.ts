import { decide } from "../../src/decisions.ts";
import { look, requireIphone } from "../../src/flow.ts";
import type { Phone } from "../../src/phone.ts";
import { on, type Recipe } from "../../src/recipe.ts";
import { center } from "../../src/screen.ts";
import { clock, sleep } from "../../src/time.ts";
import { goHome } from "../../src/world.ts";
import { fill } from "./facts.ts";
import { allianceField, chatBar, onChat, sendButton, shows, type Spot } from "./pure.ts";

const closeCross = { x: 380, y: 75 };

const see = async (phone: Phone) => (await look(phone)).lines.map((l): Spot => ({ text: l.text.trim(), ...center(l) }));

const waitFor = async (phone: Phone, test: (spots: Spot[]) => boolean, what: string, tries = 4): Promise<Spot[]> => {
  const spots = await see(phone);
  if (test(spots)) return spots;
  if (tries <= 0) throw new Error(`did not get to ${what}`);
  await sleep(1200);
  return waitFor(phone, test, what, tries - 1);
};

const press = async (phone: Phone, point: { x: number; y: number }, wait = 1500) => {
  await phone.tap(point);
  await sleep(wait);
};

export const writeAlliance: Recipe = {
  description:
    "Writes one message in the alliance chat: opens the chat from the bar above the bottom buttons, checks that the alliance channel is the one open, types the message and presses Send. {daily_fact} in the message becomes today's history fact, and {rand%20 'text'} adds text only 20 percent of the time. With --dry it types the message, does not send it and removes it again.",
  text: "CHAT_TEXT",
  switches: { "--dry": "CHAT_DRY" },
  run: async (phone, settings) => {
    const time = clock(settings.env.CLOCK);
    const log = (text: string) => console.log(`${time()} ${text}`);
    const message = fill(settings.env.CHAT_TEXT ?? "", new Date());
    const dry = on(settings.env, "CHAT_DRY");
    if (!message && (settings.env.CHAT_TEXT ?? "").trim()) {
      log("nothing to write this time, the random parts of the message were all left out");
      return;
    }
    if (!message) throw new Error('give the message, for example: just write-alliance "rally in 5 minutes"');
    await requireIphone(phone);
    const first = await see(phone);
    if (first.some((l) => l.y < 45 && /^\d{1,2}:\d{2}\b/.test(l.text))) {
      throw new Error("the game is not in front on the phone, open it and start again");
    }

    if (!onChat(first)) {
      const bar = chatBar(first) ?? (await goHome(phone, 8) ? chatBar(await see(phone)) : undefined);
      if (!bar) throw new Error("could not find the chat bar above the bottom buttons");
      await press(phone, bar, 2000);
    }
    const chat = await waitFor(phone, onChat, "the chat");
    const tab = chat.find((l) => l.y > 100 && l.y < 140 && l.text === "Alliance");
    if (tab) await press(phone, tab);
    const sub = (await see(phone)).find((l) => l.y > 150 && l.y < 190 && l.text === "Chat");
    if (sub) await press(phone, sub);

    const ready = await see(phone);
    const field = allianceField(ready);
    if (!field) throw new Error("the alliance chat is not the one open, nothing was written");
    await decide("alliance chat is open", { field: field.text });
    await press(phone, { x: field.x + 60, y: field.y }, 1500);
    await phone.type([...message]);
    await sleep(800);

    const typed = await see(phone);
    const send = sendButton(typed);
    if (!shows(typed, message) || !send) {
      await phone.type([..."\b".repeat(message.length)]);
      await press(phone, closeCross);
      throw new Error("the message did not show in the field as typed, nothing was sent");
    }
    if (dry) {
      await phone.type([..."\b".repeat(message.length)]);
      await press(phone, closeCross);
      await decide("dry run, not sent", { text: message });
      log(`dry run: typed "${message}" in the alliance chat and removed it again`);
      return;
    }

    await decide("sending to the alliance chat", { text: message });
    await press(phone, send, 2000);
    const after = await see(phone);
    const sent = shows(after, message, 800) && Boolean(allianceField(after));
    await decide(sent ? "sent" : "could not confirm it was sent", { text: message });
    log(
      sent
        ? `sent to the alliance chat: ${message}`
        : `pressed Send, but the message does not show in the chat: ${message}`,
    );
    await press(phone, closeCross);
    if (!sent) throw new Error("could not confirm the message was sent, look at the alliance chat");
  },
};
