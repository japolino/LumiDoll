// A pretend Lumiverse host for tests: no network, no models, no real keys.

export interface Sent { type: string; [k: string]: unknown }

export interface FakeHost {
  sent: Sent[];
  toasts: string[];
  quiet: { system: string; user: string; connection?: string }[];
  cors: { url: string; body: Record<string, unknown> }[];
  enclave: Map<string, string>;
  storage: Map<string, unknown>;
  messages: { id: string; is_user: boolean; content: string; index_in_chat: number }[];
}

export function fakeHost(o: {
  messages?: { id: string; is_user: boolean; content: string }[];
  /** What the helper model answers. */
  helper?: (system: string, user: string) => string;
  /** What the classifier endpoint answers, given the request body. */
  jev?: (body: Record<string, unknown>) => unknown;
  macros?: Record<string, string>;
  character?: { id: string; name: string; description?: string; personality?: string; scenario?: string; tags?: string[]; world_book_ids?: string[] } | null;
  key?: string;
} = {}): FakeHost {
  const h: FakeHost = {
    sent: [], toasts: [], quiet: [], cors: [], enclave: new Map(o.key ? [["jev_api_key", o.key]] : []), storage: new Map(),
    messages: (o.messages ?? []).map((m, i) => ({ ...m, index_in_chat: i })),
  };
  const toast = (level: string) => (message: string) => { h.toasts.push(`${level}: ${message}`); };
  (globalThis as Record<string, unknown>).spindle = {
    sendToFrontend: (m: Sent) => { h.sent.push(m); },
    toast: { success: toast("success"), info: toast("info"), warning: toast("warning"), error: toast("error") },
    log: { error: () => {}, info: () => {}, warn: () => {} },
    chat: { getMessages: async () => h.messages },
    chats: { get: async (id: string) => (o.character ? { id, character_id: o.character.id } : { id, character_id: "" }) },
    characters: { get: async () => (o.character ? { world_book_ids: [], tags: [], description: "", personality: "", scenario: "", ...o.character } : null) },
    world_books: { get: async () => null, entries: { list: async () => ({ data: [], total: 0 }) } },
    macros: { resolve: async (text: string) => ({ text: o.macros?.[text] ?? text }) },
    generate: {
      quiet: async (req: { messages: { content: string }[]; connection_id?: string }) => {
        const [system, user] = [req.messages[0]?.content ?? "", req.messages[1]?.content ?? ""];
        h.quiet.push({ system, user, connection: req.connection_id });
        return { content: o.helper ? o.helper(system, user) : "" };
      },
    },
    cors: async (url: string, req: { body: string }) => {
      const body = JSON.parse(req.body) as Record<string, unknown>;
      h.cors.push({ url, body });
      return { status: 200, body: JSON.stringify(o.jev ? o.jev(body) : { answers: {} }) };
    },
    enclave: {
      get: async (k: string) => h.enclave.get(k) ?? null,
      has: async (k: string) => h.enclave.has(k),
      put: async (k: string, v: string) => { h.enclave.set(k, v); },
      delete: async (k: string) => h.enclave.delete(k),
    },
    userStorage: {
      getJson: async (path: string, opts?: { fallback?: unknown }) => h.storage.get(path) ?? opts?.fallback,
      setJson: async (path: string, v: unknown) => { h.storage.set(path, v); },
    },
    connections: { list: async () => [{ id: "fast", name: "Fast helper" }] },
  };
  return h;
}
