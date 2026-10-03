import { beforeEach, describe, expect, test } from "bun:test";
import { defaultLook, outfitFor } from "../doll/outfits.js";
import { castKey, focusFrom, mentionScore } from "../shared/names.js";
import { DEFAULT_SETTINGS, type DollFollow, type DollRequest, type FrontendToBackend } from "../shared/protocol.js";
import { WARP_STATE, WARP_STATE_REQUEST, type WarpStateV1 } from "../shared/warp-state.js";
import { createDollLab, shownNote } from "./lab.js";
import { panelHtml } from "./panel.js";
import { cleanChat, MAX_CAST, putCast, sceneFocus, touchChat } from "./scene.js";
import { followHint, handleSettings, renderSettings } from "./settings-ui.js";
import { connectWarp } from "./warp-bridge.js";

class MemStore {
  m = new Map<string, string>();
  getItem(k: string) { return this.m.get(k) ?? null; }
  setItem(k: string, v: string) { this.m.set(k, String(v)); }
  removeItem(k: string) { this.m.delete(k); }
}

describe("who the 'With you' doll shows", () => {
  test("the reply's focus: most mentions (full or first name), then the latest", () => {
    const text = "Rhea leaned on the bar. Marcus polished a glass. \"Again?\" Rhea Vos asked, and Marcus shrugged.";
    expect(mentionScore(text, "Rhea Vos")).toBeGreaterThan(0);
    expect(focusFrom(text, ["Marcus", "Rhea Vos"])).toBe("Rhea Vos");
    expect(focusFrom("Marcus waved.", ["Rhea Vos"])).toBe("");
    // Whole words only: "Al" isn't in "Always".
    expect(focusFrom("Always the same.", ["Al"])).toBe("");
  });

  test("a pin wins while they're here; then the story's focus; then whoever is first", () => {
    expect(sceneFocus(["Rhea", "Marcus"], "marcus", "Rhea")).toBe("Marcus");
    expect(sceneFocus(["Rhea"], "Marcus", "Rhea")).toBe("Rhea");
    expect(sceneFocus(["Rhea", "Marcus"], "", "Juniper")).toBe("Rhea");
    expect(sceneFocus([], "Rhea", "Rhea")).toBeNull();
  });

  test("saved dolls are cleaned, the cast is capped, and old chats are forgotten", () => {
    const c = cleanChat({ cast: { x: { name: "__proto__", look: {} }, y: { name: "Rhea", look: { outfit: "nope" } } }, who: "evil", warpSeen: { you: { outfit: "a coat" }, __proto__: {} } }, { you: defaultLook("f"), them: defaultLook("m") });
    expect(Object.keys(c.cast)).toEqual(["rhea"]);
    expect(c.who).toBe("you");
    expect(c.warpSeen).toEqual({ you: { appearance: "", outfit: "a coat" } });
    for (let i = 0; i < MAX_CAST + 4; i++) putCast(c, `P${i}`, defaultLook("f"), "", i);
    expect(Object.keys(c.cast).length).toBe(MAX_CAST);
    expect(c.cast[castKey(`P${MAX_CAST + 3}`)]).toBeDefined();
    const { list, drop } = touchChat(["a", "b", "c"], "d", 3);
    expect(list).toEqual(["d", "a", "b"]);
    expect(drop).toEqual(["c"]);
  });

  test("what the helper guessed or made up isn't shown; errors and changes are", () => {
    expect(shownNote("Guessed: build; hairstyle.")).toBe("");
    expect(shownNote("Made up: a scarf")).toBe("");
    expect(shownNote("Changed: coat off.")).toBe("Changed: coat off.");
  });
});

let store: MemStore;
let sent: FrontendToBackend[];
let chat: string;
let queued: (() => void)[];
/** Run what the lab put off for later (the pause that lets Warp speak first). */
const flush = () => { for (const f of queued.splice(0)) f(); };
const make = () => createDollLab({ send: (m) => { sent.push(m); }, chatId: () => chat, changed: () => {}, later: (fn) => { queued.push(fn); } });
const looks = () => sent.filter((m): m is DollRequest => m.type === "doll_look");
const follows = () => sent.filter((m): m is DollFollow => m.type === "doll_follow");
const jevOn = { settings: { ...DEFAULT_SETTINGS }, jevKeySet: true, jevReady: true, connections: [] };

