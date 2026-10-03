// LumiDoll's settings: what the status window shows, when the dolls follow the
// story, the helper connection, and Jev (optional).

import { classifierIssue, JEV_URL, OPENROUTER_JEV } from "../shared/classifier-config.js";
import type { FrontendToBackend, Settings } from "../shared/protocol.js";
import type { DollPrefs } from "./scene.js";

export interface SettingsView { settings: Settings; jevKeySet: boolean; jevReady: boolean; connections: { id: string; name: string }[] }

const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const toggle = (attr: string, label: string, hint: string, on: boolean) =>
  `<label class="doll-toggle"><span>${esc(label)}</span><small>${esc(hint)}</small><input type="checkbox" ${attr}${on ? " checked" : ""}></label>`;

/** What "Follow the story" does right now, in a sentence. */
export function followHint(v: SettingsView, withWarp: boolean): string {
  const f = v.settings.follow;
  if (f === "off") return "The dolls change only when you press a button.";
  if (f === "jev" && !v.jevReady) return "Off for now: set up Jev below to turn this on, or pick \"Always\".";
  if (withWarp) return v.jevReady
    ? "Warp is running this chat: when it says someone's outfit or looks changed, Jev re-dresses just that. Nothing else is read."
    : "Warp is running this chat: when it says someone's outfit or looks changed, the helper re-dresses just that (one call each time).";
  return v.jevReady
    ? "After each reply, Jev checks who it's about and what changed (about a quarter of a second). Someone new is dressed the first time they're with you."
    : "After each reply, the helper model checks each doll: one call per doll, every reply.";
}

export function renderSettings(v: SettingsView, prefs: DollPrefs, withWarp: boolean): string {
  const s = v.settings;
  const issue = s.jev ? classifierIssue(s.jevModel, s.jevUrl) : null;
  const typesafe = s.jevUrl === JEV_URL;
  const host = (() => { try { return new URL(s.jevUrl).host; } catch { return s.jevUrl; } })();
  const follow = ([["jev", "After each reply, with Jev"], ["always", "After each reply, always"], ["off", "Only when I ask"]] as const)
    .map(([k, l]) => `<option value="${k}"${s.follow === k ? " selected" : ""}>${l}</option>`).join("");
  return `<div class="doll-settings">
  <div class="doll-card">
    <h3>Status window</h3>
    ${toggle('data-doll-pref="hud"', "Show my doll", "Your doll in the floating window.", prefs.hud)}
    ${toggle('data-doll-pref="scene"', "Show who's with me", withWarp ? "The person Warp says is with you (the one the story is about, or the one you pin)." : "The person the latest reply is about (or the one you pin): the card's character, or anyone you've dressed in this chat.", prefs.scene)}
  </div>
  <div class="doll-card">
    <h3>Follow the story</h3>
    <select class="doll-input" data-setting="follow">${follow}</select>
    <p>${esc(followHint(v, withWarp))}</p>
  </div>
  <div class="doll-card">
    <h3>Helper model</h3>
    <p>Writes looks from your persona, a card, a description or the story${s.jev ? " when Jev can't" : ""}. A fast, cheap model works best.</p>
    <select class="doll-input" data-setting="helperConnectionId">
      <option value="">Same as the chat</option>
      ${v.connections.map((c) => `<option value="${esc(c.id)}"${c.id === s.helperConnectionId ? " selected" : ""}>${esc(c.name)}</option>`).join("")}
    </select>
  </div>
  <div class="doll-card">
    <h3>Jev (optional)</h3>
    <p>A classifier from TypeSafe: it answers the doll's questions (what someone wears, what changed, who a reply is about) faster and cheaper than a helper model. When it's on and set up, every one of those questions goes to Jev; the helper only writes what Jev can't.</p>
    ${toggle('data-setting="jev"', "Use Jev", "Needs a TypeSafe key, or Jev on OpenRouter with an OpenRouter key.", s.jev)}
    ${s.jev ? `
    <label class="doll-field">Endpoint
      <input class="doll-input" data-setting="jevUrl" value="${esc(s.jevUrl)}" placeholder="${esc(JEV_URL)}" spellcheck="false" autocomplete="off">
    </label>
    <label class="doll-field">Model
      <input class="doll-input" data-setting="jevModel" value="${esc(s.jevModel)}" placeholder="jev-latest" spellcheck="false" autocomplete="off">
    </label>
    <div class="doll-flex"><button class="doll-btn" data-jev-openrouter>Jev on OpenRouter</button><span class="doll-dim">Sets the endpoint and model for OpenRouter.</span></div>
    ${issue ? `<p class="doll-warn" role="alert">${esc(issue)}</p>` : ""}
    <div class="doll-flex">
      <input class="doll-input" type="password" data-jevkey placeholder="${v.jevKeySet ? "Key saved. Paste to replace" : typesafe ? "TypeSafe API key (sk-…)" : "API key"}" autocomplete="off">
      <button class="doll-btn" data-save-jev>${v.jevKeySet ? "Replace" : "Save"}</button>
      ${v.jevKeySet ? `<button class="doll-btn doll-btn-ghost" data-clear-jev>Remove</button>` : ""}
    </div>
    <p>${v.jevKeySet ? "✓ Key stored encrypted on the server." : "No key yet. Until you add one, the helper model does everything."} The doll's questions send story text to <b>${esc(host)}</b>.</p>
    <div class="doll-flex"><button class="doll-btn" data-test-jev>Test Jev</button><span class="doll-dim">${v.jevReady ? "Ready." : "Not ready yet."}</span></div>` : ""}
  </div>
</div>`;
}

/** Settings events; true when handled. */
export function handleSettings(e: Event, root: HTMLElement, o: { send(m: FrontendToBackend): void; prefs(p: Partial<DollPrefs>): void }): boolean {
  const t = e.target as HTMLElement;
  if (e.type === "click") {
    const b = t.closest?.<HTMLElement>("[data-jev-openrouter],[data-save-jev],[data-clear-jev],[data-test-jev]");
    if (!b) return false;
    e.preventDefault();
    if (b.hasAttribute("data-jev-openrouter")) o.send({ type: "settings", patch: { ...OPENROUTER_JEV } });
    else if (b.hasAttribute("data-save-jev")) {
      const input = root.querySelector<HTMLInputElement>("[data-jevkey]");
      const key = input?.value.trim() ?? "";
      if (key) { o.send({ type: "set_jev_key", key }); if (input) input.value = ""; }
    } else if (b.hasAttribute("data-clear-jev")) o.send({ type: "set_jev_key", key: "" });
    else o.send({ type: "test_jev" });
    return true;
  }
  if (e.type !== "change") return t.matches?.("[data-setting],[data-doll-pref],[data-jevkey]") ?? false;
  const pref = t.dataset?.dollPref;
  if (pref === "hud" || pref === "scene") { o.prefs({ [pref]: (t as HTMLInputElement).checked }); return true; }
  const key = t.dataset?.setting as keyof Settings | undefined;
  if (!key) return false;
  const el = t as HTMLInputElement;
  const value = el.type === "checkbox" ? el.checked : el.value;
  o.send({ type: "settings", patch: { [key]: value } as Partial<Settings> });
  return true;
}
