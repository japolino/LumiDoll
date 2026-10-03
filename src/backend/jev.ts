// Jev: TypeSafe's classifier, or any endpoint with the same typed-question API
// ({ model, state, questions } -> { answers }). It only answers questions; it
// never writes. The key is kept in the host's encrypted enclave.

import type { Answers, AskOptions, Classifier, Questions } from "../shared/decide.js";
import { classifierIssue, JEV_URL } from "../shared/classifier-config.js";
import type { Settings } from "../shared/protocol.js";
import { host } from "./host.js";

export const JEV_KEY = "jev_api_key";

export class JevError extends Error {}

interface HttpResult { status: number; body: string }

function abortable<T>(call: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const abort = () => reject(signal.reason ?? new JevError("Jev was canceled"));
    signal.addEventListener("abort", abort, { once: true });
    if (signal.aborted) abort();
    call.then(resolve, reject).finally(() => signal.removeEventListener("abort", abort));
  });
}

async function post(url: string, headers: Record<string, string>, body: string, signal: AbortSignal): Promise<HttpResult> {
  signal.throwIfAborted();
  // The host's proxy is the sanctioned network path for extensions; plain fetch where it isn't there.
  const call = (async (): Promise<HttpResult> => {
    try {
      const r = (await host().cors(url, { method: "POST", headers, body, signal } as never)) as { status: number; body: string };
      signal.throwIfAborted();
      return { status: r.status, body: r.body };
    } catch (e) {
      signal.throwIfAborted();
      if (typeof fetch !== "function") throw e;
      const r = await fetch(url, { method: "POST", headers, body, signal });
      return { status: r.status, body: await r.text() };
    }
  })();
  return abortable(call, signal);
}

/** POST with a couple of retries while the service is busy; any other failure says what went wrong. */
async function postJson(url: string, key: string, body: string, timeoutMs: number, supplied?: AbortSignal): Promise<string> {
  const headers: Record<string, string> = { "Content-Type": "application/json", ...(key ? { Authorization: `Bearer ${key}` } : {}) };
  const who = url === JEV_URL ? "Jev" : "The classifier";
  const controller = new AbortController();
  const onAbort = () => controller.abort(supplied?.reason);
  supplied?.addEventListener("abort", onAbort, { once: true });
  if (supplied?.aborted) onAbort();
  const timer = setTimeout(() => controller.abort(new JevError(`${who} timed out`)), Math.max(1, timeoutMs));
  let delay = 400;
  try {
    for (let attempt = 0; ; attempt++) {
      const res = await post(url, headers, body, controller.signal);
      if (res.status === 200) return res.body;
      if ((res.status === 429 || res.status === 503 || res.status === 529) && attempt < 2) {
        await abortable(new Promise((r) => setTimeout(r, delay)), controller.signal);
        delay *= 3;
        continue;
      }
      const hint = res.status === 401 || res.status === 403 ? `the ${who} API key was rejected` : res.status === 404 ? `${who} wasn't found at ${url}` : res.status === 422 ? `${who} rejected the request` : `${who} returned ${res.status}`;
      throw new JevError(`${hint}${res.body ? `: ${res.body.slice(0, 200)}` : ""}`);
    }
  } finally {
    clearTimeout(timer);
    supplied?.removeEventListener("abort", onAbort);
  }
}

export class JevClassifier implements Classifier {
  /** Calls made, for tests and the turn budget. */
  calls = 0;
  constructor(private key: string, private model: string, private url = JEV_URL) {}

  async ask(state: unknown, questions: Questions, opts: AskOptions = {}): Promise<Answers> {
    if (!Object.keys(questions).length) return {};
    const issue = classifierIssue(this.model, this.url);
    if (issue) throw new JevError(issue);
    this.calls++;
    const body = JSON.stringify({ model: this.model || "jev-latest", state, questions });
    const parsed = JSON.parse(await postJson(this.url || JEV_URL, this.key, body, opts.timeoutMs ?? 15000, opts.signal)) as { answers?: Answers };
    return parsed.answers ?? {};
  }
}

async function keyOf(userId?: string): Promise<string | null> {
  try { return await host().enclave.get(JEV_KEY, userId); } catch { return null; }
}

/** Is a key saved, and can Jev be asked with these settings? */
export async function jevStatus(s: Settings, userId?: string): Promise<{ keySet: boolean; ready: boolean }> {
  let keySet = false;
  try { keySet = await host().enclave.has(JEV_KEY, userId); } catch { /* enclave unavailable */ }
  // TypeSafe needs a key; another endpoint (OpenRouter's, or a self-hosted one) may not.
  const ready = s.jev && !classifierIssue(s.jevModel, s.jevUrl) && (keySet || s.jevUrl !== JEV_URL);
  return { keySet, ready };
}

/** Jev, when it's turned on and set up; null means "use the helper model". */
export async function getJev(s: Settings, userId?: string): Promise<JevClassifier | null> {
  if (!s.jev || classifierIssue(s.jevModel, s.jevUrl)) return null;
  const key = await keyOf(userId);
  if (!key && s.jevUrl === JEV_URL) return null;
  return new JevClassifier(key ?? "", s.jevModel, s.jevUrl);
}
