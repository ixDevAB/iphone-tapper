import { assertEquals } from "@std/assert";
import { allianceField, chatBar, onChat, sendButton, shows } from "./pure.ts";

const at = (text: string, x: number, y: number) => ({ text, x, y });

const open = [
  at("Chat", 72, 76),
  at("World", 75, 121),
  at("Alliance", 200, 119),
  at("Private", 328, 121),
  at("Chat", 69, 169),
  at("[Alliance] Tap to enter", 75, 820),
  at("Send", 342, 819),
];

Deno.test("the alliance chat is known by its title, its tab and the field that says Alliance", () => {
  assertEquals(onChat(open), true);
  assertEquals(allianceField(open)?.y, 820);
  assertEquals(sendButton(open)?.x, 342);
  assertEquals(onChat([at("Conquest", 40, 839), at("Alliance", 299, 838)]), false);
  assertEquals(allianceField([at("[World] Tap to enter", 75, 820)]), undefined);
});

Deno.test("a typed or sent message is found by its start, whatever the punctuation", () => {
  const typed = [...open, at("test from the tapper", 89, 452), at("Send", 359, 466)];
  assertEquals(shows(typed, "test from the tapper"), true);
  assertEquals(shows(typed, "Test, from the tapper!"), true);
  assertEquals(shows(typed, "rally in 5 minutes"), false);
  assertEquals(shows(typed, "test from the tapper", 400), false);
  assertEquals(shows(typed, "!!"), false);
});

Deno.test("the chat bar sits just above the bottom buttons", () => {
  assertEquals(chatBar([at("Conquest", 40, 839), at("Heroes", 106, 838)]), { x: 200, y: 771 });
  assertEquals(chatBar([at("Chat", 72, 76)]), undefined);
});