beforeEach(() => {
  store = new MemStore();
  (globalThis as { localStorage?: unknown }).localStorage = store;
  sent = []; chat = "c1"; queued = [];
});

describe("without Warp, the dolls follow the story themselves", () => {
  test("opening a chat dresses the card's character once (with Jev set up)", () => {
    const lab = make();
    lab.onSettings(jevOn);
    lab.onChat({ chatId: "c1", character: "Marcus", user: "Kit" });
    expect(looks()).toEqual([]);
    flush();
    expect(looks().map((m) => [m.who, m.source, m.auto])).toEqual([["Marcus", "profile", true]]);
    expect(lab.sceneSection()!.body).toContain("Dressing Marcus");
    lab.onChat({ chatId: "c1", character: "Marcus", user: "Kit" });
    flush();
    expect(looks().length).toBe(1);
  });

  test("after a reply: one follow request with the people, the player's look and the looks there are", () => {
    const lab = make();
    lab.onSettings(jevOn);
    lab.onChat({ chatId: "c1", character: "Marcus", user: "Kit" });
    lab.onLook({ type: "doll_look", who: "Marcus", look: { ...defaultLook("m"), outfit: outfitFor("street", "m") }, note: "", name: "Marcus", chatId: "c1", auto: true });
    expect(lab.sceneSection()!.body).toContain("<svg");
    lab.onReply({ chatId: "c1", messageId: "m2", text: "Marcus slid a mug over." });
    lab.onReply({ chatId: "c1", messageId: "m2", text: "Marcus slid a mug over." });
    expect(follows().length).toBe(1);
    const f = follows()[0];
    expect([f.people, f.pin, f.cast.map((c) => c.name), !!f.you]).toEqual([["Marcus"], "", ["Marcus"], true]);
  });

  test("Jev's answer moves the 'With you' doll; a first look shows as dressing", () => {
    const lab = make();
    lab.onSettings(jevOn);
    lab.onChat({ chatId: "c1", character: "Marcus", user: "Kit" });
    lab.onLook({ type: "doll_look", who: "Rhea", look: defaultLook("f"), note: "", name: "Rhea", chatId: "c1" });
    lab.onLook({ type: "doll_look", who: "Marcus", look: defaultLook("m"), note: "", name: "Marcus", chatId: "c1", auto: true });
    lab.onFocus({ chatId: "c1", name: "Rhea" });
    expect(lab.sceneSection()!.title).toContain("Rhea");
    // Pin Marcus.
    const fake = { type: "click", target: { closest: (s: string) => (s === ".doll-scene" ? {} : s.includes("data-doll-focus") ? { dataset: { dollFocus: "Marcus" } } : null) }, preventDefault() {} } as unknown as Event;
    expect(lab.handle(fake, {} as HTMLElement)).toBe(true);
    expect(lab.sceneSection()!.title).toContain("Marcus 📌");
    lab.onReply({ chatId: "c1", messageId: "m3", text: "Rhea sighed." });
    expect(follows().at(-1)!.pin).toBe("Marcus");
  });

  test("with Jev picked but not set up, nothing runs on its own; 'always' uses the helper", () => {
    const lab = make();
    lab.onSettings({ ...jevOn, jevReady: false });
    lab.onChat({ chatId: "c1", character: "Marcus", user: "Kit" });
    lab.onReply({ chatId: "c1", messageId: "m2", text: "Marcus waved." });
    expect(sent).toEqual([]);
    expect(lab.autoOn()).toBe(false);
    expect(lab.sceneSection()!.body).toContain("data-doll-scene-ask");
    lab.onSettings({ ...jevOn, jevReady: false, settings: { ...DEFAULT_SETTINGS, follow: "always" } });
    flush();
    expect(looks().map((m) => m.who)).toEqual(["Marcus"]);
  });

  test("the player's own name is never someone 'with you'", () => {
    const lab = make();
    lab.onChat({ chatId: "c1", character: "Kit", user: "Kit" });
    expect(lab.sceneSection()!.body).toContain("No one yet");
  });

  test("each chat keeps its own dolls; a late answer goes to the chat that asked", () => {
    const lab = make();
    lab.onSettings(jevOn);
    lab.onChat({ chatId: "c1", character: "Marcus", user: "Kit" });
    flush();
    chat = "c2";
    lab.onChat({ chatId: "c2", character: "Marcus", user: "Kit" });
    flush();
    expect(looks().length).toBe(2); // c2 dresses Marcus for itself
    lab.onLook({ type: "doll_look", who: "Marcus", look: defaultLook("m"), note: "", name: "Marcus", chatId: "c1", auto: true });
    expect(JSON.parse(store.getItem("doll:chat:c1")!).cast.marcus).toBeDefined();
    expect(JSON.parse(store.getItem("doll:chat:c2") ?? "{}").cast?.marcus).toBeUndefined();
  });

  test("dolls saved by Warp's old Doll tab are picked up", () => {
    store.setItem("warp:doll:chat:c1", JSON.stringify({ cast: { rhea: { name: "Rhea", look: defaultLook("f"), at: 1 } } }));
    const lab = make();
    lab.onChat({ chatId: "c1", character: "Rhea", user: "Kit" });
    expect(lab.sceneSection()!.body).toContain("<svg");
  });

  test("the status window shows one column per doll", () => {
    const lab = make();
    lab.onChat({ chatId: "c1", character: "Marcus", user: "Kit" });
    expect(panelHtml(lab, true).cols).toBe(2);
    expect(panelHtml(lab, true).html).toContain("Kit");
  });
});

