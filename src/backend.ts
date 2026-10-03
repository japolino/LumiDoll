import type { SpindleAPI } from "lumiverse-spindle-types";
import type { FrontendToBackend, Settings } from "./shared/protocol.js";
import { dollLook } from "./backend/dress.js";
import { follow } from "./backend/follow.js";
import { logError, send, toast } from "./backend/host.js";
import { getJev, JEV_KEY, jevStatus } from "./backend/jev.js";
import { getSettings, patchSettings } from "./backend/settings.js";
import { cardPerson, forgetChat, macro } from "./backend/source.js";

declare const spindle: SpindleAPI;

async function sendSettings(userId?: string) {
  const settings = await getSettings(userId);
  const { keySet, ready } = await jevStatus(settings, userId);
  let connections: { id: string; name: string }[] = [];
  try { connections = (await spindle.connections.list(userId)).map((c) => ({ id: c.id, name: c.name })); } catch { /* no generation permission */ }
  send({ type: "settings", settings, jevKeySet: keySet, jevReady: ready, connections }, userId);
}

/** Who the chat is with: the card's character (when it's one person) and the player's name. */
async function sendChat(chatId: string | null, userId?: string) {
  if (!chatId) { send({ type: "chat", chatId: null, character: null, user: "" }, userId); return; }
  const [character, user] = await Promise.all([cardPerson(chatId, userId).catch(() => null), macro("{{user}}", chatId, userId)]);
  send({ type: "chat", chatId, character, user }, userId);
}

spindle.on("CHAT_SWITCHED", (p, userId) => { void sendChat((p as { chatId: string | null }).chatId ?? null, userId).catch((e) => logError("chat", e)); });
spindle.on("CHARACTER_EDITED", () => forgetChat());
spindle.on("GENERATION_ENDED", (p, userId) => {
  // A finished reply (or swipe). Impersonations write the player's message, not the story's.
  if (p.error || !p.messageId || !p.chatId || p.generationType === "impersonate") return;
  send({ type: "reply", chatId: p.chatId, messageId: p.messageId, text: String(p.content ?? "").slice(-6000) }, userId);
});

spindle.onFrontendMessage(async (raw, userId) => {
  const msg = raw as FrontendToBackend;
  try {
    switch (msg.type) {
      case "hello":
        await sendSettings(userId);
        await sendChat(msg.chatId ?? null, userId);
        break;
      case "doll_look":
        await dollLook(msg, userId);
        break;
      case "doll_follow":
        await follow(msg, userId);
        break;
      case "settings":
        await patchSettings(msg.patch as Partial<Settings>, userId);
        await sendSettings(userId);
        break;
      case "set_jev_key": {
        const key = String(msg.key ?? "").trim();
        if (key) await spindle.enclave.put(JEV_KEY, key, userId);
        else await spindle.enclave.delete(JEV_KEY, userId);
        await sendSettings(userId);
        toast(key ? "success" : "info", key ? "Jev key saved (encrypted)." : "Jev key removed.", userId);
        break;
      }
      case "test_jev": {
        const jev = await getJev(await getSettings(userId), userId);
        if (!jev) { toast("warning", "Jev isn't set up: turn it on and add a key (or an endpoint that needs none).", userId); break; }
        const t0 = Date.now();
        const a = (await jev.ask({ latest_reply: "Mara pulls a red wool coat over her dress and steps out into the rain." }, { coat: { type: "noul", instructions: "Mara puts on a coat" } })).coat;
        const ms = Date.now() - t0;
        if (a?.type === "noul") toast("success", `Jev answered in ${ms} ms (${Math.round(a.noul * 100)}% sure Mara put on a coat).`, userId);
        else toast("warning", `Jev replied in ${ms} ms but gave no usable answer.`, userId);
        break;
      }
    }
  } catch (e) {
    logError(`frontend ${msg.type}`, e);
    toast("error", `Doll: ${e instanceof Error ? e.message : String(e)}`, userId);
  }
});
