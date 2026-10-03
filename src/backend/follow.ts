// Following the story without Warp: after a reply, who it's about (Jev, when set
// up; otherwise the names in it), then only what the reply changed on each doll.
// Jev calls run side by side; without Jev the helper model is asked once per doll,
// and only when the player chose "always".

import { cleanLook } from "../doll/outfits.js";
import type { Classifier, Questions } from "../shared/decide.js";
import { castKey, focusFrom, uniqueNames } from "../shared/names.js";
import type { DollFollow, Settings } from "../shared/protocol.js";
import { answerLook } from "./dress.js";
import { logError, send } from "./host.js";
import { getJev } from "./jev.js";
import { getSettings } from "./settings.js";
import { getMessages, macro } from "./source.js";

/** Jev's question: who the reply is about (keys are p0, p1… so any name is safe). */
export function focusQuestions(user: string, people: string[]): Questions {
  const criteria: Record<string, string> = {};
  people.forEach((p, i) => { criteria[`p${i}`] = p; });
  criteria.none = "none of these people";
  return { about: { type: "choice", instructions: `Besides ${user}, who the latest reply is mostly about: who is there with ${user}, acting or speaking`, criteria } };
}

/** Who a reply is about: Jev's pick when it's sure enough, "" when it says nobody listed, null when it can't tell. */
export async function askFocus(jev: Classifier, user: string, text: string, people: string[]): Promise<string | null> {
  const a = (await jev.ask({ player: user, latest_reply: text.slice(-4000) }, focusQuestions(user, people), { timeoutMs: 10000 })).about;
  if (a?.type !== "choice" || a.confidence < 0.4) return null;
  if (a.choice === "none") return "";
  const i = Number(a.choice.slice(1));
  return people[i] ?? null;
}

/** The whole follow-up for one reply. Sends a doll_focus, then a doll_look per doll that was checked. */
export async function follow(m: DollFollow, userId?: string, deps: { settings?: Settings; jev?: Classifier | null } = {}): Promise<void> {
  const settings = deps.settings ?? await getSettings(userId);
  if (settings.follow === "off") return;
  const jev = deps.jev !== undefined ? deps.jev : await getJev(settings, userId).catch(() => null);
  if (!jev && settings.follow !== "always") return;
  const opts = { settings, jev };
  const people = uniqueNames(Array.isArray(m.people) ? m.people : []);
  const looks = new Map<string, unknown>();
  for (const c of Array.isArray(m.cast) ? m.cast : []) if (c && typeof c.name === "string" && c.look) looks.set(castKey(c.name), c.look);

  let text = "";
  try {
    const msgs = await getMessages(m.chatId);
    text = (msgs.find((x) => x.id === m.messageId) ?? [...msgs].reverse().find((x) => !x.is_user))?.content ?? "";
  } catch (e) { logError("follow: messages", e); }

  const pinned = people.find((p) => castKey(p) === castKey(m.pin ?? ""));
  const focusP = (async (): Promise<string | null> => {
    if (pinned) return pinned;
    if (!people.length) return null;
    if (jev && text) {
      const user = (await macro("{{user}}", m.chatId, userId)) || "the player";
      const got = await askFocus(jev, user, text, people).catch((e) => { logError("follow: focus", e); return null; });
      if (got !== null) return got || null;
    }
    return focusFrom(text, people) || null;
  })();
  // The player's doll doesn't wait for who the reply is about.
  const youP = m.you ? answerLook({ type: "doll_look", chatId: m.chatId, who: "you", source: "story", current: cleanLook(m.you), auto: true }, userId, opts) : null;

  const focus = await focusP;
  const look = focus ? looks.get(castKey(focus)) : undefined;
  const asked = new Set((Array.isArray(m.asked) ? m.asked : []).filter((x): x is string => typeof x === "string").map(castKey));
  const dress = !!focus && (!!look || !asked.has(castKey(focus)));
  send({ type: "doll_focus", chatId: m.chatId, messageId: m.messageId, name: focus, ...(dress && !look ? { dressing: true } : {}) }, userId);
  const themP = focus && dress
    ? answerLook(look
      ? { type: "doll_look", chatId: m.chatId, who: focus, source: "story", current: cleanLook(look), auto: true }
      : { type: "doll_look", chatId: m.chatId, who: focus, source: "profile", auto: true }, userId, opts)
    : null;
  const [you, them] = await Promise.all([youP, themP]);
  if (you) send(you, userId);
  if (them) send(them, userId);
}
