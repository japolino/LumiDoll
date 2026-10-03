import { beforeEach, describe, expect, test } from "bun:test";
import type { Answers } from "../shared/decide.js";
import { DEFAULT_SETTINGS } from "../shared/protocol.js";
import { cleanLook, defaultLook, outfitFor } from "../doll/outfits.js";
import { answerLook, lookFrom, mergeWarp } from "./dress.js";
import { fakeHost, type FakeHost } from "./fake-host.js";
import { lookFromAnswers } from "./questions.js";
import { nameRe } from "./source.js";
import aina from "./fixtures/doll-jev-aina.json";
import vance from "./fixtures/doll-jev-vance.json";

const vanceLook = lookFromAnswers(vance as Answers, "Vance").look;
const ainaLook = lookFromAnswers(aina as Answers, "Aina").look;
/** A classifier that always gives these answers, and counts how often it's asked. */
const answering = (a: Answers) => { const c = { calls: 0, asked: [] as unknown[], ask: async (state: unknown) => { c.calls++; c.asked.push(state); return a; } }; return c; };

describe("the helper's reply", () => {
  test("finds the look after thinking-out-loud objects, prose and code fences", () => {
    expect(lookFrom('Sure!\n```json\n{"thought": "dressing"} {"look": {"eyes": "blue"}, "invented": ["eyes"]}\n```')).toEqual({ look: { eyes: "blue" }, invented: ["eyes"] });
  });
  test("a look written at the top level, or as a bare list of garments", () => {
    expect(lookFrom('{"body": {"sex": "m"}, "outfit": []}')?.look).toEqual({ body: { sex: "m" }, outfit: [] });
    const got = lookFrom('{"look": [{"kind": "robe", "colour": "navy"}]}')!;
    expect(cleanLook(got.look).outfit.map((g) => g.kind)).toEqual(["robe"]);
  });
  test("no look at all, or a null one, is a failure (never a default doll)", () => {
    expect(lookFrom('{"look": null}')).toBeNull();
    expect(lookFrom("I can't help with that.")).toBeNull();
    expect(lookFrom('{"thought": "x"}')).toBeNull();
  });
  test("braces inside strings don't confuse it", () => {
    expect(lookFrom('{"look": {"outfit": [{"kind": "top", "label": "a {weird} \\"shirt\\""}]}}')?.look).toEqual({ outfit: [{ kind: "top", label: 'a {weird} "shirt"' }] });
  });
  test("presets written as 'f: curvy' or 'Curvy', and colour words with modifiers", () => {
    const l = cleanLook({ body: { sex: "f", preset: "f: Curvy", blend: { preset: "HEAVY", amount: 0.3 } }, eyes: "hazel", skin: "peach", hair: { colour: "deep crimson" } });
    expect(l.body.preset).toBe("curvy");
    expect(l.body.blend?.preset).toBe("heavy");
    expect([l.eyes, l.skin, l.hair.colour]).toEqual(["#8e7652", "#f4c29f", "#9e1b32"]);
  });
  test("an empty name matches nothing", () => {
    expect(nameRe("").test("Anyone. Anything, at all.")).toBe(false);
    expect(nameRe("  ").test("x")).toBe(false);
    expect(nameRe("Aina").test("Then Aina left.")).toBe(true);
  });
});

describe("Warp's words re-dress only what they changed", () => {
  test("a new outfit keeps the body, hair and ears", () => {
    const { look, changed } = mergeWarp(vanceLook, ainaLook, ["outfit"]);
    expect(changed).toEqual(["outfit"]);
    expect(look.outfit.map((g) => g.kind)).toEqual(ainaLook.outfit.map((g) => g.kind));
    expect([look.body.sex, look.ears, look.hair]).toEqual([vanceLook.body.sex, vanceLook.ears ?? null, vanceLook.hair]);
  });
  test("a new appearance keeps the clothes; what Jev only guessed stays as it was", () => {
    const { look } = mergeWarp(vanceLook, ainaLook, ["appearance"], ["sex", "hair colour"]);
    expect(look.outfit).toEqual(vanceLook.outfit);
    expect(look.ears).toBe("cat");
    expect(look.body.sex).toBe(vanceLook.body.sex);
    expect(look.hair.colour).toBe(vanceLook.hair.colour);
    expect(look.hair.style).toBe(ainaLook.hair.style);
  });
});

