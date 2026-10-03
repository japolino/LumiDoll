import type { SpindleFrontendContext } from "lumiverse-spindle-types";
import type { BackendToFrontend, FrontendToBackend } from "./shared/protocol.js";
import { createDollLab } from "./frontend/lab.js";
import { createPanel } from "./frontend/panel.js";
import { STYLES } from "./frontend/styles.js";
import { connectWarp } from "./frontend/warp-bridge.js";

const CLEANUP_KEY = "__dollCleanup";
const ICON = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="5" r="2.6"/><path d="M12 7.6v6.4M8 10.5l4-1.6 4 1.6M9.5 21l2.5-7 2.5 7M8.6 17.5h6.8"/></svg>`;

/** Text boxes keep their focus: the drawer isn't redrawn under the cursor. */
const typing = (root: HTMLElement) => {
  const a = document.activeElement as HTMLInputElement | null;
  return !!a && root.contains(a) && (a.tagName === "TEXTAREA" || (a.tagName === "INPUT" && ["text", "password", "search", ""].includes(a.type)));
};

export function setup(ctx: SpindleFrontendContext) {
  const prev = (globalThis as Record<string, unknown>)[CLEANUP_KEY];
  if (typeof prev === "function") prev();
  const cleanups: (() => void)[] = [];
  cleanups.push(ctx.dom.addStyle(STYLES));

  const send = (m: FrontendToBackend) => ctx.sendToBackend(m);
  const chatId = () => { try { return ctx.getActiveChat().chatId ?? null; } catch { return null; } };
  const lab = createDollLab({ send, chatId, changed: () => renderAll() });

  const tab = ctx.ui.registerDrawerTab({
    id: "doll",
    title: "Doll",
    shortName: "Doll",
    headerTitle: "Doll",
    description: "Your doll and the person with you, dressed from the story",
    keywords: ["doll", "outfit", "clothes", "avatar", "dress up", "paper doll"],
    iconSvg: ICON,
  });
  cleanups.push(() => tab.destroy());
  const drawerRoot = document.createElement("div");
  drawerRoot.className = "doll-root";
  tab.root.appendChild(drawerRoot);

  /** Which <details> were open, so a redraw keeps them that way. */
  const openSections = new Map<string, boolean>();
  let skipped = false;
  function renderDrawer() {
    if (typing(drawerRoot)) { skipped = true; return; }
    skipped = false;
    for (const d of drawerRoot.querySelectorAll<HTMLDetailsElement>("details[data-section]")) openSections.set(d.dataset.section!, d.open);
    const scroll = drawerRoot.scrollTop;
    drawerRoot.innerHTML = lab.html();
    for (const d of drawerRoot.querySelectorAll<HTMLDetailsElement>("details[data-section]")) {
      const was = openSections.get(d.dataset.section!);
      if (was !== undefined) d.open = was;
    }
    drawerRoot.scrollTop = scroll;
  }
  cleanups.push(tab.onActivate(() => renderDrawer()));

  const panel = createPanel(ctx, lab, () => { tab.activate(); renderDrawer(); });
  cleanups.push(() => panel.destroy());

  function renderAll() {
    renderDrawer();
    panel.render();
  }

  for (const type of ["click", "input", "change"]) {
    const h = (e: Event) => { lab.handle(e, drawerRoot); };
    drawerRoot.addEventListener(type, h);
    cleanups.push(() => drawerRoot.removeEventListener(type, h));
  }
  const onBlur = () => { if (skipped) setTimeout(() => { if (!typing(drawerRoot)) renderDrawer(); }, 0); };
  drawerRoot.addEventListener("focusout", onBlur);
  cleanups.push(() => drawerRoot.removeEventListener("focusout", onBlur));

  const warp = connectWarp((s) => lab.onWarp(s));
  cleanups.push(() => warp.stop());

  cleanups.push(ctx.onBackendMessage((raw) => {
    const m = raw as BackendToFrontend;
    switch (m.type) {
      case "settings": lab.onSettings({ settings: m.settings, jevKeySet: m.jevKeySet, jevReady: m.jevReady, connections: m.connections }); break;
      case "chat": lab.onChat({ chatId: m.chatId, character: m.character, user: m.user }); warp.request(); break;
      case "reply": lab.onReply(m); break;
      case "doll_look": lab.onLook(m); break;
      case "doll_focus": lab.onFocus(m); break;
    }
  }));

  send({ type: "hello", chatId: chatId() });
  warp.request();
  renderAll();

  const teardown = () => { for (const c of cleanups.splice(0)) { try { c(); } catch { /* already gone */ } } };
  (globalThis as Record<string, unknown>)[CLEANUP_KEY] = teardown;
  return teardown;
}