describe("with Warp, the dolls follow Warp's words", () => {
  const state = (o: Partial<WarpStateV1> = {}): WarpStateV1 => ({
    version: 1, provider: "warp", chatId: "c1", messageId: "m1",
    you: { name: "Kit", outfit: "a grey hoodie and jeans" },
    people: [{ id: "rhea", name: "Rhea", present: true, appearance: "tall, silver hair", outfit: "a red coat" }, { id: "jo", name: "Jo", present: false, outfit: "overalls" }],
    ...o,
  });

  test("first sight: the player's doll matches Warp's words; Rhea (here, no look yet) is dressed from her card and Warp's words", () => {
    const lab = make();
    lab.onSettings(jevOn);
    lab.onChat({ chatId: "c1", character: "Rhea", user: "Kit" });
    lab.onWarp(state());
    // Warp spoke up before the pause ended: nobody is dressed without its words.
    flush();
    expect(looks().map((m) => [m.who, m.source])).toEqual([["you", "warp"], ["Rhea", "profile"]]);
    expect(looks()[0].warp).toEqual({ outfit: "a grey hoodie and jeans", changed: ["outfit"] });
    expect(looks()[1].warp).toEqual({ appearance: "tall, silver hair", outfit: "a red coat" });
    expect(lab.sceneSection()!.title).toContain("Rhea");
  });

  test("the same words again cost nothing; a changed outfit re-dresses just that, with the look now", () => {
    const lab = make();
    lab.onSettings(jevOn);
    lab.onWarp(state());
    for (const m of looks()) lab.onLook({ type: "doll_look", who: m.who, look: defaultLook("f"), note: "", name: m.who, chatId: "c1", auto: true });
    sent = [];
    lab.onWarp(state());
    expect(sent).toEqual([]);
    lab.onWarp(state({ people: [{ id: "rhea", name: "Rhea", present: true, appearance: "tall, silver hair", outfit: "nothing but a towel" }] }));
    expect(looks().map((m) => [m.who, m.source, m.warp?.changed])).toEqual([["Rhea", "warp", ["outfit"]]]);
    expect(looks()[0].current).toBeDefined();
  });

  test("a reply never reads the story twice: no follow request while Warp runs the chat", () => {
    const lab = make();
    lab.onSettings(jevOn);
    lab.onWarp(state());
    sent = [];
    lab.onReply({ chatId: "c1", messageId: "m2", text: "Rhea laughed." });
    expect(follows()).toEqual([]);
    // Only the people Warp says are here can be "with you".
    expect(lab.sceneSection()!.body).not.toContain("Jo");
  });

  test("a change that arrives while a doll is busy is sent once the answer is in", () => {
    const lab = make();
    lab.onSettings(jevOn);
    lab.onWarp(state({ people: [] }));
    expect(looks().map((m) => m.who)).toEqual(["you"]);
    lab.onWarp(state({ people: [], you: { name: "Kit", outfit: "a raincoat" } }));
    expect(looks().length).toBe(1);
    lab.onLook({ type: "doll_look", who: "you", look: defaultLook("f"), note: "", chatId: "c1", auto: true });
    expect(looks().map((m) => m.warp?.outfit)).toEqual(["a grey hoodie and jeans", "a raincoat"]);
  });

  test("Warp with nothing to say about this chat leaves LumiDoll on its own path", () => {
    const lab = make();
    lab.onSettings(jevOn);
    lab.onChat({ chatId: "c1", character: "Marcus", user: "Kit" });
    lab.onWarp(state({ people: [], you: { name: "Kit" } }));
    lab.onReply({ chatId: "c1", messageId: "m2", text: "Marcus waved." });
    expect(follows().length).toBe(1);
  });

  test("'only when I ask' ignores Warp's changes too", () => {
    const lab = make();
    lab.onSettings({ ...jevOn, settings: { ...DEFAULT_SETTINGS, follow: "off" } });
    lab.onWarp(state());
    expect(sent).toEqual([]);
  });

  test("the bridge reads warp-state-v1 events and asks with warp-state-request-v1", () => {
    const target = new EventTarget() as unknown as Window;
    const got: WarpStateV1[] = [];
    const asked: unknown[] = [];
    target.addEventListener(WARP_STATE_REQUEST, (e) => asked.push((e as CustomEvent).detail));
    const bridge = connectWarp((s) => got.push(s), target);
    bridge.request();
    expect(asked).toEqual([{ version: 1 }]);
    target.dispatchEvent(new CustomEvent(WARP_STATE, { detail: state() }));
    target.dispatchEvent(new CustomEvent(WARP_STATE, { detail: { version: 2, provider: "warp" } }));
    target.dispatchEvent(new CustomEvent(WARP_STATE, { detail: { ...state(), provider: "other" } }));
    expect(got.length).toBe(1);
    expect(got[0].people.map((p) => p.name)).toEqual(["Rhea", "Jo"]);
    bridge.stop();
    target.dispatchEvent(new CustomEvent(WARP_STATE, { detail: state() }));
    expect(got.length).toBe(1);
  });
});

