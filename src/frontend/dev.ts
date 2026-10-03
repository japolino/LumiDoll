// Try the Doll outside Lumiverse: bun run dev, then open the address it prints.
// Everything but the helper and Jev works here; their buttons answer that they
// need Lumiverse. "Pretend Warp" sends a warp-state-v1 event, and the log shows
// what the Doll would ask its backend.

import { PRESETS } from "../doll/body.js";
import { renderDoll } from "../doll/render.js";
import { DEFAULT_SETTINGS, type FrontendToBackend } from "../shared/protocol.js";
import { WARP_STATE, WARP_STATE_REQUEST } from "../shared/warp-state.js";
import { createDollLab, esc } from "./lab.js";
import { panelHtml } from "./panel.js";
import { STYLES } from "./styles.js";
import { connectWarp } from "./warp-bridge.js";

const css = document.createElement("style");
css.textContent = STYLES + `
body { margin: 0; background: #1b1922; color: #e8e8ee; font-family: system-ui, sans-serif; display: flex; gap: 16px; }
.side { width: 390px; flex: 0 0 390px; height: 100vh; overflow-y: auto; }
.main { flex: 1; display: flex; flex-direction: column; gap: 10px; padding: 10px; height: 100vh; overflow-y: auto; box-sizing: border-box; }
.row { display: flex; gap: 12px; align-items: flex-start; flex-wrap: wrap; }
.dev-panel { width: 356px; height: 380px; }
.dev-warp { flex: 1; min-width: 280px; }
.dev-log { font: 11px/1.4 ui-monospace, monospace; white-space: pre-wrap; max-height: 160px; overflow: auto; margin: 0; color: #a4a4b4; }
.gallery { display: flex; flex-wrap: wrap; gap: 4px; }
.gallery svg { height: 380px; width: auto; }
h2 { width: 100%; margin: 4px 0; font-size: 14px; opacity: .7; font-weight: 500; }`;
document.head.appendChild(css);

const side = document.createElement("div");
side.className = "doll-root side";
const main = document.createElement("div");
main.className = "main";
main.innerHTML = `<div class="row">
  <div class="doll-panel dev-panel" data-dev-panel></div>
  <div class="doll-root doll-card dev-warp">
    <h3>Pretend Warp</h3>
    <p>Sends a warp-state-v1 event for this page's chat, as Warp would.</p>
    <label class="doll-field">You wear <input class="doll-input" data-dev-you value="a grey hoodie and jeans"></label>
    <label class="doll-field">Rhea (here) wears <input class="doll-input" data-dev-rhea value="a red wool coat"></label>
    <div class="doll-flex"><button class="doll-btn doll-btn-primary" data-dev-send>Send state</button><button class="doll-btn" data-dev-reply>A reply about Rhea</button></div>
    <pre class="dev-log" data-dev-log></pre>
  </div>
</div>
<h2>This look on every build</h2><div class="gallery" data-dev-gallery></div>`;
document.body.append(side, main);
const panelEl = main.querySelector<HTMLElement>("[data-dev-panel]")!;
const logEl = main.querySelector<HTMLElement>("[data-dev-log]")!;

const log = (line: string) => { logEl.textContent = `${line}\n${logEl.textContent}`.slice(0, 4000); };
const lab = createDollLab({
  chatId: () => "dev",
  changed: () => draw(),
  send: (m: FrontendToBackend) => {
    log(`→ backend: ${JSON.stringify(m).slice(0, 300)}`);
    if (m.type === "doll_look") setTimeout(() => lab.onLook({ type: "doll_look", who: m.who, chatId: m.chatId, look: null, note: "", error: "the helper and Jev only run inside Lumiverse", ...(m.auto ? { auto: true } : {}) }), 300);
  },
});
lab.onSettings({ settings: { ...DEFAULT_SETTINGS, follow: "always" }, jevKeySet: false, jevReady: false, connections: [] });
lab.onChat({ chatId: "dev", character: null, user: "You" });
connectWarp((s) => lab.onWarp(s));
window.addEventListener(WARP_STATE_REQUEST, () => log("← warp-state-request-v1"));

function draw() {
  side.innerHTML = lab.html();
  const { html } = panelHtml(lab, true);
  panelEl.innerHTML = html;
  const look = lab.current();
  main.querySelector<HTMLElement>("[data-dev-gallery]")!.innerHTML = (["f", "m"] as const).flatMap((sex) => Object.keys(PRESETS[sex]).map((p) => renderDoll({ ...look, body: { sex, preset: p } }, { id: `g${sex}${p}` }))).join("");
}
for (const t of ["click", "input", "change"]) side.addEventListener(t, (e) => { lab.handle(e, side); if (e.type !== "input") draw(); });
panelEl.addEventListener("click", (e) => { lab.handle(e, panelEl); draw(); });
main.querySelector("[data-dev-send]")!.addEventListener("click", () => {
  const you = main.querySelector<HTMLInputElement>("[data-dev-you]")!.value;
  const rhea = main.querySelector<HTMLInputElement>("[data-dev-rhea]")!.value;
  const detail = { version: 1, provider: "warp", chatId: "dev", messageId: null, you: { name: "You", outfit: you }, people: [{ id: "rhea", name: "Rhea", present: true, outfit: rhea }] };
  log(`warp-state-v1: ${esc(JSON.stringify(detail))}`);
  window.dispatchEvent(new CustomEvent(WARP_STATE, { detail }));
});
main.querySelector("[data-dev-reply]")!.addEventListener("click", () => lab.onReply({ chatId: "dev", messageId: `m${Date.now()}`, text: "Rhea laughed and shook the rain off her coat." }));
draw();
