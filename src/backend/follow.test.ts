import { beforeEach, describe, expect, test } from "bun:test";
import type { Answers, Questions } from "../shared/decide.js";
import { DEFAULT_SETTINGS, type DollFollow } from "../shared/protocol.js";
import { defaultLook } from "../doll/outfits.js";
import { fakeHost, type FakeHost } from "./fake-host.js";
import { askFocus, focusQuestions, follow } from "./follow.js";

/** A pretend Jev: picks a person for the focus question, says nothing changed for the rest. */
function pretendJev(pick: string, confidence = 0.9) {
  const c = {
    calls: 0, batches: [] as string[][],
    ask: async (_state: unknown, q: Questions): Promise<Answers> => {
      c.calls++;
      c.batches.push(Object.keys(q));
      if (q.about) return { about: { type: "choice", choice: pick, confidence, probabilities: {} } };
      return { changed: { type: "noul", noul: 0.02 } };
    },
  };
  return c;
}

const req = (o: Partial<DollFollow> = {}): DollFollow => ({ type: "doll_follow", chatId: "c1", messageId: "m2", people: ["Rhea Vos", "Marcus"], pin: "", you: defaultLook("f"), cast: [{ name: "Marcus", look: defaultLook("m") }], ...o });

describe("following the story without Warp", () => {
  let h: FakeHost;
  beforeEach(() => {
    h = fakeHost({ messages: [{ id: "m1", is_user: true, content: "Hi." }, { id: "m2", is_user: false, content: "Marcus poured. Rhea Vos took off her coat. Rhea laughed." }], macros: { "{{user}}": "Kit" }, helper: () => JSON.stringify({ look: defaultLook("m") }) });
  });

  test("Jev's question lists the people by safe keys, plus nobody", () => {
    const q = focusQuestions("Kit", ["Rhea Vos", "__proto__"]).about;
    expect(q.type === "choice" && q.criteria).toEqual({ p0: "Rhea Vos", p1: "__proto__", none: "none of these people" });
  });

  test("with Jev: who it's about comes from Jev; Rhea has no look yet, so she's dressed from her card; no helper call", async () => {
    const jev = pretendJev("p0");
    await follow(req(), undefined, { settings: { ...DEFAULT_SETTINGS, jev: true }, jev });
    const focus = h.sent.find((m) => m.type === "doll_focus")!;
    expect([focus.name, focus.dressing]).toEqual(["Rhea Vos", true]);
    const looks = h.sent.filter((m) => m.type === "doll_look");
    expect(looks.map((m) => m.who).sort()).toEqual(["Rhea Vos", "you"]);
    expect(h.quiet.length).toBe(0);
    // Who it's about and the player's story check side by side, then Rhea's first look.
    expect(jev.batches[0]).toEqual(["about"]);
    expect(jev.calls).toBe(3);
  });

  test("someone already asked about once isn't dressed again on every reply", async () => {
    const jev = pretendJev("p0");
    await follow(req({ asked: ["rhea vos"] }), undefined, { settings: { ...DEFAULT_SETTINGS, jev: true }, jev });
    expect(h.sent.filter((m) => m.type === "doll_look").map((m) => m.who)).toEqual(["you"]);
    expect(h.sent.find((m) => m.type === "doll_focus")!.dressing).toBeUndefined();
  });

  test("a pin wins over Jev and asks nothing about who it's about", async () => {
    const jev = pretendJev("p0");
    await follow(req({ pin: "marcus" }), undefined, { settings: { ...DEFAULT_SETTINGS, jev: true }, jev });
    expect(h.sent.find((m) => m.type === "doll_focus")!.name).toBe("Marcus");
    expect(jev.batches.some((b) => b.includes("about"))).toBe(false);
  });

  test("Jev unsure: the names in the reply decide", async () => {
    expect(await askFocus(pretendJev("p1", 0.2), "Kit", "x", ["Rhea", "Marcus"])).toBeNull();
    await follow(req(), undefined, { settings: { ...DEFAULT_SETTINGS, jev: true }, jev: pretendJev("p1", 0.2) });
    expect(h.sent.find((m) => m.type === "doll_focus")!.name).toBe("Rhea Vos");
  });

  test("without Jev, 'with Jev' mode does nothing; 'always' asks the helper once per doll", async () => {
    await follow(req(), undefined, { settings: { ...DEFAULT_SETTINGS, follow: "jev" }, jev: null });
    expect(h.sent).toEqual([]);
    await follow(req({ cast: [{ name: "Rhea Vos", look: defaultLook("f") }] }), undefined, { settings: { ...DEFAULT_SETTINGS, follow: "always" }, jev: null });
    expect(h.sent.find((m) => m.type === "doll_focus")!.name).toBe("Rhea Vos");
    expect(h.quiet.length).toBe(2);
    expect(h.quiet.every((q) => q.user.includes("The latest story"))).toBe(true);
  });

  test("'only when I ask' never runs on its own", async () => {
    await follow(req(), undefined, { settings: { ...DEFAULT_SETTINGS, follow: "off", jev: true }, jev: pretendJev("p0") });
    expect(h.sent).toEqual([]);
  });
});
