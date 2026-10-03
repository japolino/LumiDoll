import type { SpindleAPI } from "lumiverse-spindle-types";
import type { BackendToFrontend } from "../shared/protocol.js";

declare const spindle: SpindleAPI;

export function host(): SpindleAPI {
  return spindle;
}

export function send(msg: BackendToFrontend, userId?: string) {
  spindle.sendToFrontend(msg, userId);
}

export function toast(level: "info" | "success" | "warning" | "error", message: string, userId?: string) {
  try { spindle.toast[level](message, { title: "LumiDoll", ...(userId ? { userId } : {}) }); } catch { /* no toasts here */ }
}

export function logError(where: string, err: unknown) {
  const msg = err instanceof Error ? err.message : String(err);
  try { spindle.log.error(`[doll] ${where}: ${msg}`); } catch { /* logging must never throw */ }
}
