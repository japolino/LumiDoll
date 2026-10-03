import { beforeEach, describe, expect, test } from "bun:test";
import { classifierIssue, JEV_URL, OPENROUTER_JEV } from "../shared/classifier-config.js";
import { DEFAULT_SETTINGS } from "../shared/protocol.js";
import { fakeHost, type FakeHost } from "./fake-host.js";
import { getJev, JevClassifier, jevStatus } from "./jev.js";
import { clearSettingsCache, getSettings, normalizeSettings, patchSettings } from "./settings.js";

const questions = { coat: { type: "noul" as const, instructions: "Mara puts on a coat" } };

describe("Jev", () => {
  let h: FakeHost;
  beforeEach(() => { clearSettingsCache(); h = fakeHost({ jev: () => ({ answers: { coat: { type: "noul", noul: 0.9 } } }) }); });

  test("off, or on without a key at TypeSafe: the helper model is used", async () => {
    expect(await getJev({ ...DEFAULT_SETTINGS, jev: false })).toBeNull();
    expect(await getJev({ ...DEFAULT_SETTINGS, jev: true })).toBeNull();
    expect((await jevStatus({ ...DEFAULT_SETTINGS, jev: true })).ready).toBe(false);
  });

  test("with a key, the typed questions go to the endpoint as { model, state, questions }", async () => {
    h = fakeHost({ key: "offline-dummy", jev: () => ({ answers: { coat: { type: "noul", noul: 0.9 } } }) });
    const jev = (await getJev({ ...DEFAULT_SETTINGS, jev: true }))!;
    expect(await jevStatus({ ...DEFAULT_SETTINGS, jev: true })).toEqual({ keySet: true, ready: true });
    expect((await jev.ask({ latest_reply: "x" }, questions)).coat).toEqual({ type: "noul", noul: 0.9 });
    expect(h.cors[0]).toEqual({ url: JEV_URL, body: { model: "jev-latest", state: { latest_reply: "x" }, questions } });
  });

  test("Jev on OpenRouter uses its decisions URL and model", async () => {
    h = fakeHost({ key: "offline-dummy" });
    const jev = (await getJev({ ...DEFAULT_SETTINGS, jev: true, ...OPENROUTER_JEV }))!;
    await jev.ask({}, questions);
    expect(h.cors[0].url).toBe(OPENROUTER_JEV.jevUrl);
    expect(h.cors[0].body.model).toBe(OPENROUTER_JEV.jevModel);
  });

  test("a pasted chat URL is refused before anything is sent", async () => {
    expect(classifierIssue("jev-latest", "https://openrouter.ai/api/v1/chat/completions")).toContain("chat endpoint");
    await expect(new JevClassifier("offline-dummy", "jev-latest", "https://openrouter.ai/api/v1/chat/completions/").ask({}, questions)).rejects.toThrow("chat endpoint");
    expect(h.cors).toEqual([]);
  });

  test("a rejected key says so", async () => {
    ((globalThis as unknown as { spindle: { cors: unknown } }).spindle).cors = async () => ({ status: 401, body: "bad key" });
    await expect(new JevClassifier("offline-dummy", "jev-latest").ask({}, questions)).rejects.toThrow("API key was rejected");
  });
});

describe("settings", () => {
  beforeEach(() => { clearSettingsCache(); fakeHost(); });

  test("junk is cleaned: unknown follow modes, bad URLs, non-booleans", () => {
    expect(normalizeSettings({ follow: "sometimes", jevUrl: "javascript:alert(1)", jev: "yes", helperConnectionId: 3 })).toEqual(DEFAULT_SETTINGS);
    expect(normalizeSettings({ follow: "always", jev: true }).follow).toBe("always");
  });

  test("a patch keeps the rest", async () => {
    await patchSettings({ helperConnectionId: "fast" });
    await patchSettings({ jev: true, ...OPENROUTER_JEV });
    clearSettingsCache();
    const s = await getSettings();
    expect([s.helperConnectionId, s.jev, s.jevUrl]).toEqual(["fast", true, OPENROUTER_JEV.jevUrl]);
  });
});
