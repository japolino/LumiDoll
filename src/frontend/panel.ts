// The status window: a small floating widget with your doll and the person with
// you, side by side. Drag it anywhere; the head folds it to a pill.

import type { SpindleFloatWidgetHandle, SpindleFrontendContext } from "lumiverse-spindle-types";
import type { DollLab } from "./lab.js";
import { esc } from "./lab.js";

const KEY = "doll:panel";
const COL_W = 170;
const OPEN_H = 380;
const CLOSED = { w: 112, h: 30 };

interface Saved { x: number; y: number; open: boolean }

function load(): Saved | null {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "null") as Saved | null;
    return v && Number.isFinite(v.x) && Number.isFinite(v.y) ? { x: v.x, y: v.y, open: v.open !== false } : null;
  } catch { return null; }
}
function store(v: Saved) { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch { /* full */ } }

/** The window's markup: one column per doll shown. */
export function panelHtml(lab: DollLab, open: boolean): { html: string; cols: number } {
  const cols = [lab.hudSection(), lab.sceneSection()].filter((x): x is NonNullable<typeof x> => !!x);
  const head = `<div class="doll-panel-head"><span>Doll</span><button class="doll-btn doll-btn-ghost" data-doll-panel-toggle title="${open ? "Fold" : "Open"}">${open ? "▾" : "▸"}</button></div>`;
  const body = `<div class="doll-panel-body">${cols.map((c) => `<div class="doll-panel-col"><h4 title="${esc(c.title)}">${esc(c.title)}</h4>${c.body}</div>`).join("")}</div>`;
  return { html: head + body, cols: cols.length };
}

export function createPanel(ctx: SpindleFrontendContext, lab: DollLab, onEdit: () => void): { render(): void; destroy(): void } {
  const saved = load();
  let open = saved?.open ?? true;
  let widget: SpindleFloatWidgetHandle | null = null;
  const el = document.createElement("div");
  el.className = "doll-panel";
  let size = { w: 0, h: 0 };

  const width = (cols: number) => (open ? Math.max(1, cols) * COL_W + 16 : CLOSED.w);
  try {
    const vw = window.innerWidth || 1200;
    widget = ctx.ui.createFloatWidget({ width: width(2), height: OPEN_H, initialPosition: saved ? { x: saved.x, y: saved.y } : { x: Math.max(8, vw - width(2) - 24), y: 120 }, snapToEdge: true, chromeless: true, tooltip: "Doll" });
    widget.root.appendChild(el);
    widget.onDragEnd((p) => store({ x: p.x, y: p.y, open }));
  } catch (e) {
    // No ui_panels permission: the drawer tab still works.
    console.warn("[doll] no status window", e);
  }

  const onClick = (e: Event) => {
    const t = e.target as HTMLElement;
    if (t.closest?.("[data-doll-panel-toggle]")) {
      e.preventDefault();
      open = !open;
      if (widget) { const p = widget.getPosition(); store({ x: p.x, y: p.y, open }); }
      render();
      return;
    }
    const edit = !!t.closest?.("[data-doll-edit]");
    if (lab.handle(e, el)) return;
    if (edit) onEdit();
  };
  el.addEventListener("click", onClick);

  function render() {
    if (!widget) return;
    const { html, cols } = panelHtml(lab, open);
    widget.setVisible(cols > 0);
    if (!cols) return;
    el.classList.toggle("doll-closed", !open);
    el.innerHTML = html;
    const next = { w: width(cols), h: open ? OPEN_H : CLOSED.h };
    if (next.w !== size.w || next.h !== size.h) { size = next; widget.setSize(next.w, next.h); }
  }

  return {
    render,
    destroy: () => { el.removeEventListener("click", onClick); widget?.destroy(); },
  };
}