describe("settings", () => {
  const view = (o: Partial<{ jev: boolean; follow: "jev" | "always" | "off"; ready: boolean; key: boolean }> = {}) => ({
    settings: { ...DEFAULT_SETTINGS, jev: o.jev ?? false, follow: o.follow ?? "jev" }, jevKeySet: o.key ?? false, jevReady: o.ready ?? false, connections: [{ id: "fast", name: "Fast <helper>" }],
  });

  test("what following does, in a sentence, for each case", () => {
    expect(followHint(view(), false)).toContain("Off for now");
    expect(followHint(view({ follow: "always" }), false)).toContain("one call per doll");
    expect(followHint(view({ ready: true }), false)).toContain("Jev checks who it's about");
    expect(followHint(view({ ready: true }), true)).toContain("Warp is running this chat");
    expect(followHint(view({ follow: "off", ready: true }), true)).toContain("only when you press");
  });

  test("Jev's fields show only when it's on; names are escaped; a chat URL is flagged", () => {
    const off = renderSettings(view(), { hud: true, scene: true }, false);
    expect(off).not.toContain("data-jevkey");
    expect(off).toContain("Fast &lt;helper&gt;");
    const on = renderSettings({ ...view({ jev: true, key: true }), settings: { ...DEFAULT_SETTINGS, jev: true, jevUrl: "https://openrouter.ai/api/v1/chat/completions" } }, { hud: true, scene: false }, false);
    expect(on).toContain("data-jevkey");
    expect(on).toContain("Key stored encrypted");
    expect(on).toContain('role="alert"');
  });

  test("changes go to the backend as patches; panel choices stay in the page", () => {
    const sentNow: FrontendToBackend[] = [];
    const prefs: unknown[] = [];
    const change = (el: Record<string, unknown>) => handleSettings({ type: "change", target: { matches: () => true, closest: () => null, ...el } } as unknown as Event, {} as HTMLElement, { send: (m) => sentNow.push(m), prefs: (p) => prefs.push(p) });
    change({ dataset: { setting: "follow" }, type: "select-one", value: "always" });
    change({ dataset: { setting: "jev" }, type: "checkbox", checked: true });
    change({ dataset: { dollPref: "scene" }, type: "checkbox", checked: false });
    expect(sentNow).toEqual([{ type: "settings", patch: { follow: "always" } }, { type: "settings", patch: { jev: true } }]);
    expect(prefs).toEqual([{ scene: false }]);
  });
});
