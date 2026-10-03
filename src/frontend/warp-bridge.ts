// Listening for Warp. Warp publishes its scene state as a window event
// (warp-state-v1) whenever it changes; asking with warp-state-request-v1 makes it
// send the state again. Without Warp nothing ever arrives, and the Doll reads the
// story itself.

import { cleanWarpState, WARP_STATE, WARP_STATE_REQUEST, type WarpStateV1 } from "../shared/warp-state.js";

export function connectWarp(onState: (s: WarpStateV1) => void, target: Window = window): { request(): void; stop(): void } {
  const listener = (e: Event) => {
    const s = cleanWarpState((e as CustomEvent).detail);
    if (s) onState(s);
  };
  target.addEventListener(WARP_STATE, listener);
  return {
    request: () => { try { target.dispatchEvent(new CustomEvent(WARP_STATE_REQUEST, { detail: { version: 1 } })); } catch { /* no window */ } },
    stop: () => target.removeEventListener(WARP_STATE, listener),
  };
}
