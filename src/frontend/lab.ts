// The LumiDoll tab: a preview with every control, the buttons that dress it from the
// card, the persona, a description or the latest story, and the logic that keeps
// each chat's dolls following the story (on its own, or through Warp).

import { PRESETS, type Sex } from "../doll/body.js";
import { EARS, EXPRESSIONS, HAIR_STYLES, HORNS, TAILS } from "../doll/features.js";
import { FITS, type Garment, HEMS, type Kind, KINDS, LENGTHS, MATERIALS, NECKLINES, PATTERNS, SLEEVE_FITS, SLEEVES, STYLES } from "../doll/garments.js";
import { cleanLook, defaultLook, HAIR_COLOURS, MAX_GARMENTS, OUTFITS, outfitFor, SKINS } from "../doll/outfits.js";
import { type Look, renderDoll as draw } from "../doll/render.js";
import { castKey, focusFrom, uniqueNames } from "../shared/names.js";
import { type ChatInfo, DEFAULT_SETTINGS, type DollLookMsg, type DollRequest, type FrontendToBackend, type Settings, type WarpText } from "../shared/protocol.js";
import { changedParts, hereOf, textOf, warpDrives, type WarpStateV1 } from "../shared/warp-state.js";
import { type ChatDolls, cleanChat, cleanPrefs, type DollPrefs, putCast, sceneFocus, touchChat, type Who } from "./scene.js";
import { handleSettings, renderSettings, type SettingsView } from "./settings-ui.js";

/** Never let one bad look take the panel down with it. */
function renderDoll(look: Look, opts: { id?: string } = {}): string {
  try { return draw(look, opts); } catch (e) {
    console.error("[doll]", e);
    return `<p class="doll-dim">This look couldn't be drawn. Change a garment, or pick a ready-made outfit.</p>`;
  }
}

const KEY = "doll:last";
const CHAT_KEY = (id: string) => `doll:chat:${id}`;
const CHATS_KEY = "doll:chats";
/** Where Warp kept the dolls before LumiDoll was its own extension: read once, never written. */
const OLD_KEY = "warp:doll";
const OLD_CHAT_KEY = (id: string) => `warp:doll:chat:${id}`;

/** What the helper filled in on its own ("Guessed: …", "Made up: …") isn't worth showing; errors and changes are. */
export const shownNote = (n: string | undefined) => (!n || /^(Guessed|Made up):/i.test(n.trim()) ? "" : n);
export const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Which fields mean something for each kind of garment. */
const FIELDS: Record<Kind, (keyof Garment)[]> = {
  top: ["neckline", "sleeves", "sleeveFit", "hem", "fit", "material"],
  dress: ["neckline", "sleeves", "sleeveFit", "length", "flare", "fit", "material"],
  robe: ["neckline", "sleeves", "sleeveFit", "length", "flare", "material"],
  outer: ["style", "neckline", "sleeves", "sleeveFit", "hem", "length", "open", "material"],
  cape: ["length"],
  armor: ["neckline", "sleeves", "hem", "material"],
  bottom: ["style", "length", "fit", "rise", "material"],
  skirt: ["length", "flare", "rise"],
  legwear: ["style", "length", "material"],
  shoes: ["style", "length", "material"],
  gloves: ["style", "sleeves", "material"],
  sleeves: ["sleeves", "sleeveFit"],
  hat: ["style"],
  neck: ["style"],
  belt: ["rise"],
  sash: [],
  apron: ["length"],
  bra: [],
  briefs: [],
};
const OPTIONS: Partial<Record<keyof Garment, readonly string[]>> = {
  neckline: NECKLINES, sleeves: SLEEVES, sleeveFit: SLEEVE_FITS, hem: HEMS, length: LENGTHS, fit: FITS, material: MATERIALS, rise: ["high", "mid", "low"],
};

const read = (k: string): unknown => { try { return JSON.parse(localStorage.getItem(k) ?? "null"); } catch { return null; } };
const write = (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* full */ } };

/** The starting looks for a chat that has none: the last ones used anywhere (or the defaults). */
function seed(): { you: Look; them: Look } {
  const v = (read(KEY) ?? read(OLD_KEY)) as Record<string, unknown> | null;
  if (v && typeof v === "object" && v.you) return { you: cleanLook(v.you), them: cleanLook(v.them ?? { body: { sex: "f", preset: "curvy" } }) };
  const them = defaultLook("f");
  them.body.preset = "curvy"; them.hair = { style: "twintails", colour: "#e8c26a", length: 0.7 }; them.eyes = "#2f8f6f"; them.ears = "cat"; them.outfit = outfitFor("street", "f");
  return { you: defaultLook("f"), them };
}

export interface Section { title: string; body: string }

