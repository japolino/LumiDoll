// People by name: the keys a chat's cast is stored under, and who a reply is about.

export const castKey = (name: string) => name.replace(/\s+/g, " ").trim().toLowerCase();

const BAD = new Set(["__proto__", "constructor", "prototype"]);
/** A name that can safely be a key. */
export const okName = (name: string) => !!castKey(name) && !BAD.has(castKey(name));

const reEsc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** How strongly a text is about someone: mentions of their full or first name, and how late the last one comes. */
export function mentionScore(text: string, name: string): number {
  const forms = [...new Set([name, name.split(/\s+/)[0]].filter((f) => f.length >= 2))];
  let n = 0, last = -1;
  for (const f of forms) {
    for (const m of text.matchAll(new RegExp(`(?<![\\p{L}\\p{N}])${reEsc(f)}(?![\\p{L}\\p{N}])`, "gu"))) { n++; last = Math.max(last, m.index ?? 0); }
  }
  return n ? n * 100000 + last : 0;
}

/** Who a reply is most about, of these people ("" when it names none of them). */
export function focusFrom(text: string, people: string[]): string {
  let best = "", score = 0;
  for (const name of people) { const s = mentionScore(text, name); if (s > score) { best = name; score = s; } }
  return best;
}

/** The same names once each (first spelling wins), without blanks. */
export function uniqueNames(names: string[], max = 16): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of names) {
    const n = String(raw ?? "").replace(/\s+/g, " ").trim().slice(0, 80);
    if (!okName(n) || seen.has(castKey(n))) continue;
    seen.add(castKey(n));
    out.push(n);
    if (out.length >= max) break;
  }
  return out;
}
