// The Doll's styles. Colours come from Lumiverse's theme variables, so it follows
// the user's theme. Every class starts with "doll-", so nothing clashes with Warp.

export const STYLES = `
.doll-root, .doll-panel {
  --doll-text: var(--lumiverse-text, #e8e8ee);
  --doll-muted: var(--lumiverse-text-muted, #a4a4b4);
  --doll-dim: var(--lumiverse-text-dim, #7a7a8a);
  --doll-fill: var(--lumiverse-fill, rgba(255,255,255,0.06));
  --doll-fill-subtle: var(--lumiverse-fill-subtle, rgba(255,255,255,0.03));
  --doll-border: var(--lumiverse-border, rgba(255,255,255,0.12));
  --doll-accent: var(--lumiverse-accent, #8b7bff);
  --doll-accent-fg: var(--lumiverse-accent-fg, #fff);
  --doll-warn: #d9a441;
  --doll-radius: var(--lumiverse-radius, 8px);
  color: var(--doll-text);
  font-size: 13px;
  line-height: 1.4;
}
.doll-root { display: flex; flex-direction: column; gap: 10px; padding: 12px; box-sizing: border-box; }
.doll-dim { color: var(--doll-dim); }
.doll-warn { color: var(--doll-warn); }
.doll-btn { font: inherit; color: var(--doll-text); background: var(--doll-fill); border: 1px solid var(--doll-border); border-radius: var(--doll-radius); padding: 5px 11px; cursor: pointer; }
.doll-btn:hover { border-color: var(--doll-accent); }
.doll-btn:active { transform: translateY(1px); }
.doll-btn[disabled] { opacity: .5; cursor: not-allowed; }
.doll-btn-primary { background: var(--doll-accent); color: var(--doll-accent-fg); border-color: transparent; }
.doll-btn-ghost { background: transparent; border-color: transparent; color: var(--doll-muted); padding: 2px 6px; }
.doll-input { font: inherit; color: var(--doll-text); background: var(--doll-fill); border: 1px solid var(--doll-border); border-radius: 6px; padding: 5px 8px; width: 100%; box-sizing: border-box; min-width: 0; }
.doll-card { border: 1px solid var(--doll-border); border-radius: calc(var(--doll-radius) + 2px); padding: 12px; background: var(--doll-fill-subtle); display: flex; flex-direction: column; gap: 8px; }
.doll-card h3 { margin: 0; font-size: 14px; }
.doll-card p { margin: 0; color: var(--doll-muted); }
.doll-tabs { display: flex; gap: 2px; border-bottom: 1px solid var(--doll-border); }
.doll-tab { font: inherit; background: none; border: none; color: var(--doll-muted); padding: 7px 10px; cursor: pointer; border-bottom: 2px solid transparent; }
.doll-tab[aria-selected=true] { color: var(--doll-text); border-bottom-color: var(--doll-accent); }
.doll-section { border-top: 1px solid var(--doll-border); padding-top: 8px; }
.doll-section > summary { cursor: pointer; list-style: none; font-size: 10.5px; letter-spacing: .08em; text-transform: uppercase; color: var(--doll-dim); display: flex; justify-content: space-between; user-select: none; }
.doll-section > summary::-webkit-details-marker { display: none; }
.doll-section > summary::after { content: "▸"; display: inline-block; }
.doll-section[open] > summary::after { transform: rotate(90deg); }
.doll-toggle { display: grid; grid-template-columns: 1fr auto; gap: 2px 10px; align-items: center; padding: 4px 0; cursor: pointer; }
.doll-toggle small { grid-column: 1; color: var(--doll-dim); }
.doll-toggle input { grid-row: 1 / span 2; grid-column: 2; accent-color: var(--doll-accent); width: 16px; height: 16px; }
.doll-field { display: flex; flex-direction: column; gap: 4px; font-size: 12.5px; color: var(--doll-muted); }
.doll-flex { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.doll-flex > .doll-input { flex: 1; }

.doll-scene { display: flex; flex-direction: column; gap: 6px; }
.doll-scene-who { display: flex; flex-wrap: wrap; gap: 4px; }
.doll-scene-who .doll-btn, .doll-scene-foot .doll-btn { padding: 2px 8px; font-size: 12px; }
.doll-scene-foot { display: flex; justify-content: space-between; align-items: center; gap: 6px; font-size: 12px; }
.doll-lab { display: flex; flex-direction: column; gap: 8px; }
.doll-who { display: flex; gap: 4px; }
.doll-stage { display: flex; justify-content: center; background: radial-gradient(ellipse at 50% 85%, rgba(255,255,255,.07), transparent 60%), var(--doll-fill-subtle); border-radius: 12px; padding: 6px 0; }
.doll-stage svg { height: 440px; width: auto; max-width: 100%; }
.doll-note { margin: 0; font-size: 12px; }
.doll-helper h3 { margin: 0 0 6px; }
.doll-buttons { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 6px; }
.doll-text { width: 100%; box-sizing: border-box; resize: vertical; margin-bottom: 6px; }
.doll-json { width: 100%; box-sizing: border-box; font-family: ui-monospace, monospace; font-size: 11px; }
.doll-row { display: grid; grid-template-columns: 96px 1fr; align-items: center; gap: 8px; margin: 4px 0; font-size: 12px; }
.doll-row > span:first-child { opacity: .75; }
.doll-pair { display: flex; gap: 6px; align-items: center; }
.doll-pair select { flex: 1; }
.doll-chips { display: flex; flex-wrap: wrap; gap: 4px; }
.doll-swatches { display: flex; flex-wrap: wrap; gap: 4px; align-items: center; }
.doll-swatch { width: 18px; height: 18px; border-radius: 50%; border: 2px solid transparent; padding: 0; cursor: pointer; }
.doll-swatch.on { border-color: var(--doll-accent); }
.doll-colour { width: 26px; height: 22px; padding: 0; border: none; background: none; cursor: pointer; }
.doll-range { width: 100%; }
.doll-garment { border: 1px solid var(--doll-border); border-radius: 8px; margin: 4px 0; padding: 2px 6px; }
.doll-garment > summary { display: flex; align-items: center; gap: 8px; cursor: pointer; list-style: none; padding: 3px 0; }
.doll-garment > summary::-webkit-details-marker { display: none; }
.doll-gname { flex: 1; }
.doll-x { padding: 0 7px; line-height: 18px; }
.doll-fields { padding: 2px 0 6px; }
.doll-hud { display: flex; justify-content: center; }
.doll-hud svg { height: 300px; width: auto; max-width: 100%; }

/* The status window: your doll and the person with you, side by side. */
.doll-panel { display: flex; flex-direction: column; height: 100%; box-sizing: border-box; background: var(--lumiverse-bg-elevated, #1c1a24); border: 1px solid var(--doll-border); border-radius: 12px; overflow: hidden; }
.doll-panel-head { display: flex; align-items: center; gap: 6px; padding: 4px 8px; font-size: 11px; letter-spacing: .08em; text-transform: uppercase; color: var(--doll-dim); cursor: grab; user-select: none; }
.doll-panel-head span { flex: 1; }
.doll-panel-head .doll-btn-ghost { font-size: 13px; line-height: 1; }
.doll-panel-body { flex: 1; display: grid; grid-auto-flow: column; grid-auto-columns: 1fr; gap: 6px; padding: 0 8px 8px; min-height: 0; overflow: auto; }
.doll-panel-col { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.doll-panel-col h4 { margin: 0; font-size: 12px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.doll-panel .doll-hud svg { height: 260px; }
.doll-panel .doll-scene-who .doll-btn, .doll-panel .doll-scene-foot .doll-btn { padding: 1px 6px; font-size: 11px; }
.doll-panel.doll-closed .doll-panel-body { display: none; }
.doll-panel.doll-closed { border-radius: 999px; }
`;