export interface DollLab {
  html(): string;
  /** Handle an event in the drawer or the status window; true when it was ours. */
  handle(e: Event, root: HTMLElement): boolean;
  onLook(m: DollLookMsg): void;
  /** Who a reply is about (Jev's answer, or the pin); dressing = their first look is on its way. */
  onFocus(m: { chatId: string; name: string | null; dressing?: boolean }): void;
  /** A reply finished: who it's about, and (without Warp) what it changed. */
  onReply(m: { chatId: string; messageId: string; text: string }): void;
  /** Warp's scene state: re-dress whoever's words changed. */
  onWarp(s: WarpStateV1): void;
  onChat(info: ChatInfo): void;
  onSettings(v: SettingsView): void;
  /** The player's doll for the status window (null when turned off). */
  hudSection(): Section | null;
  /** The doll of whoever is with the player (null when turned off). */
  sceneSection(): Section | null;
  /** The look being edited. */
  current(): Look;
  /** Do the dolls follow the story on their own right now? */
  autoOn(): boolean;
}

export function createDollLab(o: {
  send(m: FrontendToBackend): void; chatId(): string | null; changed(): void;
  /** Run a little later (Warp gets a moment to say who's here before anyone is dressed without it). */
  later?(fn: () => void): void;
}): DollLab {
  const later = o.later ?? ((fn: () => void) => { setTimeout(fn, 1500); });
  const prefs: DollPrefs = cleanPrefs(read(KEY) ?? read(OLD_KEY));
  let view: "dolls" | "settings" = "dolls";
  let sv: SettingsView = { settings: { ...DEFAULT_SETTINGS }, jevKeySet: false, jevReady: false, connections: [] };
  let chat: ChatInfo = { chatId: null, character: null, user: "" };
  const warps = new Map<string, WarpStateV1>();
  /** Whose dolls are loaded: each chat keeps its own. */
  let loadedFor: string | null = null;
  let st: ChatDolls = cleanChat(null, seed());
  /** Requests out, by chat and person ("chat|you", "chat|rhea"). */
  const busy = new Set<string>();
  const busyKey = (who: string, c = loadedFor) => `${c ?? ""}|${who === "you" ? "you" : castKey(who)}`;
  let text = "";
  /** The "As data" box's text when it didn't parse, so a typo doesn't wipe it. */
  let jsonDraft: string | null = null;

  /** Switch to the open chat's dolls. */
  function ensure() {
    const id = o.chatId();
    if (id === loadedFor) return;
    loadedFor = id;
    st = cleanChat(id ? read(CHAT_KEY(id)) ?? read(OLD_CHAT_KEY(id)) : null, seed());
    jsonDraft = null;
  }
  function saveChat(id: string | null, c: ChatDolls) {
    if (id) {
      write(CHAT_KEY(id), c);
      const { list, drop } = touchChat(Array.isArray(read(CHATS_KEY)) ? (read(CHATS_KEY) as unknown[]).filter((x): x is string => typeof x === "string") : [], id);
      write(CHATS_KEY, list);
      for (const d of drop) { try { localStorage.removeItem(CHAT_KEY(d)); } catch { /* gone */ } }
    }
    // The latest looks seed the next new chat; the preferences are global.
    write(KEY, { ...prefs, you: c.you, them: c.them });
  }
  const save = () => {
    // Whoever is on the second tab is part of the chat's cast, so the "With you" doll shows edits made there.
    if (st.themName.trim()) putCast(st, st.themName, st.them, st.notes.them, Date.now());
    saveChat(loadedFor, st);
  };
  const cur = () => (st.who === "you" ? st.you : st.them);
  const autoOn = () => sv.settings.follow === "always" || (sv.settings.follow === "jev" && sv.jevReady);
  /** Warp's state for the loaded chat, when Warp is running a game in it. */
  const warp = (): WarpStateV1 | null => { const w = loadedFor ? warps.get(loadedFor) : undefined; return w && warpDrives(w) ? w : null; };
  /** Warp's words for someone, to send along with a request. */
  const warpText = (who: string): WarpText | undefined => {
    const w = warp();
    if (!w) return undefined;
    const t = textOf(w, who);
    return t.appearance || t.outfit ? { ...(t.appearance ? { appearance: t.appearance } : {}), ...(t.outfit ? { outfit: t.outfit } : {}) } : undefined;
  };
  /** The people the "With you" doll can show: Warp's people here; without Warp, the card's character and everyone this chat has dressed. */
  function here(): string[] {
    const w = warp();
    if (w) return hereOf(w);
    const user = castKey(chat.chatId === loadedFor ? chat.user : "");
    const names = [chat.chatId === loadedFor ? chat.character ?? "" : "", ...Object.values(st.cast).sort((a, b) => b.at - a.at).map((c) => c.name)];
    return uniqueNames(names).filter((n) => castKey(n) !== user);
  }

  const sel = (path: string, value: string, opts: readonly string[], labels?: (x: string) => string, none?: string) =>
    `<select class="doll-input" data-doll-set="${path}">${none !== undefined ? `<option value=""${value ? "" : " selected"}>${esc(none)}</option>` : ""}${opts.map((x) => `<option value="${esc(x)}"${x === value ? " selected" : ""}>${esc(labels ? labels(x) : cap(x))}</option>`).join("")}</select>`;
  const colour = (path: string, value: string) => `<input type="color" class="doll-colour" data-doll-set="${path}" value="${esc(value)}">`;
  const swatches = (path: string, list: string[], value: string) => `<div class="doll-swatches">${list.map((c) => `<button class="doll-swatch${c === value ? " on" : ""}" style="background:${c}" data-doll-pick="${path}" data-value="${c}" title="${c}"></button>`).join("")}${colour(path, value)}</div>`;
  const range = (path: string, value: number, min: number, max: number, step: number) => `<input type="range" class="doll-range" data-doll-set="${path}" min="${min}" max="${max}" step="${step}" value="${value}">`;
  const row = (label: string, ctl: string) => `<label class="doll-row"><span>${esc(label)}</span>${ctl}</label>`;

  function garmentRow(g: Garment, i: number): string {
    const fields = FIELDS[g.kind].map((k) => {
      if (k === "style") return STYLES[g.kind] ? row("Style", sel(`outfit.${i}.style`, g.style ?? "", STYLES[g.kind]!, undefined, "default")) : "";
      if (k === "flare") return row("Flare", range(`outfit.${i}.flare`, g.flare ?? 0.4, 0, 1, 0.05));
      if (k === "open") return row("Open front", `<input type="checkbox" data-doll-set="outfit.${i}.open"${g.open ?? g.style !== "hoodie" ? " checked" : ""}>`);
      const opts = OPTIONS[k];
      return opts ? row(cap(k === "sleeveFit" ? "sleeve fit" : k), sel(`outfit.${i}.${k}`, String(g[k] ?? ""), opts, undefined, "default")) : "";
    }).join("");
    return `<details class="doll-garment" data-doll-g="${i}" data-section="doll-g-${i}">
      <summary>${colour(`outfit.${i}.colour`, g.colour)}<span class="doll-gname">${esc(g.label ?? cap(g.kind))}</span><span class="doll-dim">${esc(g.kind)}</span><button class="doll-btn doll-x" data-doll-del="${i}" title="Take it off">×</button></summary>
      <div class="doll-fields">
        ${row("Name", `<input class="doll-input" data-doll-set="outfit.${i}.label" value="${esc(g.label ?? "")}" placeholder="${esc(cap(g.kind))}">`)}
        ${row("Pattern", `<span class="doll-pair">${sel(`outfit.${i}.pattern`, g.pattern ?? "none", PATTERNS)}${colour(`outfit.${i}.patternColour`, g.patternColour ?? "#1d1a22")}</span>`)}
        ${row("Trim", colour(`outfit.${i}.colour2`, g.colour2 ?? "#c9a54a"))}
        ${fields}
        ${row("Wear and tear", range(`outfit.${i}.damage`, g.damage ?? 0, 0, 1, 0.05))}
      </div>
    </details>`;
  }

  function dollsHtml(): string {
    const L = cur();
    const sex = L.body.sex;
    const presets = Object.entries(PRESETS[sex]);
    const w = warp();
    const people = uniqueNames([...here(), ...(w ? w.people.map((p) => p.name) : [])]);
    const who = st.who;
    const target = who === "you" ? "you" : st.themName.trim() || "them";
    const isBusy = busy.has(busyKey(target));
    const fromWarp = target !== "them" && !!warpText(target);
    return `<div class="doll-lab">
      <div class="doll-who" role="tablist">
        <button class="doll-tab" data-doll-who="you" aria-selected="${who === "you"}">You</button>
        <button class="doll-tab" data-doll-who="them" data-doll-them-tab aria-selected="${who === "them"}">${esc(st.themName.trim() || "Someone else")}</button>
      </div>
      <div class="doll-stage" data-doll-stage>${renderDoll(L, { id: `lab${who}` })}</div>
      ${shownNote(st.notes[who]) ? `<p class="doll-dim doll-note">${esc(shownNote(st.notes[who]))}</p>` : ""}
      <div class="doll-card doll-helper">
        <h3>Dress it</h3>
        ${who === "them" ? row("Who", `<input class="doll-input" list="doll-people" data-doll-name value="${esc(st.themName)}" placeholder="A name from the story"><datalist id="doll-people">${people.map((p) => `<option value="${esc(p)}">`).join("")}</datalist>`) : ""}
        <div class="doll-buttons">
          <button class="doll-btn doll-btn-primary" data-doll-ask="profile"${isBusy ? " disabled" : ""} title="${who === "you" ? "Reads your persona" : "Reads the card, the lorebook and how the story has shown them"}">${who === "you" ? "From my persona" : "From card & lorebook"}</button>
          <button class="doll-btn" data-doll-ask="story"${isBusy ? " disabled" : ""} title="Changes only what the latest replies changed">Update from story</button>
          ${fromWarp ? `<button class="doll-btn" data-doll-ask="warp"${isBusy ? " disabled" : ""} title="Dresses them as Warp describes them now">Match Warp</button>` : ""}
        </div>
        <textarea class="doll-input doll-text" data-doll-text rows="2" placeholder="Or describe it: a fox girl in a blue yukata with a torn sleeve…">${esc(text)}</textarea>
        <button class="doll-btn" data-doll-ask="text"${isBusy ? " disabled" : ""}>Dress from description</button>
        ${isBusy ? `<p class="doll-dim">Asking ${sv.jevReady ? "Jev" : "the helper"}…</p>` : ""}
      </div>
      <details class="doll-section" data-section="doll-body" open><summary>Body</summary>
        ${row("Sex", sel("body.sex", sex, ["f", "m"], (x) => (x === "f" ? "Female" : "Male")))}
        ${row("Build", `<div class="doll-chips">${presets.map(([k, p]) => `<button class="doll-btn${L.body.preset === k ? " doll-btn-primary" : ""}" data-doll-pick="body.preset" data-value="${k}">${esc(p.label)}</button>`).join("")}</div>`)}
        ${row("Blend toward", sel("body.blend.preset", L.body.blend?.preset ?? "", presets.map(([k]) => k), (x) => PRESETS[sex][x].label, "nothing"))}
        ${L.body.blend ? row("Blend", range("body.blend.amount", L.body.blend.amount, 0, 1, 0.05)) : ""}
        ${row("Height", range("body.height", L.body.height ?? 1, 0.85, 1.15, 0.01))}
        ${row("Skin", swatches("skin", SKINS, L.skin))}
      </details>
      <details class="doll-section" data-section="doll-head"><summary>Hair &amp; face</summary>
        ${row("Hair", sel("hair.style", L.hair.style, HAIR_STYLES))}
        ${row("Length", range("hair.length", L.hair.length ?? 0.6, 0, 1, 0.05))}
        ${row("Colour", swatches("hair.colour", HAIR_COLOURS, L.hair.colour))}
        ${row("Eyes", colour("eyes", L.eyes))}
        ${row("Expression", sel("expression", L.expression ?? "neutral", EXPRESSIONS))}
      </details>
      <details class="doll-section" data-section="doll-extra"><summary>Ears, tail, horns</summary>
        ${row("Ears", `<span class="doll-pair">${sel("ears", L.ears ?? "", EARS, undefined, "human")}${colour("earColour", L.earColour ?? L.hair.colour)}</span>`)}
        ${row("Tail", `<span class="doll-pair">${sel("tail", L.tail ?? "", TAILS, undefined, "none")}${colour("tailColour", L.tailColour ?? L.hair.colour)}</span>`)}
        ${row("Horns", sel("horns", L.horns ?? "", HORNS, undefined, "none"))}
      </details>
      <details class="doll-section" data-section="doll-outfit" open><summary>Outfit · ${L.outfit.length}</summary>
        ${row("Ready-made", `<select class="doll-input" data-doll-outfit><option value="">Pick one…</option>${Object.entries(OUTFITS).map(([k, x]) => `<option value="${k}">${esc(x.label)}</option>`).join("")}<option value="none">Nothing</option></select>`)}
        <div class="doll-garments">${L.outfit.map(garmentRow).join("")}</div>
        ${L.outfit.length >= MAX_GARMENTS ? `<p class="doll-dim">That's as many layers as the doll can wear.</p>` : row("Add", `<select class="doll-input" data-doll-add><option value="">A garment…</option>${KINDS.map((k) => `<option value="${k}">${cap(k)}</option>`).join("")}</select>`)}
        <label class="doll-row"><span>Underwear when bare</span><input type="checkbox" data-doll-set="modest"${L.modest === false ? "" : " checked"}></label>
      </details>
      <details class="doll-section" data-section="doll-json"><summary>As data</summary>
        <p class="doll-dim">The look the helper writes and the chat saves. Edit and apply, or paste one in.</p>
        <textarea class="doll-input doll-json" data-doll-json rows="8">${esc(jsonDraft ?? JSON.stringify(L, null, 1))}</textarea>
        <button class="doll-btn" data-doll-json-apply>Apply</button>
      </details>
    </div>`;
  }

  function html(): string {
    ensure();
    const tabs = `<div class="doll-tabs" role="tablist"><button class="doll-tab" data-doll-view="dolls" aria-selected="${view === "dolls"}">Dolls</button><button class="doll-tab" data-doll-view="settings" aria-selected="${view === "settings"}">Settings</button></div>`;
    return tabs + (view === "settings" ? renderSettings(sv, prefs, !!warp()) : dollsHtml());
  }

  const BAD_KEYS = new Set(["__proto__", "constructor", "prototype"]);
  const NUMERIC = new Set(["amount", "height", "flare", "damage"]);

  function setPath(L: Look, path: string, v: string | boolean) {
    const parts = path.split(".");
    if (parts.some((k) => BAD_KEYS.has(k))) return;
    if (path === "body.sex") {
      const sex: Sex = v === "m" ? "m" : "f";
      const from = Object.keys(PRESETS[L.body.sex]), to = Object.keys(PRESETS[sex]);
      // Same position in the list (slim stays slim); height and blend carry over.
      const map = (p: string) => to[Math.max(0, from.indexOf(p))] ?? to[0];
      L.body = { sex, preset: map(L.body.preset), ...(L.body.height ? { height: L.body.height } : {}), ...(L.body.blend ? { blend: { preset: map(L.body.blend.preset), amount: L.body.blend.amount } } : {}) };
      return;
    }
    if (path === "body.blend.preset") { L.body.blend = v ? { preset: String(v), amount: L.body.blend?.amount ?? 0.5 } : undefined; return; }
    if (path === "modest") { L.modest = v ? undefined : false; return; }
    const last = parts[parts.length - 1];
    let x: unknown = v;
    if (typeof v === "string") {
      if (v === "") x = undefined;
      else if (NUMERIC.has(last) || (last === "length" && parts[0] === "hair")) { const n = Number(v); x = Number.isFinite(n) ? n : undefined; }
    }
    let obj: Record<string, unknown> = L as unknown as Record<string, unknown>;
    for (let i = 0; i < parts.length - 1; i++) {
      const k = parts[i];
      const next = Array.isArray(obj) ? (obj as unknown[])[Number(k)] : Object.prototype.hasOwnProperty.call(obj, k) ? obj[k] : undefined;
      if (!next || typeof next !== "object") return;
      obj = next as Record<string, unknown>;
    }
    if (x === undefined || (last === "pattern" && x === "none")) delete obj[last];
    else obj[last] = x;
    if (["ears", "tail", "horns"].includes(path) && x === undefined) (L as unknown as Record<string, unknown>)[path] = null;
  }

  /** Redraw just the doll (while dragging a slider), or everything. */
  function refresh(root: HTMLElement, full: boolean) {
    // Keep the saved look drawable whatever was just edited (a cleared colour, a stray value).
    st[st.who] = cleanLook(st[st.who]);
    save();
    if (full) { o.changed(); return; }
    const stage = root.querySelector<HTMLElement>("[data-doll-stage]");
    if (stage) stage.innerHTML = renderDoll(cur(), { id: `lab${st.who}` });
  }

  function ask(source: DollRequest["source"]) {
    const who = st.who;
    if (who === "them" && source === "profile" && !st.themName.trim()) { st.notes.them = "Type their name first."; o.changed(); return; }
    const target = who === "you" ? "you" : st.themName.trim() || "them";
    if (source === "warp") {
      const t = warpText(target);
      if (!t) return;
      if (target !== "them") st.warpSeen[target === "you" ? "you" : castKey(target)] = { appearance: t.appearance ?? "", outfit: t.outfit ?? "" };
      request(target, "warp", cur(), false, { ...t, changed: ["appearance", "outfit"] });
    } else request(target, source, cur(), false);
    o.changed();
  }

  /** Send one request (never two at once for the same person). Warp's words go along with every first look. */
  function request(who: string, source: DollRequest["source"], current: Look | undefined, auto: boolean, warpWords?: WarpText): boolean {
    const k = busyKey(who);
    if (busy.has(k)) return false;
    busy.add(k);
    const words = warpWords ?? (source === "profile" && who !== "them" ? warpText(who) : undefined);
    o.send({
      type: "doll_look", chatId: loadedFor, who, source,
      ...(source === "text" ? { text } : {}),
      ...(source === "story" || source === "warp" ? { current } : {}),
      ...(words ? { warp: words } : {}),
      ...(auto ? { auto: true } : {}),
    });
    return true;
  }

  function handle(e: Event, root: HTMLElement): boolean {
    const t = e.target as HTMLElement;
    ensure();
    // The "With you" doll in the status window.
    if (t.closest?.(".doll-scene")) {
      if (e.type !== "click") return false;
      const b = t.closest<HTMLElement>("[data-doll-focus],[data-doll-edit],[data-doll-scene-ask]");
      if (!b) return false;
      if (b.dataset.dollFocus !== undefined) {
        e.preventDefault();
        const n = b.dataset.dollFocus;
        st.pin = castKey(st.pin) === castKey(n) ? "" : n;
        save(); o.changed(); return true;
      }
      if (b.dataset.dollSceneAsk) {
        e.preventDefault();
        const n = b.dataset.dollSceneAsk;
        if (!st.asked.includes(castKey(n))) st.asked.push(castKey(n));
        request(n, "profile", undefined, false); save(); o.changed(); return true;
      }
      // "Edit": open their doll in the drawer (the page switches to the LumiDoll tab itself).
      const n = b.dataset.dollEdit ?? "";
      if (n) {
        if (st.themName.trim()) putCast(st, st.themName, st.them, st.notes.them, Date.now());
        const c = st.cast[castKey(n)];
        st.who = n === "you" ? "you" : "them"; view = "dolls"; jsonDraft = null;
        if (n !== "you") { st.themName = n; if (c) { st.them = c.look; st.notes.them = c.note; } }
        save();
      }
      return false;
    }
    if (e.type === "click") {
      const v = t.closest?.<HTMLElement>("[data-doll-view]");
      if (v) { e.preventDefault(); view = v.dataset.dollView === "settings" ? "settings" : "dolls"; o.changed(); return true; }
    }
    if (t.closest?.(".doll-settings")) {
      return handleSettings(e, root, {
        send: o.send,
        prefs: (p) => { Object.assign(prefs, p); saveChat(loadedFor, st); o.changed(); },
      });
    }
    if (!t.closest?.(".doll-lab")) return false;
    const L = cur();
    if (e.type === "click") {
      const b = t.closest<HTMLElement>("[data-doll-who],[data-doll-pick],[data-doll-del],[data-doll-ask],[data-doll-json-apply]");
      // Anything else (a section opening, a checkbox) is left to the browser.
      if (!b) return false;
      e.preventDefault();
      if (b.dataset.dollWho) { if (b.dataset.dollWho === "you" || b.dataset.dollWho === "them") { st.who = b.dataset.dollWho; jsonDraft = null; refresh(root, true); } }
      else if (b.dataset.dollPick) { setPath(L, b.dataset.dollPick, b.dataset.value ?? ""); refresh(root, true); }
      else if (b.dataset.dollDel) { const i = Number(b.dataset.dollDel); if (Number.isInteger(i) && i >= 0 && i < L.outfit.length) { L.outfit.splice(i, 1); refresh(root, true); } }
      else if (b.dataset.dollAsk) { const s = b.dataset.dollAsk; if (s === "profile" || s === "story" || s === "text" || s === "warp") ask(s); }
      else if (b.hasAttribute("data-doll-json-apply")) {
        const ta = root.querySelector<HTMLTextAreaElement>("[data-doll-json]");
        try { st[st.who] = cleanLook(JSON.parse(ta?.value ?? "")); st.notes[st.who] = ""; jsonDraft = null; }
        catch { jsonDraft = ta?.value ?? ""; st.notes[st.who] = "That isn't valid JSON. Fix it and apply again."; }
        refresh(root, true);
      }
      return true;
    }
    if (t.matches("[data-doll-text]")) { text = (t as HTMLTextAreaElement).value; return true; }
    if (t.matches("[data-doll-name]")) {
      const prev = st.themName;
      st.themName = (t as HTMLInputElement).value.slice(0, 80);
      // Settled on someone this chat has already dressed: show theirs.
      const known = st.cast[castKey(st.themName)];
      if (e.type === "change" && known && castKey(prev) !== castKey(st.themName)) { st.them = known.look; st.notes.them = known.note; jsonDraft = null; refresh(root, true); return true; }
      if (e.type === "change") save();
      const tab = root.querySelector<HTMLElement>("[data-doll-them-tab]");
      if (tab) tab.textContent = st.themName.trim() || "Someone else";
      return true;
    }
    if (t.matches("[data-doll-json]")) { jsonDraft = (t as HTMLTextAreaElement).value; return true; }
    if (t.matches("[data-doll-outfit]") && e.type === "change") {
      const k = (t as HTMLSelectElement).value;
      if (k && (k === "none" || OUTFITS[k])) { L.outfit = k === "none" ? [] : outfitFor(k, L.body.sex); refresh(root, true); }
      return true;
    }
    if (t.matches("[data-doll-add]") && e.type === "change") {
      const k = (t as HTMLSelectElement).value as Kind;
      if ((KINDS as readonly string[]).includes(k) && L.outfit.length < MAX_GARMENTS) { L.outfit.push({ kind: k, colour: "#5a6a8a" }); refresh(root, true); }
      return true;
    }
    const path = t.dataset?.dollSet;
    if (path) {
      const v = (t as HTMLInputElement).type === "checkbox" ? (t as HTMLInputElement).checked : (t as HTMLInputElement).value;
      setPath(L, path, v);
      // Sliders and colour wheels redraw live; picking from a list rebuilds the tab.
      const live = (t as HTMLInputElement).type === "range" || (t as HTMLInputElement).type === "color";
      if (e.type === "input" && live) refresh(root, false);
      else if (e.type === "change") refresh(root, !live || path.startsWith("body.blend"));
      return true;
    }
    return false;
  }

  /** Put a look where it belongs (in the chat it was asked for, even if another is open now). */
  function apply(c: ChatDolls, m: DollLookMsg) {
    const at = Date.now();
    const failed = m.error ? `${sv.jevReady ? "Jev and the helper" : "The helper"} couldn't do it: ${m.error}` : "";
    if (m.who === "you") {
      if (m.look) {
        const look = cleanLook(m.look);
        const changed = JSON.stringify(look) !== JSON.stringify(c.you);
        c.you = look;
        if (!m.auto || changed) c.notes.you = m.note;
      } else if (!m.auto) c.notes.you = failed;
      return;
    }
    if (m.who === "them") {
      // Asked without a name: only the second tab's look.
      if (m.look) { c.them = cleanLook(m.look); c.notes.them = m.note; }
      else c.notes.them = failed;
      return;
    }
    const k = castKey(m.who);
    const onTab = castKey(c.themName) === k || (!c.themName.trim() && !m.auto);
    if (m.look) {
      const look = cleanLook(m.look);
      const before = c.cast[k];
      const changed = !before || JSON.stringify(look) !== JSON.stringify(before.look);
      const note = m.auto && !changed ? before?.note ?? "" : m.note;
      putCast(c, m.name && m.name !== "them" ? m.name : m.who, look, note, at);
      if (onTab) { c.them = look; c.notes.them = note; if (!c.themName.trim()) c.themName = m.name ?? m.who; }
    } else if (onTab && !m.auto) c.notes.them = failed;
  }

  function onLook(m: DollLookMsg) {
    ensure();
    const c = m.chatId === undefined ? loadedFor : m.chatId;
    busy.delete(busyKey(m.who, c));
    if (c === loadedFor) { apply(st, m); saveChat(loadedFor, st); }
    else if (c) { const other = cleanChat(read(CHAT_KEY(c)) ?? read(OLD_CHAT_KEY(c)), seed()); apply(other, m); write(CHAT_KEY(c), other); }
    // Warp's words may have changed while this person was busy.
    const w = loadedFor ? warps.get(loadedFor) : undefined;
    if (c === loadedFor && w) followWarp(w);
    o.changed();
  }

  function hudSection(): Section | null {
    if (!prefs.hud) return null;
    ensure();
    const name = chat.chatId === loadedFor && chat.user ? chat.user : "You";
    return { title: name, body: `<div class="doll-scene"><div class="doll-hud">${renderDoll(st.you, { id: "hud" })}</div><div class="doll-scene-foot"><span>${busy.has(busyKey("you")) ? `<span class="doll-dim">Updating…</span>` : ""}</span><button class="doll-btn" data-doll-edit="you" title="Open your doll in the LumiDoll tab">Edit</button></div></div>` };
  }

  function sceneSection(): Section | null {
    if (!prefs.scene) return null;
    ensure();
    const people = here();
    const who = sceneFocus(people, st.pin, st.focus);
    if (!who) {
      const hint = warp() ? "No one's with you right now." : "No one yet. Dress someone in the LumiDoll tab, or open a chat with a character.";
      return { title: "With you", body: `<div class="doll-scene"><p class="doll-dim">${hint}</p></div>` };
    }
    const entry = st.cast[castKey(who)];
    const pinned = castKey(st.pin) === castKey(who);
    const chips = people.length > 1
      ? `<div class="doll-scene-who">${people.map((n) => `<button class="doll-btn${castKey(n) === castKey(who) ? " doll-btn-primary" : ""}" data-doll-focus="${esc(n)}" title="${castKey(st.pin) === castKey(n) ? "Pinned: click to follow the story again" : "Show them (pinned while they're here)"}">${esc(n)}${castKey(st.pin) === castKey(n) ? " 📌" : ""}</button>`).join("")}</div>`
      : "";
    const isBusy = busy.has(busyKey(who));
    const doll = entry
      ? `<div class="doll-hud">${renderDoll(entry.look, { id: "scene" })}</div>`
      : `<p class="doll-dim">${isBusy ? `Dressing ${esc(who)}…` : `No look for ${esc(who)} yet.`}</p>${isBusy ? "" : `<button class="doll-btn" data-doll-scene-ask="${esc(who)}">Dress ${esc(who)}</button>`}`;
    const foot = `<div class="doll-scene-foot"><span>${entry && isBusy ? `<span class="doll-dim">Updating…</span>` : ""}</span><button class="doll-btn" data-doll-edit="${esc(who)}" title="Open their doll in the LumiDoll tab">Edit</button></div>`;
    return { title: `With you · ${who}${pinned ? " 📌" : ""}`, body: `<div class="doll-scene">${chips}${doll}${foot}</div>` };
  }

  /** Whoever the "With you" doll shows and has no look yet: dressed once, from their card (and Warp's words). */
  function dressNewcomer(): boolean {
    const who = prefs.scene ? sceneFocus(here(), st.pin, st.focus) : null;
    if (!who || st.cast[castKey(who)] || st.asked.includes(castKey(who)) || !autoOn()) return false;
    st.asked.push(castKey(who));
    st.asked = st.asked.slice(-16);
    const words = warpText(who);
    if (words) st.warpSeen[castKey(who)] = { appearance: words.appearance ?? "", outfit: words.outfit ?? "" };
    request(who, "profile", undefined, true);
    return true;
  }

  /** With Warp: re-dress whoever's appearance or outfit text changed since it was last acted on. No reading of the story. */
  function followWarp(w: WarpStateV1): boolean {
    if (!warpDrives(w) || w.chatId !== loadedFor || !autoOn()) return false;
    let dirty = false;
    const redress = (who: string, look: Look) => {
      const k = who === "you" ? "you" : castKey(who);
      const t = textOf(w, who);
      const parts = changedParts(st.warpSeen[k], t);
      if (!parts.length) return;
      if (request(who, "warp", look, true, { ...(t.appearance ? { appearance: t.appearance } : {}), ...(t.outfit ? { outfit: t.outfit } : {}), changed: parts })) {
        st.warpSeen[k] = t;
        dirty = true;
      }
    };
    if (prefs.hud) redress("you", st.you);
    if (prefs.scene) for (const name of hereOf(w)) { const e = st.cast[castKey(name)]; if (e) redress(name, e.look); }
    if (dressNewcomer()) dirty = true;
    if (dirty) saveChat(loadedFor, st);
    return dirty;
  }

  function onWarp(s: WarpStateV1) {
    if (!s.chatId) return;
    warps.set(s.chatId, s);
    ensure();
    if (s.chatId !== loadedFor) return;
    followWarp(s);
    o.changed();
  }

  function onReply(m: { chatId: string; messageId: string; text: string }) {
    ensure();
    if (m.chatId !== loadedFor || m.messageId === st.lastAuto) return;
    st.lastAuto = m.messageId;
    const people = here();
    const about = focusFrom(m.text, people);
    if (about) st.focus = about;
    saveChat(loadedFor, st);
    // With Warp, the dolls change when Warp's words change; nothing reads the story twice.
    if (!warp() && autoOn()) {
      const you = prefs.hud && !busy.has(busyKey("you"));
      const names = prefs.scene ? people : [];
      if (you || names.length) {
        if (you) busy.add(busyKey("you"));
        o.send({
          type: "doll_follow", chatId: m.chatId, messageId: m.messageId, people: names, pin: st.pin,
          you: you ? st.you : null,
          cast: names.filter((n) => st.cast[castKey(n)]).map((n) => ({ name: n, look: st.cast[castKey(n)].look })),
          asked: st.asked,
        });
      }
    }
    o.changed();
  }

  function onFocus(m: { chatId: string; name: string | null; dressing?: boolean }) {
    ensure();
    if (m.chatId !== loadedFor || !m.name) return;
    st.focus = m.name;
    if (m.dressing) {
      busy.add(busyKey(m.name));
      if (!st.asked.includes(castKey(m.name))) st.asked = [...st.asked, castKey(m.name)].slice(-16);
    }
    saveChat(loadedFor, st);
    o.changed();
  }

  /** Catch up: with Warp, its words; without, dress whoever is here (after Warp had a moment to speak up). */
  function catchUp() {
    const w = warp();
    if (w) { followWarp(w); return; }
    const forChat = loadedFor;
    later(() => {
      ensure();
      if (loadedFor !== forChat || warp()) return;
      if (dressNewcomer()) { saveChat(loadedFor, st); o.changed(); }
    });
  }

  function onChat(info: ChatInfo) {
    chat = info;
    ensure();
    if (info.chatId === loadedFor) catchUp();
    o.changed();
  }

  function onSettings(v: SettingsView) {
    const was = autoOn();
    sv = v;
    ensure();
    // Turning following on: catch up with Warp, or dress whoever is here.
    if (!was && autoOn()) catchUp();
    o.changed();
  }

  return { html, handle, onLook, onFocus, onReply, onWarp, onChat, onSettings, hudSection, sceneSection, autoOn, current: () => { ensure(); return cur(); } };
}
