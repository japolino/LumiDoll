// Warp's public scene state (the warp-state-v1 window event), read defensively.
// Warp publishes it whenever its state for the open chat changes and when asked
// with warp-state-request-v1. LumiDoll works the same without it.

export const WARP_STATE = "warp-state-v1";
export const WARP_STATE_REQUEST = "warp-state-request-v1";

export interface WarpPerson { id: string; name: string; present: boolean; appearance?: string; outfit?: string; bands?: Record<string, string> }

export interface WarpStateV1 {
  version: 1;
  provider: "warp";
  chatId: string | null;
  messageId: string | null;
  time?: { label: string; day: number; hour: number; minute: number };
  place?: string | null;
  you: { name: string; appearance?: string; outfit?: string; items?: string[] };
  people: WarpPerson[];
  meters?: { id: string; label: string; band: string }[];
}

const text = (v: unknown, max = 600) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");
const opt = (v: unknown, max = 600) => { const t = text(v, max); return t ? t : undefined; };

/** A Warp state event's detail, checked; null when it isn't one. */
export function cleanWarpState(detail: unknown): WarpStateV1 | null {
  if (!detail || typeof detail !== "object") return null;
  const d = detail as Record<string, unknown>;
  if (d.version !== 1 || d.provider !== "warp") return null;
  const you = (d.you && typeof d.you === "object" ? d.you : {}) as Record<string, unknown>;
  const people = (Array.isArray(d.people) ? d.people : [])
    .filter((p): p is Record<string, unknown> => !!p && typeof p === "object")
    .map((p) => ({ id: text(p.id, 80), name: text(p.name, 80), present: p.present === true, appearance: opt(p.appearance), outfit: opt(p.outfit) }))
    .filter((p) => p.name)
    .slice(0, 40);
  return {
    version: 1,
    provider: "warp",
    chatId: typeof d.chatId === "string" ? d.chatId : null,
    messageId: typeof d.messageId === "string" ? d.messageId : null,
    place: typeof d.place === "string" ? d.place : null,
    you: { name: text(you.name, 80), appearance: opt(you.appearance), outfit: opt(you.outfit) },
    people,
  };
}

/** Warp is running a game in this chat (it knows people or what you wear), so LumiDoll follows it instead of reading the story itself. */
export const warpDrives = (s: WarpStateV1 | null | undefined): boolean => !!s && (s.people.length > 0 || !!s.you.appearance || !!s.you.outfit);

/** The people Warp says are with the player. */
export const hereOf = (s: WarpStateV1): string[] => s.people.filter((p) => p.present).map((p) => p.name);

export interface LookText { appearance: string; outfit: string }

/** Warp's words for the player ("you") or someone by name. */
export function textOf(s: WarpStateV1, who: string): LookText {
  const key = (n: string) => n.replace(/\s+/g, " ").trim().toLowerCase();
  const p = who === "you" ? s.you : s.people.find((x) => key(x.name) === key(who));
  return { appearance: p?.appearance ?? "", outfit: p?.outfit ?? "" };
}

/** Which parts of someone's text changed since it was last seen (nothing seen yet: whatever is there). */
export function changedParts(seen: LookText | undefined, now: LookText): ("appearance" | "outfit")[] {
  const out: ("appearance" | "outfit")[] = [];
  for (const k of ["appearance", "outfit"] as const) if (now[k] && now[k] !== (seen?.[k] ?? "")) out.push(k);
  return out;
}
