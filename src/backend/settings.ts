import { DEFAULT_SETTINGS, type Settings } from "../shared/protocol.js";
import { host } from "./host.js";

const cache = new Map<string, Settings>();
const writes = new Map<string, Promise<void>>();
const key = (userId?: string) => userId ?? "_";

/** Saved settings and settings sent from the page are both untrusted. */
export function normalizeSettings(value: unknown): Settings {
  const raw = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const str = (v: unknown, def: string) => (typeof v === "string" ? v.trim().slice(0, 400) : def);
  const s: Settings = {
    helperConnectionId: str(raw.helperConnectionId, DEFAULT_SETTINGS.helperConnectionId),
    jev: raw.jev === true || raw.jev === "true",
    jevModel: str(raw.jevModel, DEFAULT_SETTINGS.jevModel) || DEFAULT_SETTINGS.jevModel,
    jevUrl: str(raw.jevUrl, DEFAULT_SETTINGS.jevUrl),
    follow: raw.follow === "always" || raw.follow === "off" ? raw.follow : "jev",
  };
  if (!/^https?:\/\/\S+$/i.test(s.jevUrl)) s.jevUrl = DEFAULT_SETTINGS.jevUrl;
  return s;
}

export async function getSettings(userId?: string): Promise<Settings> {
  const hit = cache.get(key(userId));
  if (hit) return hit;
  let stored: unknown = {};
  try { stored = await host().userStorage.getJson("settings.json", { fallback: {}, userId }); } catch { /* first run */ }
  const s = normalizeSettings(stored);
  cache.set(key(userId), s);
  return s;
}

/** Writes one at a time per user, so two quick changes can't undo each other. */
export async function patchSettings(patch: Partial<Settings>, userId?: string): Promise<Settings> {
  let result!: Settings;
  const k = key(userId);
  const op = (writes.get(k) ?? Promise.resolve()).then(async () => {
    const next = normalizeSettings({ ...(await getSettings(userId)), ...patch });
    await host().userStorage.setJson("settings.json", next, { indent: 2, userId });
    cache.set(k, next);
    result = next;
  });
  const tail = op.catch(() => {});
  writes.set(k, tail);
  void tail.then(() => { if (writes.get(k) === tail) writes.delete(k); });
  await op;
  return result;
}

/** Forget cached settings (tests). */
export function clearSettingsCache() { cache.clear(); }
