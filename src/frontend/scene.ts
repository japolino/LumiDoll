// Each chat's dolls, and who the "With you" doll shows. Pure, so it can be
// tested without a page.

import { cleanLook } from "../doll/outfits.js";
import type { Look } from "../doll/render.js";
import { castKey, okName } from "../shared/names.js";
import type { LookText } from "../shared/warp-state.js";

export type Who = "you" | "them";

export interface CastEntry { name: string; look: Look; note: string; at: number }

/** One chat's dolls. */
export interface ChatDolls {
  you: Look;
  /** The look being edited on the second tab (whoever `themName` is). */
  them: Look;
  themName: string;
  who: Who;
  notes: Record<Who, string>;
  /** Everyone the chat has dressed, by lowercased name. */
  cast: Record<string, CastEntry>;
  /** The person the player pinned to the "With you" doll (shown while they're here). */
  pin: string;
  /** Who the latest reply was about. */
  focus: string;
  /** The last reply the dolls were updated for. */
  lastAuto: string;
  /** People already dressed automatically once (a failed first look isn't retried every reply). */
  asked: string[];
  /** Warp's words last acted on, per person ("you" or a lowercased name): a re-dress happens only when they change. */
  warpSeen: Record<string, LookText>;
}

/** What the status window shows. */
export interface DollPrefs { hud: boolean; scene: boolean }

export const MAX_CAST = 16;
export const MAX_CHATS = 40;

const str = (v: unknown, max = 80) => (typeof v === "string" ? v.slice(0, max) : "");

export function cleanPrefs(v: unknown): DollPrefs {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  return { hud: o.hud !== false, scene: o.scene !== false };
}

function cleanSeen(v: unknown): Record<string, LookText> {
  const out: Record<string, LookText> = {};
  if (!v || typeof v !== "object" || Array.isArray(v)) return out;
  for (const [k, x] of Object.entries(v as Record<string, unknown>).slice(0, MAX_CAST + 1)) {
    if (!okName(k) || !x || typeof x !== "object") continue;
    const t = x as Record<string, unknown>;
    out[k] = { appearance: str(t.appearance, 600), outfit: str(t.outfit, 600) };
  }
  return out;
}

/** A chat's saved dolls, made safe; `seed` fills in a chat that has none. */
export function cleanChat(v: unknown, seed: { you: Look; them: Look }): ChatDolls {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  const notes = (o.notes && typeof o.notes === "object" ? o.notes : {}) as Record<string, unknown>;
  const cast: Record<string, CastEntry> = {};
  const rawCast = (o.cast && typeof o.cast === "object" && !Array.isArray(o.cast) ? o.cast : {}) as Record<string, unknown>;
  const entries = Object.values(rawCast)
    .filter((e): e is Record<string, unknown> => !!e && typeof e === "object" && typeof (e as Record<string, unknown>).name === "string" && !!(e as Record<string, unknown>).look)
    .map((e) => ({ name: str(e.name).trim(), look: cleanLook(e.look), note: str(e.note, 400), at: Number.isFinite(e.at) ? Number(e.at) : 0 }))
    .filter((e) => okName(e.name))
    .sort((a, b) => b.at - a.at)
    .slice(0, MAX_CAST);
  for (const e of entries) cast[castKey(e.name)] = e;
  return {
    you: o.you ? cleanLook(o.you) : cleanLook(seed.you),
    them: o.them ? cleanLook(o.them) : cleanLook(seed.them),
    themName: str(o.themName),
    who: o.who === "them" ? "them" : "you",
    notes: { you: str(notes.you, 400), them: str(notes.them, 400) },
    cast,
    pin: str(o.pin),
    focus: str(o.focus),
    lastAuto: str(o.lastAuto, 200),
    asked: Array.isArray(o.asked) ? o.asked.filter((x): x is string => typeof x === "string").slice(-MAX_CAST) : [],
    warpSeen: cleanSeen(o.warpSeen),
  };
}

/** Store someone's look in the cast, keeping it to the most recent few. */
export function putCast(c: ChatDolls, name: string, look: Look, note: string, at: number) {
  if (!okName(name)) return;
  c.cast[castKey(name)] = { name: name.replace(/\s+/g, " ").trim().slice(0, 80), look, note: note.slice(0, 400), at };
  const keys = Object.keys(c.cast).sort((a, b) => c.cast[b].at - c.cast[a].at);
  for (const old of keys.slice(MAX_CAST)) delete c.cast[old];
}

/** Who the "With you" doll shows: the pinned person while they're here, else who the story is about, else the first one here. */
export function sceneFocus(here: string[], pin: string, focus: string): string | null {
  const find = (n: string) => (n ? here.find((h) => castKey(h) === castKey(n)) : undefined);
  return find(pin) ?? find(focus) ?? here[0] ?? null;
}

/** Keep the list of chats with saved dolls short: returns the new list and the chats to forget. */
export function touchChat(list: string[], chatId: string, max = MAX_CHATS): { list: string[]; drop: string[] } {
  const next = [chatId, ...list.filter((x) => x !== chatId)];
  return { list: next.slice(0, max), drop: next.slice(max) };
}
