// One quiet call on the helper connection (or the chat's own). The helper writes
// looks as JSON; it's used for what Jev can't do, or when Jev isn't set up.

import type { GenerationResponseDTO } from "lumiverse-spindle-types";
import type { Settings } from "../shared/protocol.js";
import { host } from "./host.js";

/** Calls made, for tests and the turn budget. */
export const helperCalls = { n: 0 };

export async function ask(system: string, user: string, settings: Settings, userId: string | undefined, timeoutMs: number, opts: { temperature?: number } = {}): Promise<string> {
  helperCalls.n++;
  const res = (await host().generate.quiet({
    type: "quiet",
    messages: [{ role: "system", content: system }, { role: "user", content: user }],
    connection_id: settings.helperConnectionId || undefined,
    reasoning: { source: "off" },
    parameters: { temperature: opts.temperature ?? 0.1 },
    userId,
    signal: AbortSignal.timeout(Math.max(3000, timeoutMs)),
  })) as GenerationResponseDTO | string;
  return typeof res === "string" ? res : res?.content ?? "";
}