describe("dressing", () => {
  let h: FakeHost;
  const settings = { ...DEFAULT_SETTINGS };
  beforeEach(() => { h = fakeHost({ messages: [{ id: "m1", is_user: false, content: "Vance shrugged off his coat." }], macros: { "{{user}}": "Kit", "{{persona}}": "Kit, a fox girl in a blue yukata." } }); });

  test("with Jev set up, Warp's new outfit is one Jev call and no helper call", async () => {
    const jev = answering(aina as Answers);
    const out = await answerLook({ type: "doll_look", chatId: "c1", who: "Vance", source: "warp", current: vanceLook, warp: { outfit: "a school blazer, plaid skirt and knee socks", changed: ["outfit"] }, auto: true }, undefined, { settings, jev });
    expect(jev.calls).toBe(1);
    expect(h.quiet.length).toBe(0);
    expect(jev.asked[0]).toEqual({ who: "Vance", wearing: "a school blazer, plaid skirt and knee socks" });
    const look = cleanLook(out.look);
    expect(look.body.sex).toBe("m");
    expect(look.outfit.find((g) => g.kind === "skirt")?.pattern).toBe("plaid");
    expect(out.note).toContain("outfit");
  });

  test("without Jev, the helper gets Warp's words and the look now, and only the outfit is taken", async () => {
    h = fakeHost({ helper: () => JSON.stringify({ look: { ...defaultLook("f"), outfit: outfitFor("maid", "f") } }) });
    const out = await answerLook({ type: "doll_look", chatId: "c1", who: "Vance", source: "warp", current: vanceLook, warp: { outfit: "a maid's dress", changed: ["outfit"] }, auto: true }, undefined, { settings, jev: null });
    expect(h.quiet.length).toBe(1);
    expect(h.quiet[0].user).toContain("Wearing: a maid's dress");
    expect(h.quiet[0].user).toContain("Change only their outfit");
    const look = cleanLook(out.look);
    expect(look.body.sex).toBe("m");
    expect(look.outfit.some((g) => g.kind === "apron")).toBe(true);
  });

  test("a first look while Warp runs reads the card and Warp's words, not the story", async () => {
    h = fakeHost({ helper: () => JSON.stringify({ look: defaultLook("m") }), character: { id: "ch", name: "Vance", description: "A tired drifter." }, messages: [{ id: "m1", is_user: false, content: "STORY TEXT" }] });
    await answerLook({ type: "doll_look", chatId: "c1", who: "Vance", source: "profile", warp: { appearance: "unshaven, grey eyes", outfit: "a trench coat" }, auto: true }, undefined, { settings, jev: null });
    expect(h.quiet[0].user).toContain("A tired drifter.");
    expect(h.quiet[0].user).toContain("Appearance: unshaven, grey eyes");
    expect(h.quiet[0].user).not.toContain("The story lately");
  });

  test("the player's doll from their persona; the helper's guesses are noted", async () => {
    h = fakeHost({ helper: () => '{"look": {"ears": "fox"}, "invented": ["shoes"]}', macros: { "{{user}}": "Kit", "{{persona}}": "Kit, a fox girl." } });
    const out = await answerLook({ type: "doll_look", chatId: "c1", who: "you", source: "profile" }, undefined, { settings, jev: null });
    expect(h.quiet[0].user).toContain("Kit, a fox girl.");
    expect(out.name).toBe("Kit");
    expect(cleanLook(out.look).ears).toBe("fox");
    expect(out.note).toBe("Made up: shoes");
  });

  test("a story check that finds nothing changed costs one Jev call", async () => {
    const jev = answering({ changed: { type: "noul", noul: 0.05 } });
    const out = await answerLook({ type: "doll_look", chatId: "c1", who: "Vance", source: "story", current: vanceLook, auto: true }, undefined, { settings, jev });
    expect(jev.calls).toBe(1);
    expect(out.note).toContain("Nothing");
    expect(out.look).toEqual(vanceLook);
  });

  test("a failure is an answer with an error, never a thrown request", async () => {
    h = fakeHost({ helper: () => "no." });
    const out = await answerLook({ type: "doll_look", chatId: "c1", who: "you", source: "text", text: "a knight" }, undefined, { settings, jev: null });
    expect(out.look).toBeNull();
    expect(out.error).toContain("didn't send a look");
    const empty = await answerLook({ type: "doll_look", chatId: "c1", who: "you", source: "text", text: " " }, undefined, { settings, jev: null });
    expect(empty.error).toBe("Describe the look first.");
  });
});
