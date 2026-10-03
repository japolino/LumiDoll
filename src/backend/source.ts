// What's known about someone: the card, lorebook entries about them, how the
// story has shown them. And the chat's messages, for the latest replies.

import type { CharacterDTO, WorldBookEntryDTO } from "lumiverse-spindle-types";
import { host } from "./host.js";

export interface Msg { id: string; is_user: boolean; content: string; index_in_chat: number; swipe_id?: number }

export async function getMessages(chatId: string): Promise<Msg[]> {
  const msgs = (await host().chat.getMessages(chatId)) as Msg[];
  return [...msgs].sort((a, b) => a.index_in_chat - b.index_in_chat);
}

const chatCharacter = new Map<string, string | null>();

export async function characterForChat(chatId: string, userId?: string): Promise<CharacterDTO | null> {
  let id = chatCharacter.get(chatId);
  if (id === undefined) {
    const chat = await host().chats.get(chatId, userId).catch(() => null);
    id = chat?.character_id || null;
    chatCharacter.set(chatId, id);
  }
  return id ? await host().characters.get(id, userId).catch(() => null) : null;
}

export function forgetChat(chatId?: string) {
  if (chatId) chatCharacter.delete(chatId); else chatCharacter.clear();
  profiles.clear();
}

/** Ruleset lorebooks (Warp's) hold YAML, not people. */
const RULESET_BOOK = /^\s*warp[-_ ]?ruleset\b/i;
const RULESET_ENTRY = /^\s*(?:\[[^\]]*\]\s*)?warp[-_ ]?ruleset\b/i;

/**
 * Is this a scenario, narrator or world card rather than one person? Those
 * aren't dressed as a person ("The Academy" has no outfit). A guess.
 */
export function looksLikeScenario(c: { name: string; description?: string; personality?: string; scenario?: string; tags?: string[] }): boolean {
  const tags = (c.tags ?? []).map((t) => t.toLowerCase());
  if (tags.some((t) => /scenario|\brpg\b|narrator|simulator|multiple characters|multi-?char|multi-?character|\bgroup\b|text adventure|\bworld\b|setting|dungeon|sandbox/.test(t))) return true;
  const text = `${c.description ?? ""}\n${c.personality ?? ""}\n${c.scenario ?? ""}`.toLowerCase();
  const narrator = [
    /\b(?:the )?narrator\b/, /\bgame ?master\b/, /\bdungeon master\b/, /\bstoryteller\b/,
    /\{\{char\}\} (?:is|will be) (?:not a (?:single |specific )?character|the (?:narrator|world|setting|game))/,
    /\{\{char\}\} (?:will )?(?:play|voice|control)s? (?:all |every |each )?(?:of )?(?:the )?(?:other )?(?:characters|npcs|side characters|cast)/,
    /\bmultiple characters\b/, /\bvarious characters\b/, /\ball (?:the )?npcs\b/,
  ];
  if (narrator.some((re) => re.test(text))) return true;
  const settingName = /\b(simulator|scenario|rpg|academy|world|kingdom|empire|city|town|village|school|university|dungeon|adventure|quest|game|isekai|apocalypse|station)\b/i;
  return settingName.test(c.name) && !(c.personality ?? "").trim();
}

