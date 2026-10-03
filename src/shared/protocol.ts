// Messages between the Doll's backend and frontend, and its settings.

import { JEV_MODEL, JEV_URL } from "./classifier-config.js";

/** When the dolls follow the story on their own: with Jev only (cheap), always (the helper model when Jev isn't set up), or only when asked. */
export type FollowMode = "jev" | "always" | "off";

export interface Settings {
  /** Connection the helper model runs on; empty = the chat's own. */
  helperConnectionId: string;
  /** Answer the doll's questions with Jev (a classifier) instead of the helper model, when it's set up. */
  jev: boolean;
  jevModel: string;
  /** TypeSafe's typed-question API, or any compatible URL (Jev on OpenRouter). */
  jevUrl: string;
  follow: FollowMode;
}

export const DEFAULT_SETTINGS: Settings = {
  helperConnectionId: "",
  jev: false,
  jevModel: JEV_MODEL,
  jevUrl: JEV_URL,
  follow: "jev",
};

/** What Warp says about someone right now (see warp-state-v1). */
export interface WarpText { appearance?: string; outfit?: string; changed?: ("appearance" | "outfit")[] }

/** Ask for a look: from what's known about someone, a typed description, the latest story, or Warp's words. */
export interface DollRequest {
  type: "doll_look";
  chatId: string | null;
  /** "you" (the player), "them" (the second tab, unnamed) or a person's name. */
  who: string;
  source: "profile" | "text" | "story" | "warp";
  text?: string;
  /** Their look now (story and Warp updates keep what didn't change). */
  current?: unknown;
  /** Warp's appearance and outfit text for them (source "warp", and a first look while Warp runs). */
  warp?: WarpText;
  /** Sent on its own after a reply or a Warp update (no warnings when it fails). */
  auto?: boolean;
}

/** A new reply in a chat without Warp: who it's about, and what it changed. */
export interface DollFollow {
  type: "doll_follow";
  chatId: string;
  messageId: string;
  /** The people the "With you" doll can show (the card's character and everyone this chat has dressed). */
  people: string[];
  /** The person the player pinned ("" for none). */
  pin: string;
  /** The player's look, when their doll is shown. */
  you: unknown | null;
  /** The looks this chat has for the people above. */
  cast: { name: string; look: unknown }[];
  /** People already dressed automatically once (a failed first look isn't retried every reply). */
  asked?: string[];
}

export type FrontendToBackend =
  | { type: "hello"; chatId: string | null }
  | DollRequest
  | DollFollow
  | { type: "settings"; patch: Partial<Settings> }
  | { type: "set_jev_key"; key: string }
  | { type: "test_jev" };

export interface DollLookMsg {
  type: "doll_look";
  who: string;
  look: unknown | null;
  note: string;
  name?: string;
  error?: string;
  /** The chat it was asked for, and whether it was an automatic update. */
  chatId?: string | null;
  auto?: boolean;
}

export interface ChatInfo {
  chatId: string | null;
  /** The card's character, when the card is one person (not a narrator or world card). */
  character: string | null;
  /** The player's name in this chat. */
  user: string;
}

export type BackendToFrontend =
  | DollLookMsg
  | { type: "settings"; settings: Settings; jevKeySet: boolean; /** Jev is on and can be asked. */ jevReady: boolean; connections: { id: string; name: string }[] }
  | ({ type: "chat" } & ChatInfo)
  /** A reply finished (or a swipe was written): its text, for who it's about. */
  | { type: "reply"; chatId: string; messageId: string; text: string }
  /** Who a reply is about, as Jev read it (or the pin, or the names in it); dressing = a first look is on its way. */
  | { type: "doll_focus"; chatId: string; messageId: string; name: string | null; dressing?: boolean };