export const nameRe = (name: string) => {
  const n = name.trim();
  // An empty name would match everywhere (every card, every lorebook entry).
  if (!n) return /(?!)/u;
  const safe = n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^\\p{L}])${safe}(?=[^\\p{L}]|$)`, "iu");
};

/** Paragraphs of a text that mention them, up to a budget. */
export function aboutThem(text: string | undefined | null, re: RegExp, budget: number): string {
  if (!text) return "";
  const out: string[] = [];
  let n = 0;
  for (const para of text.split(/\n\s*\n|\n(?=[-*•]|\w+:)/)) {
    const p = para.trim();
    if (!p || !re.test(p)) continue;
    const piece = p.length > 700 ? `${p.slice(0, 700)}…` : p;
    if (n + piece.length > budget) break;
    out.push(piece);
    n += piece.length;
  }
  return out.join("\n");
}

async function listAllEntries(bookId: string, userId?: string): Promise<WorldBookEntryDTO[]> {
  const out: WorldBookEntryDTO[] = [];
  for (let offset = 0; offset < 5000; offset += 200) {
    const page = await host().world_books.entries.list(bookId, { limit: 200, offset, userId });
    out.push(...page.data);
    if (out.length >= page.total || page.data.length === 0) break;
  }
  return out;
}

export interface PersonProfile {
  /** What's known about them: the card, lorebook entries about them, how the story has shown them. */
  text: string;
  /** A short piece of the setting, when the card isn't them. */
  setting: string;
}

const profiles = new Map<string, { at: number; p: PersonProfile }>();
const PROFILE_TTL = 10 * 60_000;

/**
 * Who a person is: the whole card when they are the card's character; otherwise
 * what the card says about them, lorebook entries keyed to their name, and how
 * the recent story has shown them.
 */
export async function personProfile(chatId: string, name: string, userId?: string): Promise<PersonProfile> {
  const key = `${chatId}:${userId ?? "_"}:${name.toLowerCase()}`;
  const hit = profiles.get(key);
  if (hit && Date.now() - hit.at < PROFILE_TTL) return hit.p;
  const re = nameRe(name);
  const c = await characterForChat(chatId, userId).catch(() => null);
  const parts: string[] = [];
  let setting = "";
  if (c && !looksLikeScenario(c) && re.test(c.name)) {
    parts.push([`Name: ${c.name}`, c.description && `Description: ${c.description}`, c.personality && `Personality: ${c.personality}`, c.scenario && `Scenario: ${c.scenario}`].filter(Boolean).join("\n").slice(0, 4000));
  } else if (c) {
    const fromCard = [c.description, c.personality, c.scenario].map((t) => aboutThem(t, re, 1200)).filter(Boolean).join("\n");
    if (fromCard) parts.push(`From the card:\n${fromCard}`);
    setting = [c.scenario, c.description].filter(Boolean).join("\n").slice(0, 600);
    const lore: string[] = [];
    for (const bookId of c.world_book_ids ?? []) {
      if (lore.length >= 3) break;
      const book = await host().world_books.get(bookId, userId).catch(() => null);
      if (!book || RULESET_BOOK.test(book.name ?? "")) continue;
      const entries = await listAllEntries(bookId, userId).catch(() => [] as WorldBookEntryDTO[]);
      for (const e of entries) {
        if (lore.length >= 3) break;
        if (RULESET_ENTRY.test(e.comment ?? "")) continue;
        if (re.test([...(e.key ?? []), e.comment ?? ""].join(" "))) lore.push(e.content.length > 900 ? `${e.content.slice(0, 900)}…` : e.content);
      }
    }
    if (lore.length) parts.push(`From the lorebook:\n${lore.join("\n---\n")}`);
  }
  try {
    const msgs = await getMessages(chatId);
    const seen: string[] = [];
    let n = 0;
    for (const m of [...msgs].reverse().slice(0, 40)) {
      if (m.is_user || !re.test(m.content)) continue;
      const bit = aboutThem(m.content, re, 500);
      if (!bit || n + bit.length > 1400) continue;
      seen.unshift(bit);
      n += bit.length;
      if (seen.length >= 4) break;
    }
    if (seen.length) parts.push(`How the story has shown them:\n${seen.join("\n")}`);
  } catch { /* no history */ }
  const p: PersonProfile = { text: parts.filter(Boolean).join("\n\n").slice(0, 4500), setting };
  profiles.set(key, { at: Date.now(), p });
  return p;
}

/** The card's character when the card is one person, else null. */
export async function cardPerson(chatId: string, userId?: string): Promise<string | null> {
  const c = await characterForChat(chatId, userId).catch(() => null);
  return c && c.name?.trim() && !looksLikeScenario(c) ? c.name.trim().slice(0, 80) : null;
}

/** A macro in the chat's context ({{user}}, {{persona}}), or "" when it doesn't resolve. */
export async function macro(text: string, chatId: string | null, userId?: string): Promise<string> {
  if (!chatId) return "";
  try {
    const { text: t } = await host().macros.resolve(text, { chatId, userId, commit: false });
    return t && t !== text ? t.trim() : "";
  } catch { return ""; }
}
