// src/doll/geom.ts
var lerp = (a, b, t) => a + (b - a) * t;
var clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
var f = (n) => (Math.round(n * 10) / 10).toString();
function poly(pts) {
  if (!pts.length)
    return "";
  return `M${pts.map((p) => `${f(p.x)} ${f(p.y)}`).join("L")}Z`;
}
function line(pts) {
  if (!pts.length)
    return "";
  return `M${pts.map((p) => `${f(p.x)} ${f(p.y)}`).join("L")}`;
}
function ellipse(c, rx, ry) {
  return `M${f(c.x - rx)} ${f(c.y)}a${f(rx)} ${f(ry)} 0 1 0 ${f(rx * 2)} 0a${f(rx)} ${f(ry)} 0 1 0 ${f(-rx * 2)} 0Z`;
}
function spline(knots, steps = 8) {
  if (knots.length < 3)
    return knots.slice();
  const out = [];
  for (let i = 0;i < knots.length - 1; i++) {
    const p0 = knots[Math.max(0, i - 1)], p1 = knots[i], p2 = knots[i + 1], p3 = knots[Math.min(knots.length - 1, i + 2)];
    for (let s = 0;s < steps; s++) {
      const t = s / steps, t2 = t * t, t3 = t2 * t;
      const k = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push({ x: k(p0.x, p1.x, p2.x, p3.x), y: k(p0.y, p1.y, p2.y, p3.y) });
    }
  }
  out.push(knots[knots.length - 1]);
  return out;
}
function closedSpline(knots, steps = 8) {
  const n = knots.length;
  const out = [];
  for (let i = 0;i < n; i++) {
    const p0 = knots[(i - 1 + n) % n], p1 = knots[i], p2 = knots[(i + 1) % n], p3 = knots[(i + 2) % n];
    for (let s = 0;s < steps; s++) {
      const t = s / steps, t2 = t * t, t3 = t2 * t;
      const k = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push({ x: k(p0.x, p1.x, p2.x, p3.x), y: k(p0.y, p1.y, p2.y, p3.y) });
    }
  }
  return out;
}
function hull(a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const d = Math.hypot(dx, dy) || 0.000001;
  const th = Math.atan2(dy, dx);
  const al = Math.acos(clamp((a.r - b.r) / d, -1, 1));
  const at = (c, ang) => ({ x: c.x + c.r * Math.cos(ang), y: c.y + c.r * Math.sin(ang) });
  return [at(a, th + al), at(b, th + al), at(b, th - al), at(a, th - al)];
}
function along(chain, t) {
  const lens = chain.slice(1).map((j, i) => Math.hypot(j.x - chain[i].x, j.y - chain[i].y));
  const total = lens.reduce((a, b) => a + b, 0);
  let want = clamp(t, 0, 1) * total;
  for (let i = 0;i < lens.length; i++) {
    if (want <= lens[i] || i === lens.length - 1) {
      const k = lens[i] ? clamp(want / lens[i], 0, 1) : 0;
      const a = chain[i], b = chain[i + 1];
      return { x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k), r: lerp(a.r, b.r, k) };
    }
    want -= lens[i];
  }
  return chain[chain.length - 1];
}
function segment(chain, t0, t1) {
  const lens = chain.slice(1).map((j, i) => Math.hypot(j.x - chain[i].x, j.y - chain[i].y));
  const total = lens.reduce((a, b) => a + b, 0);
  const out = [along(chain, t0)];
  let acc = 0;
  for (let i = 0;i < lens.length - 1; i++) {
    acc += lens[i];
    const t = acc / total;
    if (t > t0 && t < t1)
      out.push(chain[i + 1]);
  }
  out.push(along(chain, t1));
  return out;
}
function clipPoly(pts, a, b, side = 1) {
  const s = (p) => side * ((b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x));
  const out = [];
  for (let i = 0;i < pts.length; i++) {
    const p = pts[i], q = pts[(i + 1) % pts.length];
    const sp = s(p), sq = s(q);
    if (sp >= 0)
      out.push(p);
    if (sp >= 0 !== sq >= 0) {
      const t = sp / (sp - sq);
      out.push({ x: lerp(p.x, q.x, t), y: lerp(p.y, q.y, t) });
    }
  }
  return out;
}
function rng(seed) {
  let h = 2166136261;
  for (let i = 0;i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h += 1831565813;
    let t = h;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function hexToRgb(hex) {
  let h = hex.replace("#", "").trim();
  if (h.length === 3)
    h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h.slice(0, 6), 16);
  if (!Number.isFinite(n))
    return [128, 128, 128];
  return [n >> 16 & 255, n >> 8 & 255, n & 255];
}
var toHex = (r, g, b) => "#" + [r, g, b].map((v) => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, "0")).join("");
function mix(a, b, t) {
  const x = hexToRgb(a), y = hexToRgb(b);
  return toHex(lerp(x[0], y[0], t), lerp(x[1], y[1], t), lerp(x[2], y[2], t));
}
var shade = (c, t) => mix(c, "#2a1f3d", t);
var light = (c, t) => mix(c, "#ffffff", t);
var ink = (c) => mix(shade(c, 0.62), "#241a2c", 0.35);

// src/doll/body.ts
var F_BASE = { height: 1, head: 1, neck: 8.5, shoulder: 39, chest: 32, bust: 0.5, waist: 24, hip: 38, thigh: 15, knee: 9, calf: 10.5, ankle: 5.8, arm: 7, fore: 6, wrist: 4.2, belly: 0, muscle: 0, jaw: 0 };
var M_BASE = { height: 1.06, head: 1, neck: 11.5, shoulder: 49, chest: 40, bust: 0, waist: 32, hip: 35, thigh: 15, knee: 10, calf: 11.5, ankle: 7, arm: 9, fore: 7.8, wrist: 5.4, belly: 0, muscle: 0.3, jaw: 0.7 };
var PRESETS = {
  f: {
    slim: { label: "Slim", shape: { shoulder: 36, chest: 29, bust: 0.25, waist: 21, hip: 33, thigh: 12.5, knee: 8.2, calf: 9.2, arm: 6, fore: 5.2, wrist: 3.8 } },
    athletic: { label: "Athletic", shape: { shoulder: 42, chest: 34, bust: 0.4, waist: 25, hip: 36, thigh: 15.5, calf: 11.5, arm: 8, fore: 6.8, muscle: 0.6, height: 1.02 } },
    curvy: { label: "Curvy", shape: { shoulder: 39, chest: 33, bust: 1, waist: 23.5, hip: 45, thigh: 18, knee: 10, calf: 11.5, arm: 7.5, fore: 6.3 } },
    heavy: { label: "Heavy", shape: { neck: 10.5, shoulder: 45, chest: 41, bust: 1, waist: 39, hip: 51, thigh: 22, knee: 12.5, calf: 14, ankle: 7, arm: 11, fore: 9, wrist: 5, belly: 0.8 } }
  },
  m: {
    slim: { label: "Slim", shape: { neck: 10, shoulder: 44, chest: 35, waist: 27.5, hip: 31, thigh: 13, knee: 9, calf: 10, arm: 7.8, fore: 6.8, wrist: 4.8, muscle: 0.1 } },
    athletic: { label: "Athletic", shape: { neck: 12, shoulder: 52, chest: 42, waist: 30.5, hip: 34, thigh: 16, calf: 12.5, arm: 10.5, fore: 8.8, muscle: 0.75 } },
    broad: { label: "Broad", shape: { neck: 14, shoulder: 59, chest: 48, waist: 36, hip: 37, thigh: 18.5, knee: 11.5, calf: 14, ankle: 8, arm: 13, fore: 10.5, wrist: 6.2, muscle: 1, height: 1.08 } },
    heavy: { label: "Heavy", shape: { neck: 14, shoulder: 54, chest: 48, waist: 47, hip: 46, thigh: 20.5, knee: 12, calf: 13.5, ankle: 8, arm: 12, fore: 10, belly: 1, muscle: 0.1 } }
  }
};
function shapeOf(b) {
  const base = b.sex === "m" ? M_BASE : F_BASE;
  const set = PRESETS[b.sex];
  const a = { ...base, ...(set[b.preset] ?? Object.values(set)[0]).shape };
  let s = a;
  if (b.blend && set[b.blend.preset]) {
    const c = { ...base, ...set[b.blend.preset].shape };
    const t = clamp(b.blend.amount, 0, 1);
    s = Object.fromEntries(Object.keys(a).map((k) => [k, lerp(a[k], c[k], t)]));
  }
  if (b.height)
    s = { ...s, height: s.height * clamp(b.height, 0.85, 1.15) };
  return s;
}
var CX = 120;
var GROUND = 522;
function buildBody(pick) {
  const s = shapeOf(pick);
  const H = s.height;
  const Y = (v) => GROUND - (GROUND - v) * H;
  const headRy = 33.5 * s.head * (pick.sex === "m" ? 1.02 : 1);
  const headRx = 28 * s.head * (pick.sex === "m" ? 1.04 : 1);
  const head = { c: { x: CX, y: Y(70) }, rx: headRx, ry: headRy };
  const neckTop = head.c.y + headRy * 0.62;
  const neckBot = Y(118);
  const shoulderY = Y(126);
  const armpitY = Y(148);
  const bustY = Y(165);
  const underY = Y(182);
  const waistY = Y(214);
  const hipY = Y(252);
  const crotchY = Y(284);
  const kneeY = Y(392);
  const ankleY = Y(486);
  const belly = s.belly;
  const prof = [
    { x: s.neck, y: neckBot - 4 },
    { x: s.neck + 1.5, y: neckBot },
    { x: lerp(s.neck, s.shoulder, 0.62), y: shoulderY - 3 },
    { x: s.shoulder, y: shoulderY + 7 },
    { x: s.chest + 1 + s.muscle * 2, y: armpitY + 2 },
    { x: s.chest + s.bust * 3 + s.muscle * 1.5, y: bustY },
    { x: lerp(s.chest, s.waist, 0.35) + belly * 6, y: underY },
    { x: s.waist + belly * 5, y: waistY },
    { x: lerp(s.waist, s.hip, 0.75) + belly * 3, y: lerp(waistY, hipY, 0.55) },
    { x: s.hip, y: hipY },
    { x: s.hip - 2.5, y: crotchY - 6 }
  ];
  const profile = spline(prof, 10).map((p) => ({ x: p.x, y: p.y }));
  const sj = { x: CX + s.shoulder - s.arm * 0.75, y: shoulderY + s.arm * 0.95, r: s.arm + s.muscle * 1.2 };
  const elbowY = Y(216), wristY = Y(282);
  const spread = 8 + s.hip * 0.18 + belly * 6;
  const arm = [
    sj,
    { x: sj.x + spread * 0.4, y: lerp(sj.y, elbowY, 0.45), r: s.arm * 0.98 + s.muscle * 1.6 },
    { x: sj.x + spread * 0.78, y: elbowY, r: s.fore * 0.92 },
    { x: sj.x + spread * 0.95, y: lerp(elbowY, wristY, 0.35), r: s.fore + s.muscle * 0.6 },
    { x: sj.x + spread * 1.12, y: wristY, r: s.wrist }
  ];
  const w = arm[arm.length - 1];
  const handLen = 16 * H;
  const hand = { c: { x: w.x + 2.5, y: w.y + handLen }, rx: s.wrist * 1.55, ry: handLen * 1.05, angle: -7 };
  const thighR = Math.max(s.thigh, (s.hip - (pick.sex === "m" ? 4 : 1.5)) / 2);
  const legX = s.hip - thighR;
  const kneeX = legX - thighR * 0.28 + s.knee * 0.3;
  const leg = [
    { x: CX + legX, y: hipY - 2, r: thighR },
    { x: CX + lerp(legX, kneeX, 0.45), y: lerp(hipY, kneeY, 0.42), r: lerp(thighR, s.knee, 0.4) },
    { x: CX + kneeX, y: kneeY, r: s.knee },
    { x: CX + kneeX + 0.5, y: lerp(kneeY, ankleY, 0.3), r: s.calf },
    { x: CX + kneeX + 1.5, y: lerp(kneeY, ankleY, 0.72), r: lerp(s.calf, s.ankle, 0.65) },
    { x: CX + kneeX + 2.5, y: ankleY, r: s.ankle }
  ];
  const foot = { c: { x: CX + kneeX + 5, y: GROUND - 10 }, rx: s.ankle * 1.45 + 1.5, ry: 12 };
  const breast = pick.sex === "f" && s.bust > 0.05 ? { x: CX + s.chest * 0.46, y: bustY + 2, r: 8 + s.bust * 8.5 } : null;
  const legY = (t) => lerp(hipY, ankleY, t);
  return { sex: pick.sex, s, cx: CX, ground: GROUND, head, neckTop, neckBot, shoulderY, armpitY, bustY, underY, waistY, hipY, crotchY, profile, arm, hand, leg, foot, breast, legY };
}
function widthAt(b, y) {
  const p = b.profile;
  if (y <= p[0].y)
    return p[0].x;
  for (let i = 1;i < p.length; i++) {
    if (p[i].y >= y) {
      const t = (y - p[i - 1].y) / (p[i].y - p[i - 1].y || 1);
      return lerp(p[i - 1].x, p[i].x, t);
    }
  }
  return p[p.length - 1].x;
}
var mirrorChain = (b, c) => c.map((j) => ({ ...j, x: 2 * b.cx - j.x }));
function trunkSlice(b, y0, y1, grow = 0, opts = {}) {
  const ys = [y0];
  for (const p of b.profile)
    if (p.y > y0 && p.y < y1)
      ys.push(p.y);
  ys.push(y1);
  const span = Math.max(1, y1 - y0);
  const wAt = (y) => {
    let w = widthAt(b, y) + grow;
    if (opts.maxW)
      w = Math.min(w, opts.maxW(y));
    if (opts.flare)
      w += opts.flare * Math.max(0, (y - y0) / span) ** 1.5 * 10;
    return w;
  };
  const right = ys.map((y) => ({ x: b.cx + wAt(y), y }));
  const left = ys.map((y) => ({ x: b.cx - wAt(y), y })).reverse();
  const dip = opts.hemDip ?? 0;
  const hem = dip ? [{ x: b.cx, y: y1 + dip }] : [];
  return [...(opts.top ?? [left[left.length - 1], right[0]]).slice(), ...right.slice(1), ...hem, ...left.slice(0, -1)];
}

// src/doll/features.ts
var HAIR_STYLES = ["long", "bob", "ponytail", "twintails", "short", "spiky", "messy", "bun", "buzz"];
var EARS = ["cat", "fox", "wolf", "bunny", "elf"];
var TAILS = ["fox", "cat", "wolf", "demon", "kitsune"];
var HORNS = ["small", "ram", "oni"];
var EXPRESSIONS = ["neutral", "smile", "serious", "surprised", "smug"];
var P = (b, u, v) => ({ x: b.head.c.x + u * b.head.rx, y: b.head.c.y + v * b.head.ry });
function strand(root, o) {
  const N = 28;
  const t0 = o.t0 ?? 0, t1 = o.t1 ?? 1;
  const peak = o.peak ?? 0.35, tipW = o.tip ?? 0, baseW = o.base ?? 0.7;
  const centre = [];
  const ang = [];
  let p = { ...root };
  for (let i = 0;i <= N; i++) {
    const t = i / N;
    const a = (o.angle + o.bend * t + (o.wave ? Math.sin(t * Math.PI * 2) * o.wave : 0)) * Math.PI / 180;
    centre.push({ ...p });
    ang.push(a);
    p = { x: p.x + Math.cos(a) * (o.length / N), y: p.y + Math.sin(a) * (o.length / N) };
  }
  const width = (t) => {
    const k = t < peak ? lerp(baseW, 1, Math.sin(t / peak * Math.PI / 2)) : lerp(1, tipW, ((t - peak) / (1 - peak)) ** 1.4);
    return o.width / 2 * k;
  };
  const L = [], R = [];
  for (let i = 0;i <= N; i++) {
    const t = i / N;
    if (t < t0 - 0.000000001 || t > t1 + 0.000000001)
      continue;
    const a = ang[i], w = width(t), c = centre[i];
    L.push({ x: c.x + Math.cos(a - Math.PI / 2) * w, y: c.y + Math.sin(a - Math.PI / 2) * w });
    R.push({ x: c.x + Math.cos(a + Math.PI / 2) * w, y: c.y + Math.sin(a + Math.PI / 2) * w });
  }
  return [...L, ...R.reverse()];
}
function tips(a, b, n, depth, seed, dirY = 1) {
  const out = [];
  for (let i = 0;i <= n * 2; i++) {
    const t = i / (n * 2);
    const tipish = i % 2 === 1;
    const jitter = Math.sin(seed + i * 2.3) * 0.35 + 1;
    out.push({ x: lerp(a.x, b.x, t) + (tipish ? Math.sin(seed + i) * 1.5 : 0), y: lerp(a.y, b.y, t) + (tipish ? depth * jitter * dirY : 0) });
  }
  return out;
}
function headPath(b) {
  const j = b.s.jaw;
  const k = [[0, -1], [0.72, -0.8], [1, -0.18], [0.97, 0.3], [0.72 + j * 0.12, 0.72], [0.3 + j * 0.12, 0.97], [0, 1.02]];
  const pts = [...k, ...k.slice(1, -1).reverse().map(([u, v]) => [-u, v])].map(([u, v]) => P(b, u, v));
  return poly(closedSpline(pts, 8));
}
function neckPath(b) {
  const n = b.s.neck;
  return poly([{ x: b.cx - n * 0.85, y: b.neckTop - 8 }, { x: b.cx + n * 0.85, y: b.neckTop - 8 }, { x: b.cx + n * 1.02, y: b.neckBot + 2 }, { x: b.cx - n * 1.02, y: b.neckBot + 2 }]);
}
function earPath(b, side, elf) {
  const base = P(b, side * 0.94, 0.12);
  if (elf) {
    return poly(spline([P(b, side * 0.9, -0.1), { x: base.x + side * b.head.rx * 0.75, y: base.y - b.head.ry * 0.42 }, P(b, side * 1.02, 0.25), P(b, side * 0.92, 0.36)], 6));
  }
  return poly(closedSpline([P(b, side * 0.92, -0.05), P(b, side * 1.12, 0.02), P(b, side * 1.1, 0.3), P(b, side * 0.93, 0.36)], 6));
}
function face(b, eyes, expr, skin, lineC) {
  const fem = b.sex === "f";
  const ew = b.head.rx * (fem ? 0.36 : 0.32), eh = b.head.ry * (fem ? 0.27 : 0.18);
  const ey = b.head.c.y + b.head.ry * 0.2;
  const dark = mix(eyes, "#120c1c", 0.55);
  const lash = "#231827";
  const parts = [];
  for (const side of [-1, 1]) {
    const ex = b.head.c.x + side * b.head.rx * 0.42;
    const inner = ex - side * ew * 0.95, outer = ex + side * ew * 0.95;
    const top = ey - eh * (expr === "surprised" ? 0.62 : 0.5);
    const bottom = ey + eh * 0.5;
    const narrow = expr === "serious" || expr === "smug" ? 0.25 : 0;
    const t = top + eh * narrow;
    parts.push(`<path d="${poly(spline([{ x: inner, y: ey + eh * 0.05 }, { x: ex, y: t - eh * 0.04 }, { x: outer, y: ey - eh * 0.1 }, { x: outer - side * ew * 0.15, y: bottom - eh * 0.1 }, { x: ex, y: bottom }, { x: inner, y: ey + eh * 0.15 }], 5))}" fill="#fbf8ff"/>`);
    const ir = ew * (fem ? 0.6 : 0.55);
    const irY = ey + eh * 0.06;
    parts.push(`<ellipse cx="${f(ex)}" cy="${f(irY)}" rx="${f(ir)}" ry="${f(eh * 0.58)}" fill="${eyes}"/>`);
    parts.push(`<ellipse cx="${f(ex)}" cy="${f(irY - eh * 0.18)}" rx="${f(ir)}" ry="${f(eh * 0.34)}" fill="${dark}" opacity=".55"/>`);
    parts.push(`<ellipse cx="${f(ex)}" cy="${f(irY + eh * 0.04)}" rx="${f(ir * 0.42)}" ry="${f(eh * 0.3)}" fill="#120c1c"/>`);
    parts.push(`<ellipse cx="${f(ex - side * ir * 0.38)}" cy="${f(irY - eh * 0.2)}" rx="${f(ir * 0.3)}" ry="${f(eh * 0.17)}" fill="#fff"/>`);
    parts.push(`<circle cx="${f(ex + side * ir * 0.35)}" cy="${f(irY + eh * 0.26)}" r="${f(ir * 0.13)}" fill="#fff" opacity=".85"/>`);
    parts.push(`<path d="M${f(inner - 3 * side)} ${f(t - eh)}L${f(outer + side * 3)} ${f(t - eh)}L${f(outer + side * 3)} ${f(ey - eh * 0.18)}Q${f(ex)} ${f(t - eh * 0.62)} ${f(inner - 1 * side)} ${f(ey + eh * 0.04)}Z" fill="${skin}"/>`);
    const lashW = fem ? 2.6 : 2;
    parts.push(`<path d="M${f(inner)} ${f(ey + eh * 0.02)}Q${f(ex)} ${f(t - eh * 0.62)} ${f(outer + side * 1.5)} ${f(ey - eh * 0.2)}" stroke="${lash}" stroke-width="${lashW}" fill="none" stroke-linecap="round"/>`);
    if (fem)
      parts.push(`<path d="M${f(outer - side * 1)} ${f(ey - eh * 0.2)}l${f(side * 4)} ${f(-2.5)}" stroke="${lash}" stroke-width="1.6" stroke-linecap="round"/>`);
    parts.push(`<path d="M${f(ex - side * ew * 0.2)} ${f(bottom + 0.5)}Q${f(ex + side * ew * 0.4)} ${f(bottom + 0.8)} ${f(outer - side * ew * 0.1)} ${f(ey + eh * 0.25)}" stroke="${lineC}" stroke-width=".9" fill="none" opacity=".7"/>`);
    const by = top - eh * (expr === "surprised" ? 1.25 : 0.95) - (fem ? 1.5 : 0);
    const tilt = expr === "serious" ? 3.5 : expr === "smug" ? side === 1 ? -2 : 1.5 : -0.5;
    parts.push(`<path d="M${f(ex - side * ew * 0.85)} ${f(by + tilt)}Q${f(ex - side * ew * 0.1)} ${f(by - 3)} ${f(ex + side * ew * 1)} ${f(by + 2.5 - tilt * 0.3)}" stroke="${lineC}" stroke-width="${fem ? 1.3 : 2.1}" fill="none" stroke-linecap="round"/>`);
  }
  if (fem)
    for (const side of [-1, 1])
      parts.push(`<ellipse cx="${f(b.head.c.x + side * b.head.rx * 0.52)}" cy="${f(ey + eh * 1.05)}" rx="${f(b.head.rx * 0.17)}" ry="${f(b.head.ry * 0.06)}" fill="#ff7b9c" opacity=".22"/>`);
  const ny = b.head.c.y + b.head.ry * 0.5;
  parts.push(`<path d="M${f(b.head.c.x + 0.5)} ${f(ny - 3)}l${f(1.6)} ${f(3.6)}l${f(-2.2)} ${f(0.6)}" stroke="${shade(skin, 0.35)}" stroke-width="1" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`);
  const my = b.head.c.y + b.head.ry * 0.71, mw = b.head.rx * (fem ? 0.17 : 0.22);
  const mouth = {
    neutral: `M${f(b.head.c.x - mw)} ${f(my)}Q${f(b.head.c.x)} ${f(my + 1.6)} ${f(b.head.c.x + mw)} ${f(my)}`,
    smile: `M${f(b.head.c.x - mw * 1.2)} ${f(my - 1.5)}Q${f(b.head.c.x)} ${f(my + 4.5)} ${f(b.head.c.x + mw * 1.2)} ${f(my - 1.5)}`,
    serious: `M${f(b.head.c.x - mw)} ${f(my + 0.5)}L${f(b.head.c.x + mw)} ${f(my + 0.3)}`,
    surprised: "",
    smug: `M${f(b.head.c.x - mw)} ${f(my + 0.5)}Q${f(b.head.c.x + mw * 0.3)} ${f(my + 1.5)} ${f(b.head.c.x + mw * 1.2)} ${f(my - 2)}`
  }[expr];
  if (expr === "surprised")
    parts.push(`<ellipse cx="${f(b.head.c.x)}" cy="${f(my + 1)}" rx="${f(mw * 0.45)}" ry="${f(mw * 0.6)}" fill="#7a2a3a" stroke="${lineC}" stroke-width="1"/>`);
  else
    parts.push(`<path d="${mouth}" stroke="${lineC}" stroke-width="1.3" fill="none" stroke-linecap="round"/>`);
  return parts.join("");
}
function hair(b, style, length = 0.6) {
  const rx = b.head.rx, ry = b.head.ry;
  const out = { back: [], front: [], extra: [] };
  const fem = b.sex === "f";
  const cap = (bang, sideDown) => {
    const arcK = [P(b, -1.04, sideDown), P(b, -1.13, -0.25), P(b, -0.98, -0.82), P(b, -0.55, -1.14), P(b, 0, -1.2), P(b, 0.55, -1.14), P(b, 0.98, -0.82), P(b, 1.13, -0.25), P(b, 1.04, sideDown)];
    let top = spline(arcK, 8);
    if (bang === "spiky") {
      top = [];
      const n = 7;
      for (let i = 0;i <= n * 2; i++) {
        const a = Math.PI + i / (n * 2) * Math.PI;
        const r = i % 2 ? 1.42 + Math.sin(i * 1.7) * 0.1 : 1.08;
        top.push(P(b, Math.cos(a) * r * 1.05, Math.sin(a) * r * 0.98 - 0.12));
      }
      top.unshift(P(b, -1.04, sideDown));
      top.push(P(b, 1.04, sideDown));
    }
    const sideTip = (s) => P(b, s * 0.92, sideDown + 0.12);
    let bottom;
    switch (bang) {
      case "full":
        bottom = tips(P(b, 0.9, 0), P(b, -0.9, 0), 6, ry * 0.12, 3);
        bottom = bottom.map((p) => ({ x: p.x, y: p.y - ry * 0.12 * (1 - Math.abs((p.x - b.head.c.x) / rx)) }));
        break;
      case "side":
        bottom = [P(b, 0.92, -0.1), P(b, 0.55, -0.45), P(b, 0.3, -0.2), P(b, 0.05, -0.5), P(b, -0.35, -0.12), P(b, -0.55, -0.3), P(b, -0.85, 0.15)];
        break;
      case "spiky":
        bottom = tips(P(b, 0.9, -0.25), P(b, -0.9, -0.25), 5, ry * 0.25, 1.5);
        break;
      case "short":
        bottom = tips(P(b, 0.9, -0.35), P(b, -0.9, -0.35), 6, ry * 0.12, 2);
        break;
      default:
        bottom = spline([P(b, 0.92, -0.3), P(b, 0.5, -0.62), P(b, 0, -0.68), P(b, -0.5, -0.62), P(b, -0.92, -0.3)], 6);
    }
    return poly([...top, sideTip(1), ...bottom, sideTip(-1)]);
  };
  const lockPair = (len, width, wave = 0) => [-1, 1].map((s) => poly(strand(P(b, s * 0.95, -0.15), { angle: 90 - s * 4, bend: s * 6, length: len, width, peak: 0.25, tip: 0.05, base: 0.9, wave })));
  const back = (bottomY, halfW, jag = 8) => {
    const L = P(b, -1.12, -0.5), R = P(b, 1.12, -0.5);
    const side = (s) => spline([P(b, s * 1.12, -0.5), P(b, s * 1.25, 0.4), { x: b.cx + s * halfW, y: lerp(b.head.c.y + ry, bottomY, 0.55) }, { x: b.cx + s * halfW * 0.92, y: bottomY - 4 }], 8);
    const r = side(1), l = side(-1).reverse();
    const crown = spline([L, P(b, -0.6, -1.15), P(b, 0, -1.22), P(b, 0.6, -1.15), R], 8);
    const bottom = tips({ x: b.cx + halfW * 0.92, y: bottomY - 4 }, { x: b.cx - halfW * 0.92, y: bottomY - 4 }, jag, 10, 5);
    return poly([...crown, ...r.slice(1), ...bottom, ...l.slice(1)]);
  };
  const lenY = (t) => lerp(b.shoulderY + 10, b.hipY + 10, t);
  switch (style) {
    case "long":
      out.back.push(back(lenY(clamp(length, 0.3, 1)), b.s.shoulder * 0.95 + 4, 7));
      out.front.push(cap("full", 0.3), ...lockPair((lenY(clamp(length, 0.3, 1)) - b.head.c.y) * 0.62, rx * 0.42, 6));
      break;
    case "bob":
      out.back.push(back(b.head.c.y + ry * 1.25, rx * 1.38, 6));
      out.front.push(cap("full", 0.75));
      break;
    case "messy": {
      const L = clamp(length, 0, 1);
      out.back.push(back(lerp(b.head.c.y + ry * 0.9, lenY(0.3), L), rx * lerp(1.3, 1.55, L), 6));
      out.front.push(cap("side", lerp(0.3, 0.55, L)));
      if (L > 0.55)
        out.front.push(...lockPair(ry * lerp(0.8, 1.4, L), rx * 0.34, 10));
      break;
    }
    case "ponytail": {
      out.back.push(back(b.head.c.y + ry * 0.7, rx * 1.15, 4));
      out.back.push(poly(strand(P(b, 0.55, -0.85), { angle: 20, bend: 95, length: 60 + 130 * clamp(length, 0.2, 1), width: rx * 0.85, peak: 0.3, tip: 0.05, wave: 8 })));
      out.front.push(cap("side", 0.35));
      out.extra.push(`tie:${f(P(b, 0.8, -0.8).x)},${f(P(b, 0.8, -0.8).y)}`);
      break;
    }
    case "twintails":
      out.back.push(back(b.head.c.y + ry * 0.75, rx * 1.15, 4));
      for (const s of [-1, 1])
        out.back.push(poly(strand(P(b, s * 0.85, -0.7), { angle: 90 - s * 48, bend: s * 40, length: 70 + 140 * clamp(length, 0.2, 1), width: rx * 0.8, peak: 0.35, tip: 0.04, wave: 7, base: 0.5 })));
      out.front.push(cap("full", 0.3));
      break;
    case "bun":
      out.back.push(back(b.head.c.y + ry * 0.6, rx * 1.12, 4));
      out.front.push(cap("side", 0.25));
      out.front.push(ellipse(P(b, 0, -1.25), rx * 0.48, ry * 0.36));
      break;
    case "short":
      out.back.push(back(b.head.c.y + ry * (fem ? 0.75 : 0.45), rx * 1.12, 5));
      out.front.push(cap("short", fem ? 0.35 : 0));
      break;
    case "spiky":
      out.back.push(back(b.head.c.y + ry * 0.5, rx * 1.15, 5));
      out.front.push(cap("spiky", 0));
      break;
    case "buzz":
      out.front.push(cap("none", -0.15));
      break;
  }
  return out;
}
function animalEars(b, kind, colour) {
  if (kind === "elf")
    return null;
  const rx = b.head.rx, ry = b.head.ry;
  const outer = [], innerD = [], tipD = [];
  for (const s of [-1, 1]) {
    if (kind === "bunny") {
      const root = P(b, s * 0.38, -0.95);
      outer.push(poly(strand(root, { angle: -90 + s * 12, bend: s * 14, length: ry * 1.75, width: rx * 0.46, peak: 0.55, tip: 0.35, base: 0.6 })));
      innerD.push(poly(strand({ x: root.x, y: root.y - ry * 0.25 }, { angle: -90 + s * 12, bend: s * 14, length: ry * 1.35, width: rx * 0.22, peak: 0.6, tip: 0.3, base: 0.4 })));
      continue;
    }
    const big = kind === "fox" ? 1.15 : kind === "wolf" ? 1.05 : 0.85;
    const a = P(b, s * 0.2, -1), c = P(b, s * 0.98, -0.62);
    const tipP = P(b, s * (0.78 + 0.1 * big), -1 - 0.72 * big);
    const ear = spline([a, { x: lerp(a.x, tipP.x, 0.55) - s * 2, y: lerp(a.y, tipP.y, 0.6) }, tipP, { x: lerp(c.x, tipP.x, 0.5) + s * 2, y: lerp(c.y, tipP.y, 0.5) }, c], 6);
    outer.push(poly(ear));
    const k = 0.58;
    const ctr = { x: (a.x + c.x + tipP.x) / 3, y: (a.y + c.y + tipP.y) / 3 + 3 };
    innerD.push(poly(ear.map((p) => ({ x: ctr.x + (p.x - ctr.x) * k, y: ctr.y + (p.y - ctr.y) * k }))));
    if (kind === "fox" || kind === "wolf")
      tipD.push(poly([tipP, ...ear.filter((p) => p.y < tipP.y + ry * 0.3 * big)].sort((p, q) => p.x - q.x)));
  }
  const inner = kind === "cat" || kind === "bunny" ? "#f6a7b8" : kind === "fox" ? "#fff6ec" : light(colour, 0.45);
  return { fill: colour, inner, outer, innerD, tipD };
}
function tail(b, kind, colour) {
  const root = { x: b.cx + b.s.hip * 0.3, y: b.hipY - 4 };
  const main = [], tip = [];
  const add = (o, r = root, tipFrom = 0.78) => {
    main.push(poly(strand(r, o)));
    if (tipFrom < 1)
      tip.push(poly(strand(r, { ...o, t0: tipFrom })));
  };
  switch (kind) {
    case "fox":
      add({ angle: 30, bend: -105, length: 150, width: 58, peak: 0.55, tip: 0.02, base: 0.25 });
      break;
    case "kitsune":
      for (const [a, bend, len, dx] of [[35, -130, 140, 0.3], [-170, 105, 150, -0.3], [8, -95, 155, 0.3]])
        add({ angle: a, bend, length: len, width: 48, peak: 0.55, tip: 0.02, base: 0.25 }, { x: b.cx + b.s.hip * dx, y: b.hipY - 4 });
      break;
    case "wolf":
      add({ angle: 55, bend: -50, length: 140, width: 40, peak: 0.5, tip: 0.05, base: 0.35 }, root, 0.85);
      break;
    case "cat":
      add({ angle: 40, bend: -150, length: 170, width: 11, peak: 0.1, tip: 0.6, base: 0.9, wave: 18 }, root, 1);
      break;
    case "demon": {
      add({ angle: 40, bend: -120, length: 160, width: 7, peak: 0.1, tip: 0.5, base: 1, wave: 15 }, root, 1);
      const pts = strand(root, { angle: 40, bend: -120, length: 160, width: 7, wave: 15 });
      const end = pts[Math.floor(pts.length / 2) - 1];
      main.push(poly([{ x: end.x, y: end.y + 2 }, { x: end.x - 11, y: end.y - 6 }, { x: end.x + 1, y: end.y - 20 }, { x: end.x + 11, y: end.y - 4 }]));
      break;
    }
  }
  const tipColour = kind === "fox" || kind === "kitsune" ? "#fff8f0" : kind === "wolf" ? light(colour, 0.55) : colour;
  return { main, tip, tipColour };
}
function horns(b, kind) {
  const out = [];
  for (const s of [-1, 1]) {
    if (kind === "ram")
      out.push(poly(strand(P(b, s * 0.62, -0.85), { angle: -90 + s * 70, bend: s * 300, length: b.head.rx * 2.2, width: b.head.rx * 0.38, peak: 0.05, tip: 0.25, base: 1 })));
    else if (kind === "oni")
      out.push(poly(strand(P(b, s * 0.35, -0.98), { angle: -90 + s * 8, bend: s * -8, length: b.head.ry * 0.6, width: b.head.rx * 0.26, peak: 0.05, tip: 0.05, base: 1 })));
    else
      out.push(poly(strand(P(b, s * 0.5, -0.92), { angle: -90 + s * 35, bend: s * 40, length: b.head.ry * 0.75, width: b.head.rx * 0.22, peak: 0.05, tip: 0.04, base: 1 })));
  }
  return out;
}

// src/doll/garments.ts
var KINDS = ["top", "dress", "robe", "outer", "cape", "armor", "bottom", "skirt", "legwear", "shoes", "gloves", "sleeves", "hat", "neck", "belt", "sash", "apron", "bra", "briefs"];
var NECKLINES = ["crew", "scoop", "v", "wrap", "collar", "turtle", "boat", "strapless", "offshoulder", "halter"];
var SLEEVES = ["none", "cap", "short", "elbow", "three", "long"];
var SLEEVE_FITS = ["tight", "loose", "wide", "puff", "bell"];
var HEMS = ["crop", "waist", "hip", "thigh", "knee", "ankle"];
var LENGTHS = ["micro", "short", "mid", "knee", "calf", "ankle", "floor"];
var FITS = ["tight", "regular", "loose"];
var MATERIALS = ["cloth", "leather", "metal", "sheer", "knit", "silk"];
var PATTERNS = ["none", "stripes", "vstripes", "plaid", "check", "dots", "cow", "floral", "waves", "stars", "fishnet", "scales", "leopard"];
var STYLES = {
  hat: ["newsboy", "beanie", "witch", "sunhat", "cap", "crown", "tiara", "headband", "hood"],
  shoes: ["shoes", "boots", "heels", "sandals", "geta", "sneakers"],
  gloves: ["full", "fingerless"],
  neck: ["choker", "necklace", "scarf", "collar"],
  legwear: ["socks", "tights", "stockings"],
  bottom: ["pants", "shorts"],
  outer: ["jacket", "coat", "vest", "hoodie"]
};
var LAYER = {
  cape: 61,
  briefs: 8,
  bra: 9,
  legwear: 10,
  shoes: 20,
  bottom: 30,
  skirt: 34,
  top: 40,
  dress: 41,
  armor: 44,
  robe: 45,
  sash: 50,
  belt: 52,
  apron: 55,
  outer: 60,
  sleeves: 62,
  gloves: 65,
  neck: 70,
  hat: 90
};
var SLEEVE_T = { none: 0, cap: 0.1, short: 0.27, elbow: 0.5, three: 0.72, long: 0.98 };
var LEG_T = { micro: 0.05, short: 0.14, mid: 0.3, knee: 0.52, calf: 0.75, ankle: 0.97, floor: 1.08 };
var GROW = { tight: 0.9, regular: 2.2, loose: 4.5 };
var circ = (c, r, n = 22) => Array.from({ length: n }, (_, i) => ({ x: c.x + Math.cos(i / n * Math.PI * 2) * r, y: c.y + Math.sin(i / n * Math.PI * 2) * r }));
var ell = (c, rx, ry, n = 26, rot = 0) => Array.from({ length: n }, (_, i) => {
  const a = i / n * Math.PI * 2, x = Math.cos(a) * rx, y = Math.sin(a) * ry, r = rot * Math.PI / 180;
  return { x: c.x + x * Math.cos(r) - y * Math.sin(r), y: c.y + x * Math.sin(r) + y * Math.cos(r) };
});
function limbPolys(chain, grow = 0, caps = {}) {
  const js = chain.map((j) => ({ ...j, r: Math.max(0.5, j.r + grow) }));
  const out = [];
  for (let i = 0;i < js.length - 1; i++)
    out.push(hull(js[i], js[i + 1]));
  js.forEach((j, i) => {
    if (i === 0 && caps.start === false)
      return;
    if (i === js.length - 1 && caps.end === false)
      return;
    out.push(circ(j, j.r));
  });
  return out;
}
var clipAbove = (pts, y) => clipPoly(pts, { x: 0, y }, { x: 1, y }, 1);
var clipBelow = (pts, y) => clipPoly(pts, { x: 0, y }, { x: 1, y }, -1);
var both = (b, make, chain) => [...make(1, chain), ...make(-1, mirrorChain(b, chain))];
var flipX = (b, pts) => pts.map((p) => ({ x: 2 * b.cx - p.x, y: p.y }));
function handPoly(b, side, grow = 0) {
  const h = b.hand;
  const c = side === 1 ? h.c : { x: 2 * b.cx - h.c.x, y: h.c.y };
  const k = [[0, -1.05], [0.62, -0.7], [0.85, 0.1], [0.7, 0.75], [0.15, 1], [-0.45, 0.82], [-0.75, 0.3], [-1.05, -0.05], [-0.8, -0.35], [-0.55, -0.7]];
  return closedSpline(k.map(([u, v]) => ({ x: c.x + u * side * (h.rx + grow), y: c.y + v * (h.ry * 0.62 + grow) })), 5);
}
function footPoly(b, side, grow = 0) {
  if (side === -1)
    return flipX(b, footPoly(b, 1, grow));
  const ft = b.foot, ank = b.leg[b.leg.length - 1];
  const cx = side === 1 ? ft.c.x : 2 * b.cx - ft.c.x, ax = side === 1 ? ank.x : 2 * b.cx - ank.x;
  const g = grow;
  return closedSpline([
    { x: ax - ank.r - g, y: ank.y - 2 },
    { x: ax + ank.r + g, y: ank.y - 2 },
    { x: cx + ft.rx + g + side * 1.5, y: ft.c.y + 2 },
    { x: cx + ft.rx * 0.5 * side, y: b.ground + g * 0.5 },
    { x: cx - ft.rx * 0.5 * side, y: b.ground + g * 0.5 },
    { x: cx - ft.rx - g, y: ft.c.y + 1 }
  ], 6);
}
function skinShapes(b) {
  const trunk = [];
  trunk.push(trunkSlice(b, b.profile[0].y, b.crotchY - 4, 0, { hemDip: 8 }));
  if (b.breast)
    for (const s of [1, -1])
      trunk.push(s === 1 ? circ(b.breast, b.breast.r) : flipX(b, circ(b.breast, b.breast.r)));
  trunk.push(...both(b, (_s, c) => limbPolys(c), b.arm), ...both(b, (_s, c) => limbPolys(c), b.leg));
  for (const s of [1, -1])
    trunk.push(handPoly(b, s), footPoly(b, s));
  const lines = [];
  for (const s of [1, -1]) {
    const leg = s === 1 ? b.leg : mirrorChain(b, b.leg);
    const pts = [];
    for (let t = 0.06;t <= 0.5; t += 0.04) {
      const j = along(leg, t);
      if (j.y > b.crotchY - 2)
        pts.push({ x: j.x - s * j.r, y: j.y });
    }
    if (pts.length > 1)
      lines.push(line(pts));
  }
  return { trunk, lines };
}
function neckline(b, kind, grow) {
  const cx = b.cx;
  const onSlope = (nw) => {
    if (nw <= b.profile[0].x)
      return b.profile[0].y;
    for (let i = 1;i < b.profile.length; i++)
      if (b.profile[i].x >= nw)
        return lerp(b.profile[i - 1].y, b.profile[i].y, clamp((nw - b.profile[i - 1].x) / (b.profile[i].x - b.profile[i - 1].x || 1), 0, 1));
    return b.shoulderY;
  };
  const mk = (nw, depth, sharp = false) => {
    const y0 = onSlope(nw - grow);
    const L = { x: cx - nw, y: y0 }, R = { x: cx + nw, y: y0 }, B = { x: cx, y: y0 + depth };
    const top = sharp ? [L, B, R] : spline([L, { x: cx - nw * 0.6, y: y0 + depth * 0.75 }, B, { x: cx + nw * 0.6, y: y0 + depth * 0.75 }, R], 6);
    return { top, y0, cut: { a: R, b: B } };
  };
  const n = b.s.neck;
  switch (kind) {
    default:
    case "crew":
    case "turtle":
      return mk(n + 3, 6);
    case "collar":
      return mk(n + 2.5, 9, true);
    case "scoop":
      return mk(lerp(n, b.s.shoulder, 0.45), b.bustY - b.neckBot - 6 - b.s.bust * 3);
    case "boat":
      return mk(lerp(n, b.s.shoulder, 0.72), 5);
    case "v":
      return mk(n + 5, b.bustY - b.neckBot + 4, true);
    case "wrap": {
      const nk = mk(n + 3, b.underY - b.neckBot - 4, true);
      nk.top[1] = { x: cx - 7, y: nk.top[1].y };
      return nk;
    }
    case "halter": {
      const y0 = b.bustY - 12 - b.s.bust * 6;
      const w = widthAt(b, y0) + grow;
      return { y0, top: [{ x: cx - w, y: y0 }, { x: cx - n * 0.6, y: b.neckBot - 2 }, { x: cx + n * 0.6, y: b.neckBot - 2 }, { x: cx + w, y: y0 }] };
    }
    case "strapless":
    case "offshoulder": {
      const y0 = kind === "offshoulder" ? b.armpitY - 6 : b.bustY - 9 - b.s.bust * 6;
      const w = widthAt(b, y0) + grow;
      const bx = b.breast ? b.breast.x - cx : w * 0.5;
      const top = spline([{ x: cx - w, y: y0 + 2 }, { x: cx - bx, y: y0 - 2 }, { x: cx, y: y0 + 4 }, { x: cx + bx, y: y0 - 2 }, { x: cx + w, y: y0 + 2 }], 6);
      return { y0, top };
    }
  }
}
function hemY(b, hem) {
  return { crop: b.underY + 3, waist: b.waistY + 6, hip: b.hipY - 2, thigh: b.hipY + 4, knee: b.hipY + 4, ankle: b.hipY + 4 }[hem];
}
function skirtShape(b, y0, len, flare, grow) {
  const y1 = Math.max(b.crotchY + 8, Math.min(b.ground - 4, b.legY(LEG_T[len]) + (len === "floor" ? 30 : 0)));
  const legOut = (y) => {
    let w = 0;
    for (let t = 0;t <= 1; t += 0.05) {
      const j = along(b.leg, t);
      if (Math.abs(j.y - y) < 16)
        w = Math.max(w, j.x - b.cx + j.r);
    }
    return w;
  };
  const ys = [];
  for (let y = y0;y < y1; y += 8)
    ys.push(y);
  ys.push(y1);
  const wAt = (y) => {
    const k = (y - y0) / Math.max(1, y1 - y0);
    const natural = Math.max(widthAt(b, Math.min(y, b.crotchY)) + grow, legOut(y) + grow + 2);
    return natural + flare * Math.min(46, (y1 - y0) * 0.6) * k ** 1.2;
  };
  let maxSoFar = 0;
  const ws = ys.map((y) => maxSoFar = Math.max(maxSoFar, wAt(y)));
  const right = ys.map((y, i) => ({ x: b.cx + ws[i], y }));
  const left = ys.map((y, i) => ({ x: b.cx - ws[i], y })).reverse();
  const W = ws[ws.length - 1];
  const hem = spline([{ x: b.cx + W, y: y1 }, { x: b.cx + W * 0.5, y: y1 + 3 + flare * 4 }, { x: b.cx, y: y1 + 4 + flare * 5 }, { x: b.cx - W * 0.5, y: y1 + 3 + flare * 4 }, { x: b.cx - W, y: y1 }], 5);
  return { pts: [...right, ...hem.slice(1, -1), ...left], y1 };
}
function sleevePolys(b, side, len, fit, grow, start = 0) {
  const arm = side === 1 ? b.arm : mirrorChain(b, b.arm);
  const polys = [], lines = [];
  let handsOver = false;
  if (len <= start)
    return { polys, lines, handsOver };
  const seg = segment(arm, start, len);
  const end = seg[seg.length - 1];
  const prev = seg[seg.length - 2] ?? seg[0];
  const dir = Math.atan2(end.y - prev.y, end.x - prev.x);
  const cuff = (r) => {
    const n = { x: Math.cos(dir + Math.PI / 2) * r, y: Math.sin(dir + Math.PI / 2) * r };
    return line([{ x: end.x - n.x, y: end.y - n.y }, { x: end.x + n.x, y: end.y + n.y }]);
  };
  switch (fit) {
    case "tight":
      polys.push(...limbPolys(seg, grow, { start: start > 0 ? false : undefined, end: false }));
      break;
    case "loose":
    case "bell": {
      const R = Math.max(...seg.map((j) => j.r)) + grow + 1.5;
      const flareEnd = fit === "bell" ? R * 1.9 : R + 2;
      const js = seg.map((j, i) => ({ ...j, r: lerp(R, flareEnd, (i / (seg.length - 1)) ** 2) }));
      polys.push(...limbPolys(js, 0, { start: start > 0 ? false : undefined, end: false }));
      lines.push({ d: cuff(flareEnd), c: "shade" });
      if (fit === "bell")
        handsOver = true;
      break;
    }
    case "puff": {
      const top = along(arm, start > 0 ? start + 0.06 : 0.1);
      polys.push(circ({ x: top.x + side * 2, y: top.y }, top.r * 1.75 + grow));
      polys.push(...limbPolys(seg, grow, { end: false }));
      lines.push({ d: cuff(end.r + grow), c: "ink" });
      break;
    }
    case "wide": {
      const j0 = seg[0];
      const R = Math.max(18, end.r * 4.2);
      const drop = 34 + end.r * 2;
      polys.push(closedSpline([
        { x: j0.x - side * j0.r * 0.3, y: j0.y - j0.r - grow },
        { x: j0.x + side * (j0.r + grow + 3), y: j0.y + 2 },
        { x: lerp(j0.x, end.x, 0.5) + side * (R * 0.55 + 2), y: lerp(j0.y, end.y, 0.5) },
        { x: end.x + side * R * 0.62, y: end.y + 2 },
        { x: end.x + side * R * 0.55, y: end.y + drop },
        { x: end.x - side * R * 0.2, y: end.y + drop + 4 },
        { x: end.x - side * R * 0.75, y: end.y + drop - 6 },
        { x: lerp(j0.x, end.x, 0.55) - side * (j0.r + 6), y: lerp(j0.y, end.y, 0.55) },
        { x: j0.x - side * j0.r * 1.2, y: j0.y + j0.r * 1.5 }
      ], 5));
      lines.push({ d: `M${f(end.x - side * R * 0.45)} ${f(end.y - 3)}Q${f(end.x)} ${f(end.y + 6)} ${f(end.x + side * R * 0.55)} ${f(end.y + 1)}`, c: "ink" });
      lines.push({ d: line([{ x: end.x - side * R * 0.1, y: end.y + 12 }, { x: end.x, y: end.y + drop - 2 }]), c: "shade" });
      handsOver = true;
      break;
    }
  }
  return { polys, lines, handsOver };
}
function trunkPiece(b, g, grow) {
  const nk = neckline(b, g.neckline ?? "crew", grow);
  const sleeves = g.neckline === "strapless" || g.neckline === "halter" ? "none" : g.sleeves ?? "short";
  const hem = g.hem ?? "hip";
  const y1 = hemY(b, hem);
  const lines = [];
  const sleeveless = sleeves === "none" && g.neckline !== "offshoulder";
  const maxW = sleeveless ? (y) => y < b.armpitY + 2 ? lerp(Math.abs(nk.top[nk.top.length - 1].x - b.cx) + 4, widthAt(b, b.armpitY) + grow, clamp((y - nk.y0) / Math.max(1, b.armpitY - nk.y0), 0, 1) ** 0.7) : 999 : undefined;
  let body = trunkSlice(b, nk.y0, y1, grow, { maxW, top: nk.top, hemDip: hem === "crop" ? 0 : 3 });
  const pieces = [body];
  if (b.breast && (g.fit ?? "regular") !== "loose" && hem !== "crop" || b.breast && hem === "crop") {
    for (const s of [1, -1]) {
      let c = circ({ x: b.breast.x, y: b.breast.y }, b.breast.r + grow * 0.7);
      if (s === -1)
        c = flipX(b, c);
      c = clipAbove(c, nk.y0 + 1);
      if (nk.cut)
        c = clipAbove(c, nk.cut.b.y);
      if (c.length > 2)
        pieces.push(c);
    }
  }
  const trunk = pieces.length;
  let handsOver = false;
  if (sleeves !== "none" || g.neckline === "offshoulder") {
    const t = sleeves === "none" ? 0.2 : SLEEVE_T[sleeves];
    for (const s of [1, -1]) {
      const sl = sleevePolys(b, s, t, g.sleeveFit ?? "tight", grow, g.neckline === "offshoulder" ? 0.12 : 0);
      pieces.push(...sl.polys);
      lines.push(...sl.lines);
      handsOver ||= sl.handsOver;
    }
  }
  const chin = b.head.c.y + b.head.ry * 0.97;
  if (g.neckline === "turtle")
    pieces.push([{ x: b.cx - b.s.neck - 2, y: chin }, { x: b.cx + b.s.neck + 2, y: chin }, { x: b.cx + b.s.neck + 4, y: b.neckBot + 4 }, { x: b.cx - b.s.neck - 4, y: b.neckBot + 4 }]);
  if (g.neckline === "collar") {
    for (const s of [1, -1])
      lines.push({ d: line([{ x: b.cx + s * (b.s.neck + 3), y: nk.y0 - 1 }, { x: b.cx + s * (b.s.neck + 9), y: nk.y0 + 12 }, { x: b.cx + s * 1, y: nk.y0 + 10 }]), w: 1.2 });
  }
  if (g.neckline === "wrap") {
    const B = nk.top[1];
    lines.push({ d: line([{ x: nk.top[2].x, y: nk.top[2].y }, B, { x: b.cx - widthAt(b, y1 - 20) - grow + 2, y: y1 - 6 }]), w: 1.3 });
  }
  return { pieces, trunk, lines, handsOver };
}
function build(b, g) {
  const out = { pieces: [], back: [], trim: [], lines: [] };
  const grow = GROW[g.fit ?? "regular"] + (g.material === "metal" ? 1.5 : g.material === "knit" ? 0.6 : 0);
  const cx = b.cx;
  switch (g.kind) {
    case "top":
    case "armor": {
      const t = trunkPiece(b, { ...g, hem: g.hem ?? (g.kind === "armor" ? "waist" : "hip") }, grow);
      out.pieces.push(...t.pieces);
      out.lines.push(...t.lines);
      out.handsOver = t.handsOver;
      if (g.hem === "knee" || g.hem === "ankle")
        out.pieces.push(skirtShape(b, b.hipY - 6, g.hem, 0.12, grow).pts);
      if (g.kind === "armor") {
        for (const s of [1, -1]) {
          const j = s === 1 ? b.arm[0] : { ...b.arm[0], x: 2 * cx - b.arm[0].x };
          out.trim.push(ell({ x: j.x + s * 3, y: j.y + 2 }, j.r * 1.75, j.r * 1.4, 22, s * 25));
        }
        out.lines.push({ d: line([{ x: cx, y: b.neckBot + 8 }, { x: cx, y: b.waistY }]), c: "light", w: 1.5 });
        out.lines.push({ d: `M${f(cx - b.s.waist)} ${f(b.underY + 6)}Q${f(cx)} ${f(b.underY + 14)} ${f(cx + b.s.waist)} ${f(b.underY + 6)}`, c: "shade", w: 1.3 });
      }
      if (g.neckline === "collar" && !g.open)
        for (let y = b.bustY - 8;y < hemY(b, g.hem ?? "hip") - 8; y += 16)
          out.trim.push(circ({ x: cx + 0.5, y }, 1.5, 8));
      break;
    }
    case "dress":
    case "robe": {
      const robe = g.kind === "robe";
      const t = trunkPiece(b, { ...g, neckline: g.neckline ?? (robe ? "wrap" : "scoop"), sleeves: g.sleeves ?? (robe ? "long" : "none"), sleeveFit: g.sleeveFit ?? (robe ? "wide" : "tight"), hem: "waist" }, grow);
      out.pieces.push(...t.pieces);
      out.lines.push(...t.lines);
      out.handsOver = t.handsOver;
      const sk = skirtShape(b, b.waistY - 2, g.length ?? (robe ? "ankle" : "knee"), g.flare ?? (robe ? 0.15 : 0.5), grow);
      out.pieces.push(sk.pts);
      if (robe)
        out.lines.push({ d: line([{ x: cx - widthAt(b, b.waistY) - grow + 2, y: b.waistY + 4 }, { x: cx - 4, y: sk.y1 + 3 }]), w: 1.2 });
      else
        out.lines.push({ d: `M${f(cx - widthAt(b, b.waistY) - grow)} ${f(b.waistY + 2)}Q${f(cx)} ${f(b.waistY + 5)} ${f(cx + widthAt(b, b.waistY) + grow)} ${f(b.waistY + 2)}`, c: "shade", w: 1 });
      if ((g.flare ?? 0.5) > 0.3 && !robe)
        pleats(out, cx, b.waistY + 8, sk.y1, sk.pts);
      break;
    }
    case "outer": {
      const style = g.style ?? "jacket";
      const t = trunkPiece(b, { ...g, neckline: g.neckline ?? (style === "hoodie" ? "crew" : "v"), sleeves: style === "vest" ? "none" : g.sleeves ?? "long", sleeveFit: g.sleeveFit ?? "loose", hem: style === "coat" ? "hip" : g.hem ?? "hip" }, grow + 1.2);
      let pieces = t.pieces;
      const coatTail = style === "coat" ? skirtShape(b, b.hipY - 6, g.length ?? "knee", g.flare ?? 0.3, grow + 2).pts : null;
      if (g.open ?? style !== "hoodie") {
        const gapTop = b.s.neck + 3, gapBot = 7;
        const { neckBot: yTop, ground: yBot } = b;
        const trunkLike = pieces.slice(0, t.trunk);
        const rest = pieces.slice(t.trunk);
        const halves = [];
        for (const p of [...trunkLike, ...coatTail ? [coatTail] : []]) {
          halves.push(clipPoly(p, { x: cx + gapTop, y: yTop }, { x: cx + gapBot, y: b.waistY }, -1));
          halves.push(clipPoly(p, { x: cx - gapTop, y: yTop }, { x: cx - gapBot, y: b.waistY }, 1));
        }
        pieces = [...halves, ...rest].filter((h) => h.length > 2);
        for (const s of [1, -1])
          out.lines.push({ d: line([{ x: cx + s * (b.s.neck + 3), y: b.neckBot - 2 }, { x: cx + s * (b.s.neck + 12), y: b.bustY - 4 }, { x: cx + s * gapBot * 1.6, y: b.underY + 6 }]), w: 1.3 });
      } else if (coatTail)
        pieces.push(coatTail);
      if (style === "hoodie") {
        out.back.push(closedSpline([{ x: cx - b.s.neck - 16, y: b.shoulderY + 4 }, { x: cx - b.s.neck - 14, y: b.neckTop - 4 }, { x: cx, y: b.neckTop - 14 }, { x: cx + b.s.neck + 14, y: b.neckTop - 4 }, { x: cx + b.s.neck + 16, y: b.shoulderY + 4 }], 6));
        out.lines.push({ d: line([{ x: cx - 4, y: b.neckBot + 2 }, { x: cx - 5, y: b.bustY + 6 }]), w: 1.2 }, { d: line([{ x: cx + 4, y: b.neckBot + 2 }, { x: cx + 5, y: b.bustY + 6 }]), w: 1.2 });
        const py = b.waistY + 6;
        out.lines.push({ d: `M${f(cx - 20)} ${f(b.hipY - 8)}L${f(cx - 14)} ${f(py)}L${f(cx + 14)} ${f(py)}L${f(cx + 20)} ${f(b.hipY - 8)}`, w: 1.1 });
      }
      if (style !== "vest") {
        const sleeveT = SLEEVE_T[g.sleeves ?? "long"];
        const yEnd = Math.min(hemY(b, style === "coat" ? "hip" : g.hem ?? "hip"), along(b.arm, sleeveT).y);
        for (const s of [1, -1]) {
          const arm = s === 1 ? b.arm : mirrorChain(b, b.arm);
          const inner = [];
          for (let k = 0.08;k <= sleeveT + 0.000000001; k += 0.06) {
            const j = along(arm, k);
            if (j.y <= yEnd)
              inner.push({ x: j.x - s * (j.r + grow), y: j.y });
          }
          if (inner.length < 2)
            continue;
          const side = inner.map((p) => ({ x: cx + s * (widthAt(b, p.y) + grow - 1), y: p.y })).reverse();
          pieces.push([...inner, ...side]);
          out.lines.push({ d: line(inner.map((p) => ({ x: p.x + s * 0.5, y: p.y }))), c: "shade", w: 1.1 });
        }
      }
      out.pieces.push(...pieces);
      out.lines.push(...t.lines);
      out.handsOver = t.handsOver;
      break;
    }
    case "cape": {
      const top = b.neckBot - 2;
      const y1 = b.legY(LEG_T[g.length ?? "calf"]);
      const W = b.s.shoulder + 14;
      out.back.push([{ x: cx - b.s.neck - 2, y: top }, { x: cx + b.s.neck + 2, y: top }, { x: cx + W, y: b.shoulderY + 10 }, { x: cx + W + 18, y: y1 }, { x: cx, y: y1 + 6 }, { x: cx - W - 18, y: y1 }, { x: cx - W, y: b.shoulderY + 10 }]);
      out.pieces.push(closedSpline([{ x: cx - b.s.neck - 3, y: top - 2 }, { x: cx + b.s.neck + 3, y: top - 2 }, { x: cx + W + 4, y: b.armpitY + 4 }, { x: cx + W - 10, y: b.armpitY + 14 }, { x: cx, y: b.armpitY + 6 }, { x: cx - W + 10, y: b.armpitY + 14 }, { x: cx - W - 4, y: b.armpitY + 4 }], 6));
      out.trim.push(circ({ x: cx, y: b.neckBot + 4 }, 4, 12));
      break;
    }
    case "bottom": {
      const shorts = g.style === "shorts" || ["micro", "short", "mid"].includes(g.length ?? "ankle");
      const t = LEG_T[g.length ?? (shorts ? "short" : "ankle")];
      const riseY = { high: b.waistY - 4, mid: b.waistY + 8, low: lerp(b.waistY, b.hipY, 0.62) }[g.rise ?? "mid"];
      out.pieces.push(trunkSlice(b, riseY, b.crotchY + 4, grow, { hemDip: 4 }));
      const loose = g.fit === "loose";
      for (const s of [1, -1]) {
        const leg = s === 1 ? b.leg : mirrorChain(b, b.leg);
        let seg = segment(leg, 0, Math.min(1, t));
        if (loose) {
          const R = Math.min(Math.max(...seg.map((j) => j.r)), Math.abs(leg[0].x - cx) - 1);
          seg = seg.map((j, i) => ({ ...j, r: Math.max(j.r, lerp(R, R * 0.7, i / Math.max(1, seg.length - 1))) }));
        }
        for (const p of limbPolys(seg, grow, { end: false })) {
          const c = clipAbove(p, riseY);
          if (c.length > 2)
            out.pieces.push(c);
        }
        const e = seg[seg.length - 1];
        if (!shorts)
          out.lines.push({ d: line([{ x: e.x - s * (e.r * 0.2), y: b.crotchY + 14 }, { x: e.x - s * (e.r * 0.15), y: e.y - 6 }]), c: "shade", w: 1 });
      }
      out.lines.push({ d: line([{ x: cx, y: riseY + 3 }, { x: cx, y: b.crotchY - 2 }]), w: 1 });
      break;
    }
    case "skirt": {
      const riseY = { high: b.waistY - 4, mid: b.waistY + 6, low: lerp(b.waistY, b.hipY, 0.55) }[g.rise ?? "mid"];
      const sk = skirtShape(b, riseY, g.length ?? "short", g.flare ?? 0.45, grow);
      out.pieces.push(sk.pts);
      if ((g.flare ?? 0.45) > 0.25)
        pleats(out, cx, riseY + 8, sk.y1, sk.pts);
      out.trim.push(trunkSlice(b, riseY - 1, riseY + 5, grow + 0.6));
      break;
    }
    case "legwear": {
      const style = g.style ?? "socks";
      const t = style === "tights" ? 0 : clamp(LEG_T[g.length ?? (style === "stockings" ? "short" : "calf")] + 0.02, 0.06, 0.9);
      for (const s of [1, -1]) {
        const leg = s === 1 ? b.leg : mirrorChain(b, b.leg);
        out.pieces.push(...limbPolys(segment(leg, t, 1), 0.7, { start: false }), footPoly(b, s, 0.7));
        if (style !== "tights") {
          const top = along(leg, t);
          out.trim.push(clipBelow(clipAbove(circ(top, top.r + 0.9, 18), top.y - 1), top.y + 4));
          out.trim.push([{ x: top.x - top.r - 1, y: top.y }, { x: top.x + top.r + 1, y: top.y }, { x: top.x + top.r + 1, y: top.y + 4 }, { x: top.x - top.r - 1, y: top.y + 4 }]);
        }
      }
      if (style === "tights")
        out.pieces.push(trunkSlice(b, lerp(b.waistY, b.hipY, 0.3), b.crotchY + 4, 0.6, { hemDip: 4 }));
      break;
    }
    case "shoes": {
      const style = g.style ?? "shoes";
      for (const s of [1, -1]) {
        const leg = s === 1 ? b.leg : mirrorChain(b, b.leg);
        const foot = footPoly(b, s, style === "boots" ? 2.2 : 1.4);
        if (style === "sandals" || style === "geta") {
          const ft = s === 1 ? b.foot.c : { x: 2 * cx - b.foot.c.x, y: b.foot.c.y };
          out.pieces.push([{ x: ft.x - b.foot.rx - 2, y: b.ground - 1 }, { x: ft.x + b.foot.rx + 2, y: b.ground - 1 }, { x: ft.x + b.foot.rx + 2, y: b.ground + (style === "geta" ? 9 : 3) }, { x: ft.x - b.foot.rx - 2, y: b.ground + (style === "geta" ? 9 : 3) }]);
          out.lines.push({ d: line([{ x: ft.x - b.foot.rx * 0.6, y: ft.y + 2 }, { x: ft.x, y: ft.y - 6 }, { x: ft.x + b.foot.rx * 0.6, y: ft.y + 2 }]), c: "trim", w: 2.4 });
          continue;
        }
        out.pieces.push(foot);
        if (style === "boots") {
          const t0 = clamp(LEG_T[g.length ?? "calf"], 0.3, 0.88);
          out.pieces.push(...limbPolys(segment(leg, t0, 1), 2.2, { start: false }));
          const top = along(leg, t0);
          out.trim.push([{ x: top.x - top.r - 3.2, y: top.y - 1 }, { x: top.x + top.r + 3.2, y: top.y - 1 }, { x: top.x + top.r + 3, y: top.y + 6 }, { x: top.x - top.r - 3, y: top.y + 6 }]);
        }
        const ft = s === 1 ? b.foot.c : { x: 2 * cx - b.foot.c.x, y: b.foot.c.y };
        if (style === "sneakers") {
          out.trim.push([{ x: ft.x - b.foot.rx - 1.5, y: b.ground - 4 }, { x: ft.x + b.foot.rx + 1.5, y: b.ground - 4 }, { x: ft.x + b.foot.rx * 0.5, y: b.ground + 1.5 }, { x: ft.x - b.foot.rx * 0.5, y: b.ground + 1.5 }]);
          for (let i = 0;i < 3; i++)
            out.lines.push({ d: line([{ x: ft.x - 3, y: ft.y - 6 + i * 4 }, { x: ft.x + 3, y: ft.y - 6 + i * 4 }]), c: "light", w: 1 });
        }
        if (style === "heels")
          out.lines.push({ d: line([{ x: ft.x - 4 * s, y: ft.y - 2 }, { x: ft.x + 2 * s, y: ft.y + 6 }]), c: "light", w: 1.2 });
      }
      break;
    }
    case "gloves": {
      const fingerless = g.style === "fingerless";
      const t0 = 1 - SLEEVE_T[g.sleeves ?? "cap"] * 1;
      for (const s of [1, -1]) {
        const arm = s === 1 ? b.arm : mirrorChain(b, b.arm);
        const t = clamp(t0, 0.05, 0.92);
        out.pieces.push(...limbPolys(segment(arm, t, 1), 1, { start: false }));
        let h = handPoly(b, s, 1);
        if (fingerless)
          h = clipBelow(h, b.hand.c.y + b.hand.ry * 0.12);
        out.pieces.push(h);
        const top = along(arm, t);
        out.trim.push([{ x: top.x - top.r - 2, y: top.y - 1 }, { x: top.x + top.r + 2, y: top.y - 1 }, { x: top.x + top.r + 2, y: top.y + 4 }, { x: top.x - top.r - 2, y: top.y + 4 }]);
      }
      break;
    }
    case "sleeves": {
      for (const s of [1, -1]) {
        const sl = sleevePolys(b, s, Math.max(0.6, SLEEVE_T[g.sleeves ?? "long"]), g.sleeveFit ?? "bell", grow, 0.3);
        out.pieces.push(...sl.polys);
        out.lines.push(...sl.lines);
        const arm = s === 1 ? b.arm : mirrorChain(b, b.arm);
        const top = along(arm, 0.3);
        out.trim.push([{ x: top.x - top.r - 3, y: top.y - 2 }, { x: top.x + top.r + 3, y: top.y - 2 }, { x: top.x + top.r + 3, y: top.y + 3 }, { x: top.x - top.r - 3, y: top.y + 3 }]);
      }
      break;
    }
    case "bra": {
      const y0 = b.bustY - 7 - b.s.bust * 6;
      const top = spline([{ x: cx - widthAt(b, y0) - 1, y: y0 + 3 }, { x: cx - (b.breast ? b.breast.x - cx : 10), y: y0 - 3 }, { x: cx, y: y0 + 7 }, { x: cx + (b.breast ? b.breast.x - cx : 10), y: y0 - 3 }, { x: cx + widthAt(b, y0) + 1, y: y0 + 3 }], 6);
      out.pieces.push(trunkSlice(b, y0, b.underY + 1, 1, { top }));
      if (b.breast)
        for (const s of [1, -1]) {
          let c = circ(b.breast, b.breast.r + 1);
          if (s === -1)
            c = flipX(b, c);
          c = clipAbove(c, y0 + 1);
          out.pieces.push(c);
        }
      for (const s of [1, -1])
        out.lines.push({ d: line([{ x: cx + s * (b.s.chest * 0.4), y: y0 }, { x: cx + s * lerp(b.s.neck, b.s.shoulder, 0.55), y: b.shoulderY - 2 }]), c: "trim", w: 1.8 });
      break;
    }
    case "briefs": {
      const y0 = lerp(b.waistY, b.hipY, b.sex === "m" ? 0.4 : 0.6);
      const w0 = widthAt(b, y0) + 1;
      const end = b.sex === "m" ? 15 : 7;
      out.pieces.push(trunkSlice(b, y0, b.crotchY + 5, 1, { maxW: (y) => lerp(w0, end, clamp((y - y0) / (b.crotchY + 5 - y0), 0, 1) ** (b.sex === "m" ? 1.6 : 1.15)), hemDip: 2 }));
      out.trim.push(trunkSlice(b, y0 - 0.5, y0 + 3, 1.5));
      break;
    }
    case "hat":
      hat(b, g, out);
      break;
    case "neck": {
      const style = g.style ?? "choker";
      const n = b.s.neck;
      const chin = b.head.c.y + b.head.ry * 0.98;
      const ny = lerp(chin, b.neckBot, 0.45);
      if (style === "choker" || style === "collar") {
        out.pieces.push([{ x: cx - n - 1.5, y: ny - 3 }, { x: cx + n + 1.5, y: ny - 3 }, { x: cx + n + 2, y: ny + 3 }, { x: cx - n - 2, y: ny + 3 }]);
        if (style === "collar")
          out.trim.push(circ({ x: cx, y: ny + 7 }, 4, 14));
        else
          out.trim.push(closedSpline([{ x: cx, y: ny + 4 }, { x: cx + 4, y: ny + 8 }, { x: cx, y: ny + 13 }, { x: cx - 4, y: ny + 8 }], 4));
      } else if (style === "necklace") {
        out.lines.push({ d: `M${f(cx - n - 1)} ${f(b.neckBot - 3)}Q${f(cx)} ${f(b.bustY + 4)} ${f(cx + n + 1)} ${f(b.neckBot - 3)}`, c: "trim", w: 1.4 });
        const py = lerp(b.neckBot, b.bustY + 4, 0.55);
        out.trim.push(closedSpline([{ x: cx, y: py - 2 }, { x: cx + 5, y: py - 6 }, { x: cx + 7, y: py + 0 }, { x: cx, y: py + 9 }, { x: cx - 7, y: py }, { x: cx - 5, y: py - 6 }], 4));
      } else if (style === "scarf") {
        out.pieces.push(closedSpline([{ x: cx - n - 6, y: chin + 1 }, { x: cx + n + 6, y: chin + 1 }, { x: cx + n + 12, y: b.neckBot + 4 }, { x: cx, y: b.neckBot + 12 }, { x: cx - n - 12, y: b.neckBot + 4 }], 6));
        out.pieces.push([{ x: cx + n - 2, y: b.neckBot }, { x: cx + n + 10, y: b.neckBot + 2 }, { x: cx + n + 14, y: b.bustY + 30 }, { x: cx + n + 2, y: b.bustY + 32 }]);
        out.lines.push({ d: line([{ x: cx + n + 3, y: b.bustY + 31 }, { x: cx + n + 3, y: b.bustY + 36 }]), w: 1 }, { d: line([{ x: cx + n + 8, y: b.bustY + 31 }, { x: cx + n + 9, y: b.bustY + 36 }]), w: 1 });
      }
      break;
    }
    case "belt": {
      const y = g.rise === "low" ? lerp(b.waistY, b.hipY, 0.55) : b.waistY + 5;
      out.pieces.push(trunkSlice(b, y - 3.5, y + 3.5, 3.2));
      out.trim.push([{ x: cx - 6, y: y - 5 }, { x: cx + 6, y: y - 5 }, { x: cx + 6, y: y + 5 }, { x: cx - 6, y: y + 5 }]);
      break;
    }
    case "sash": {
      out.pieces.push(trunkSlice(b, b.underY - 2, b.waistY + 8, GROW.regular + 3.5));
      out.lines.push({ d: `M${f(cx - widthAt(b, b.waistY) - 5)} ${f(lerp(b.underY, b.waistY, 0.55))}L${f(cx + widthAt(b, b.waistY) + 5)} ${f(lerp(b.underY, b.waistY, 0.55))}`, c: "trim", w: 2.6 });
      out.trim.push(circ({ x: cx + 4, y: lerp(b.underY, b.waistY, 0.55) }, 3, 12));
      break;
    }
    case "apron": {
      const y0 = b.waistY + 2, y1 = b.legY(LEG_T[g.length ?? "knee"]) - 6;
      const w0 = b.s.waist * 0.75, w1 = b.s.hip * 0.78;
      const ym = lerp(y0, y1, 0.3);
      out.pieces.push([{ x: cx - w0, y: y0 }, { x: cx + w0, y: y0 }, { x: cx + w1, y: ym }, { x: cx + w1, y: y1 - 6 }, { x: cx + w1 - 6, y: y1 }, { x: cx - w1 + 6, y: y1 }, { x: cx - w1, y: y1 - 6 }, { x: cx - w1, y: ym }]);
      out.pieces.push([{ x: cx - b.s.chest * 0.45, y: b.bustY - 10 }, { x: cx + b.s.chest * 0.45, y: b.bustY - 10 }, { x: cx + b.s.waist * 0.7, y: y0 + 2 }, { x: cx - b.s.waist * 0.7, y: y0 + 2 }]);
      for (const s of [1, -1])
        out.lines.push({ d: line([{ x: cx + s * b.s.chest * 0.42, y: b.bustY - 9 }, { x: cx + s * lerp(b.s.neck, b.s.shoulder, 0.5), y: b.shoulderY - 1 }]), c: "trim", w: 2.4 });
      out.lines.push({ d: line([{ x: cx - w1 + 3, y: y1 - 3 }, { x: cx, y: y1 }, { x: cx + w1 - 3, y: y1 - 3 }]), c: "shade", w: 1 });
      break;
    }
  }
  return out;
}
function pleats(out, cx, y0, y1, shape) {
  const w = Math.max(...shape.map((p) => Math.abs(p.x - cx)));
  for (const k of [-0.62, -0.25, 0.25, 0.62])
    out.lines.push({ d: line([{ x: cx + k * w * 0.45, y: y0 }, { x: cx + k * w * 0.92, y: y1 - 1 }]), c: "shade", w: 1 });
}
function hat(b, g, out) {
  const rx = b.head.rx;
  switch (g.style ?? "newsboy") {
    case "newsboy":
      out.pieces.push(closedSpline([P(b, -1.18, -0.42), P(b, -1.3, -0.85), P(b, -0.7, -1.38), P(b, 0.2, -1.42), P(b, 1.1, -1.18), P(b, 1.25, -0.6), P(b, 1.12, -0.38), P(b, 0, -0.5)], 7));
      out.trim.push(closedSpline([P(b, -0.7, -0.5), P(b, 0, -0.62), P(b, 0.7, -0.5), P(b, 0.55, -0.28), P(b, 0, -0.24), P(b, -0.55, -0.28)], 6));
      out.lines.push({ d: `M${f(P(b, -1.05, -0.62).x)} ${f(P(b, -1.05, -0.62).y)}Q${f(P(b, 0, -0.78).x)} ${f(P(b, 0, -0.78).y)} ${f(P(b, 1.1, -0.6).x)} ${f(P(b, 1.1, -0.6).y)}`, c: "shade", w: 1.2 });
      out.trim.push(circ(P(b, 0.1, -1.38), 2.6, 10));
      break;
    case "beanie":
      out.pieces.push(closedSpline([P(b, -1.14, -0.42), P(b, -1.12, -0.95), P(b, -0.5, -1.32), P(b, 0.5, -1.32), P(b, 1.12, -0.95), P(b, 1.14, -0.42)], 8));
      out.trim.push(closedSpline([P(b, -1.18, -0.62), P(b, 0, -0.72), P(b, 1.18, -0.62), P(b, 1.18, -0.34), P(b, 0, -0.42), P(b, -1.18, -0.34)], 6));
      out.trim.push(circ(P(b, 0, -1.4), rx * 0.24, 14));
      break;
    case "witch": {
      out.pieces.push(ell(P(b, 0, -0.72), rx * 2.25, b.head.ry * 0.3, 32));
      out.pieces.push(spline([P(b, -0.95, -0.7), P(b, -0.5, -1.6), P(b, 0.1, -2.5), P(b, 0.9, -2.9), P(b, 0.55, -2.3), P(b, 0.6, -1.4), P(b, 0.95, -0.7)], 6));
      out.trim.push(closedSpline([P(b, -0.92, -0.9), P(b, 0, -0.98), P(b, 0.93, -0.9), P(b, 0.95, -0.72), P(b, 0, -0.78), P(b, -0.95, -0.72)], 6));
      break;
    }
    case "sunhat":
      out.pieces.push(ell(P(b, 0, -0.7), rx * 2.05, b.head.ry * 0.42, 32));
      out.pieces.push(closedSpline([P(b, -0.95, -0.72), P(b, -0.85, -1.25), P(b, 0, -1.45), P(b, 0.85, -1.25), P(b, 0.95, -0.72)], 7));
      out.trim.push(closedSpline([P(b, -0.95, -0.95), P(b, 0, -1.02), P(b, 0.95, -0.95), P(b, 0.96, -0.76), P(b, 0, -0.82), P(b, -0.96, -0.76)], 6));
      break;
    case "cap":
      out.pieces.push(closedSpline([P(b, -1.12, -0.48), P(b, -1.05, -1), P(b, 0, -1.33), P(b, 1.05, -1), P(b, 1.12, -0.48), P(b, 0, -0.56)], 8));
      out.trim.push(closedSpline([P(b, -0.95, -0.52), P(b, 0, -0.62), P(b, 0.95, -0.52), P(b, 0.7, -0.3), P(b, 0, -0.24), P(b, -0.7, -0.3)], 6));
      break;
    case "crown": {
      const pts = [];
      for (let i = 0;i <= 8; i++)
        pts.push(P(b, -0.8 + i / 8 * 1.6, i % 2 ? -1.55 : -1.15));
      out.pieces.push([...pts, P(b, 0.82, -0.85), P(b, -0.82, -0.85)]);
      for (const u of [-0.6, 0, 0.6])
        out.trim.push(circ(P(b, u, -1), 2.4, 10));
      break;
    }
    case "tiara":
      out.pieces.push(closedSpline([P(b, -0.85, -0.85), P(b, -0.4, -1.12), P(b, 0, -1.38), P(b, 0.4, -1.12), P(b, 0.85, -0.85), P(b, 0, -1.05)], 6));
      out.trim.push(closedSpline([P(b, 0, -1.32), P(b, 0.12, -1.18), P(b, 0, -1.06), P(b, -0.12, -1.18)], 3));
      break;
    case "headband": {
      out.pieces.push(closedSpline([P(b, -1.08, -0.55), P(b, -0.75, -1.08), P(b, 0, -1.28), P(b, 0.75, -1.08), P(b, 1.08, -0.55), P(b, 0.7, -0.92), P(b, 0, -1.08), P(b, -0.7, -0.92)], 6));
      for (let i = 0;i < 7; i++) {
        const a = Math.PI + 0.35 + i / 6 * (Math.PI - 0.7);
        out.trim.push(circ(P(b, Math.cos(a) * 1.02, Math.sin(a) * 1.2 - 0.02), 3.4, 10));
      }
      break;
    }
    case "hood":
      out.back.push(closedSpline([P(b, -1.42, 0.6), P(b, -1.45, -0.5), P(b, -0.8, -1.38), P(b, 0, -1.48), P(b, 0.8, -1.38), P(b, 1.45, -0.5), P(b, 1.42, 0.6), { x: b.cx, y: b.neckBot + 10 }], 8));
      out.pieces.push(closedSpline([P(b, -1.3, 0.5), P(b, -1.38, -0.5), P(b, -0.75, -1.35), P(b, 0, -1.45), P(b, 0.75, -1.35), P(b, 1.38, -0.5), P(b, 1.3, 0.5), P(b, 1, 0.45), P(b, 1.05, -0.4), P(b, 0.6, -1.05), P(b, 0, -1.15), P(b, -0.6, -1.05), P(b, -1.05, -0.4), P(b, -1, 0.45)], 6));
      out.hairUnder = true;
      break;
  }
}
function tears(pieces, amount, rand) {
  if (amount <= 0 || !pieces.length)
    return [];
  const n = Math.round(amount * 7);
  const out = [];
  const big = pieces.reduce((a, p) => area(p) > area(a) ? p : a, pieces[0]);
  const xs = big.map((p) => p.x), ys = big.map((p) => p.y);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  for (let i = 0;i < n * 4 && out.length < n; i++) {
    const c = { x: lerp(x0, x1, rand()), y: lerp(y0 + (y1 - y0) * 0.25, y1, rand()) };
    if (!inside(big, c))
      continue;
    const r = 3 + rand() * 5 * (0.6 + amount);
    const k = 7;
    out.push(Array.from({ length: k }, (_, j) => {
      const a = j / k * Math.PI * 2;
      const rr = r * (j % 2 ? 0.45 : 1) * (0.7 + rand() * 0.6);
      return { x: c.x + Math.cos(a) * rr, y: c.y + Math.sin(a) * rr * 1.3 };
    }));
  }
  return out;
}
function area(p) {
  let a = 0;
  for (let i = 0;i < p.length; i++) {
    const q = p[(i + 1) % p.length];
    a += p[i].x * q.y - q.x * p[i].y;
  }
  return Math.abs(a / 2);
}
function inside(p, c) {
  let x = false;
  for (let i = 0, j = p.length - 1;i < p.length; j = i++)
    if (p[i].y > c.y !== p[j].y > c.y && c.x < (p[j].x - p[i].x) * (c.y - p[i].y) / (p[j].y - p[i].y) + p[i].x)
      x = !x;
  return x;
}

// src/doll/outfits.ts
var OUTFITS = {
  adventurer: {
    label: "Adventurer",
    f: [
      { kind: "top", colour: "#e9dfc8", neckline: "collar", sleeves: "long", sleeveFit: "loose", hem: "hip", label: "Linen shirt" },
      { kind: "outer", style: "vest", colour: "#7a4a2a", material: "leather", hem: "hip", label: "Leather vest" },
      { kind: "bottom", colour: "#4a4a3a", length: "ankle", label: "Trousers" },
      { kind: "belt", colour: "#3a2418", colour2: "#c9a54a", label: "Belt" },
      { kind: "shoes", style: "boots", colour: "#4a2e1e", length: "knee", material: "leather", label: "Riding boots" }
    ]
  },
  kimono: {
    label: "Kimono",
    f: [
      { kind: "robe", colour: "#8e2f4f", pattern: "floral", patternColour: "#f4c6d2", label: "Kimono" },
      { kind: "sash", colour: "#e9c46a", colour2: "#c0392b", label: "Obi" },
      { kind: "shoes", style: "geta", colour: "#a07850", colour2: "#c0392b", label: "Geta" },
      { kind: "legwear", style: "socks", colour: "#f4f1ea", length: "ankle", label: "Tabi" }
    ],
    m: [
      { kind: "robe", colour: "#2c3e5a", pattern: "waves", patternColour: "#4f6b94", label: "Kimono" },
      { kind: "sash", colour: "#5a4a3a", colour2: "#d9c8a0", label: "Obi" },
      { kind: "shoes", style: "geta", colour: "#a07850", colour2: "#222", label: "Geta" }
    ]
  },
  street: {
    label: "Street",
    f: [
      { kind: "legwear", style: "stockings", colour: "#1d1720", pattern: "fishnet", length: "short", label: "Fishnets" },
      { kind: "top", colour: "#f4f1ea", pattern: "cow", neckline: "halter", hem: "crop", fit: "tight", label: "Cow-print halter" },
      { kind: "sleeves", colour: "#f4f1ea", pattern: "cow", sleeves: "long", sleeveFit: "loose", label: "Detached sleeves" },
      { kind: "bottom", style: "shorts", colour: "#3a3a40", length: "micro", rise: "low", label: "Shorts" },
      { kind: "legwear", style: "socks", colour: "#f29ac0", length: "calf", label: "Slouch socks" },
      { kind: "shoes", style: "boots", colour: "#2a2a30", length: "ankle", label: "Boots" },
      { kind: "gloves", style: "fingerless", colour: "#2a2a30", sleeves: "cap", label: "Fingerless gloves" },
      { kind: "neck", style: "choker", colour: "#222", colour2: "#6fd0e8", label: "Choker" },
      { kind: "hat", style: "newsboy", colour: "#2a2a30", label: "Newsboy cap" }
    ]
  },
  knight: {
    label: "Knight",
    f: [
      { kind: "top", colour: "#5a3a5a", neckline: "crew", sleeves: "long", hem: "thigh", label: "Gambeson" },
      { kind: "bottom", colour: "#3a3040", length: "ankle", label: "Hose" },
      { kind: "armor", colour: "#9aa3b2", material: "metal", neckline: "crew", sleeves: "none", label: "Breastplate" },
      { kind: "gloves", colour: "#9aa3b2", material: "metal", sleeves: "short", label: "Gauntlets" },
      { kind: "shoes", style: "boots", colour: "#9aa3b2", material: "metal", length: "knee", label: "Greaves" },
      { kind: "cape", colour: "#7a1f2a", length: "calf", label: "Cape" },
      { kind: "belt", colour: "#3a2418", label: "Sword belt" }
    ]
  },
  maid: {
    label: "Maid",
    f: [
      { kind: "dress", colour: "#22202a", neckline: "collar", sleeves: "short", sleeveFit: "puff", length: "knee", flare: 0.7, label: "Dress" },
      { kind: "apron", colour: "#f6f4f0", length: "knee", label: "Apron" },
      { kind: "legwear", style: "stockings", colour: "#f6f4f0", length: "short", label: "Stockings" },
      { kind: "shoes", style: "heels", colour: "#1a1a1e", label: "Shoes" },
      { kind: "hat", style: "headband", colour: "#f6f4f0", colour2: "#ffffff", label: "Headdress" }
    ],
    m: [
      { kind: "top", colour: "#f4f2ee", neckline: "collar", sleeves: "long", hem: "hip", label: "Shirt" },
      { kind: "outer", style: "vest", colour: "#22202a", open: false, hem: "waist", label: "Waistcoat" },
      { kind: "bottom", colour: "#22202a", length: "ankle", label: "Trousers" },
      { kind: "shoes", colour: "#1a1a1e", label: "Shoes" }
    ]
  },
  school: {
    label: "School",
    f: [
      { kind: "top", colour: "#f4f2ee", neckline: "collar", sleeves: "long", hem: "waist", label: "Blouse" },
      { kind: "outer", style: "jacket", colour: "#2b3a5c", hem: "hip", label: "Blazer" },
      { kind: "skirt", colour: "#3a4a6a", pattern: "plaid", patternColour: "#8a2a3a", length: "mid", flare: 0.5, label: "Pleated skirt" },
      { kind: "legwear", style: "socks", colour: "#22202a", length: "knee", label: "Knee socks" },
      { kind: "shoes", colour: "#3a2418", label: "Loafers" }
    ],
    m: [
      { kind: "top", colour: "#f4f2ee", neckline: "collar", sleeves: "long", hem: "hip", label: "Shirt" },
      { kind: "outer", style: "jacket", colour: "#2b3a5c", hem: "hip", label: "Blazer" },
      { kind: "bottom", colour: "#3a4a6a", length: "ankle", label: "Trousers" },
      { kind: "shoes", colour: "#3a2418", label: "Shoes" }
    ]
  },
  mage: {
    label: "Mage",
    f: [
      { kind: "robe", colour: "#2a2360", pattern: "stars", patternColour: "#e8c86a", neckline: "v", sleeveFit: "bell", length: "floor", flare: 0.35, label: "Robe" },
      { kind: "belt", colour: "#c9a54a", label: "Cord" },
      { kind: "hat", style: "witch", colour: "#2a2360", colour2: "#c9a54a", label: "Hat" },
      { kind: "neck", style: "necklace", colour: "#c9a54a", colour2: "#6fd0e8", label: "Amulet" }
    ]
  },
  casual: {
    label: "Casual",
    f: [
      { kind: "top", colour: "#e05a7e", neckline: "crew", sleeves: "short", hem: "hip", label: "T-shirt" },
      { kind: "bottom", colour: "#3d5a8a", length: "ankle", fit: "tight", label: "Jeans" },
      { kind: "outer", style: "hoodie", colour: "#6b6f7a", open: true, label: "Hoodie" },
      { kind: "shoes", style: "sneakers", colour: "#f0eef2", colour2: "#e05a7e", label: "Sneakers" }
    ]
  },
  ranger: {
    label: "Ranger (torn)",
    f: [
      { kind: "top", colour: "#5a6a3a", neckline: "v", sleeves: "elbow", hem: "thigh", damage: 0.6, label: "Tunic" },
      { kind: "bottom", colour: "#4a3a2a", length: "ankle", fit: "tight", damage: 0.4, label: "Leggings" },
      { kind: "cape", colour: "#3a4a2a", length: "knee", damage: 0.5, label: "Cloak" },
      { kind: "hat", style: "hood", colour: "#3a4a2a", label: "Hood" },
      { kind: "shoes", style: "boots", colour: "#4a2e1e", length: "calf", label: "Boots" },
      { kind: "gloves", colour: "#4a2e1e", material: "leather", sleeves: "cap", label: "Bracers" }
    ]
  },
  swim: {
    label: "Beach",
    f: [
      { kind: "bra", colour: "#2fa3b8", pattern: "dots", patternColour: "#f4f1ea", label: "Bikini top" },
      { kind: "briefs", colour: "#2fa3b8", pattern: "dots", patternColour: "#f4f1ea", label: "Bikini bottom" },
      { kind: "hat", style: "sunhat", colour: "#e9d6a0", colour2: "#e05a7e", label: "Sun hat" },
      { kind: "shoes", style: "sandals", colour: "#c9a070", colour2: "#e05a7e", label: "Sandals" }
    ],
    m: [
      { kind: "bottom", style: "shorts", colour: "#2fa3b8", pattern: "floral", patternColour: "#f4f1ea", length: "mid", fit: "loose", label: "Swim shorts" },
      { kind: "shoes", style: "sandals", colour: "#c9a070", colour2: "#333", label: "Sandals" }
    ]
  }
};
function outfitFor(key, sex) {
  const o = OUTFITS[key];
  if (!o)
    return [];
  return (sex === "m" ? o.m ?? o.f.filter((g) => !["bra", "dress", "skirt", "apron"].includes(g.kind)) : o.f).map((g) => ({ ...g }));
}
var pick = (v, list) => typeof v === "string" && list.includes(v.toLowerCase().trim()) ? v.toLowerCase().trim() : undefined;
var colour = (v, fallback) => {
  if (typeof v !== "string")
    return fallback;
  const s = v.trim();
  if (/^#[0-9a-f]{6}$/i.test(s))
    return s.toLowerCase();
  if (/^#[0-9a-f]{3}$/i.test(s))
    return "#" + s.slice(1).split("").map((c) => c + c).join("").toLowerCase();
  if (/^#[0-9a-f]{8}$/i.test(s))
    return s.slice(0, 7).toLowerCase();
  const w = s.toLowerCase().replace(/[-_]+/g, " ").replace(/\s+/g, " ");
  if (NAMED[w])
    return NAMED[w];
  const hit = w.split(" ").reverse().find((x) => NAMED[x]);
  return hit ? NAMED[hit] : fallback;
};
var num = (v, lo, hi) => typeof v === "number" && Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : undefined;
var NAMED = {
  black: "#1f1d24",
  white: "#f4f2ee",
  grey: "#7a7a84",
  gray: "#7a7a84",
  silver: "#b8bcc6",
  red: "#c0392b",
  crimson: "#9e1b32",
  pink: "#f29ac0",
  orange: "#e07b39",
  gold: "#d4a83a",
  yellow: "#e9c46a",
  cream: "#efe6cf",
  beige: "#d8c8a8",
  brown: "#6b4a32",
  tan: "#c49a6c",
  green: "#3f8a4f",
  olive: "#6b7a3a",
  teal: "#2a8a8a",
  cyan: "#4fc3d8",
  blue: "#3d6fd0",
  navy: "#24305a",
  purple: "#6a3d9a",
  violet: "#8a5ad0",
  lavender: "#b8a6e0",
  maroon: "#6a1f2a",
  burgundy: "#6e1f34",
  charcoal: "#33323a",
  ivory: "#f6f1e3",
  blonde: "#e8c26a",
  auburn: "#8e3b22",
  ginger: "#c45a2a",
  chestnut: "#6b3a24",
  platinum: "#e8e4dc",
  hazel: "#8e7652",
  amber: "#c9822b",
  bronze: "#9c6838",
  peach: "#f4c29f",
  copper: "#b86d3b",
  golden: "#d4a83a",
  ash: "#8a8886",
  indigo: "#3b4d8a",
  turquoise: "#38a3a5",
  coral: "#e76f51",
  rose: "#c94a6e",
  magenta: "#c03a8a",
  mint: "#9fd8b8",
  sky: "#8cc4ec",
  emerald: "#2e8b57",
  sapphire: "#2a52be",
  ruby: "#a8203a",
  jade: "#3a9a6a",
  khaki: "#b5a27a",
  "dark brown": "#4a3022",
  "light brown": "#a07850",
  "dark blue": "#24305a",
  "light blue": "#8cc4ec",
  "dark green": "#2f5a3a",
  "light green": "#9fd3a8",
  "dark red": "#7a1f2a",
  "light pink": "#f6c6d6",
  pale: "#fbe3d3",
  fair: "#f6d7c3",
  "olive skin": "#c9a37a",
  dark: "#6a4128",
  ebony: "#4a2e1e",
  snow: "#f8f8fb",
  raven: "#1f1a22",
  jet: "#141218"
};
function cleanGarment(raw) {
  if (!raw || typeof raw !== "object")
    return null;
  const r = raw;
  const kind = pick(r.kind, KINDS);
  if (!kind)
    return null;
  const g = { kind, colour: colour(r.colour ?? r.color, "#7a7a84") };
  const c2 = r.colour2 ?? r.color2;
  if (c2 !== undefined)
    g.colour2 = colour(c2, g.colour);
  const set = (k, v) => {
    if (v !== undefined)
      g[k] = v;
  };
  set("pattern", pick(r.pattern, PATTERNS));
  if (r.patternColour ?? r.patternColor)
    g.patternColour = colour(r.patternColour ?? r.patternColor, "#1d1a22");
  set("material", pick(r.material, MATERIALS));
  set("neckline", pick(r.neckline, NECKLINES));
  set("sleeves", pick(r.sleeves, SLEEVES));
  set("sleeveFit", pick(r.sleeveFit, SLEEVE_FITS));
  set("hem", pick(r.hem, HEMS));
  set("fit", pick(r.fit, FITS));
  set("length", pick(r.length, LENGTHS));
  set("rise", pick(r.rise, ["high", "mid", "low"]));
  set("flare", num(r.flare, 0, 1));
  set("damage", num(r.damage, 0, 1));
  if (typeof r.open === "boolean")
    g.open = r.open;
  const styles = STYLES[kind];
  if (styles)
    set("style", pick(r.style, styles));
  if (typeof r.label === "string" && r.label.trim())
    g.label = r.label.trim().slice(0, 40);
  return g;
}
var MAX_GARMENTS = 24;
var SKINS = ["#fbe3d3", "#f6d7c3", "#e8b896", "#d9a37e", "#c98e65", "#a8714c", "#8d5a3b", "#6a4128", "#c9d8e8", "#9fd3a8"];
var HAIR_COLOURS = ["#1f1a22", "#3b2a2a", "#6b3a24", "#8e3b22", "#c45a2a", "#e8c26a", "#e8e4dc", "#b8bcc6", "#e07aa8", "#6a8ad8", "#5ab88a", "#8a5ad0"];
function defaultLook(sex = "f") {
  return { body: { sex, preset: sex === "f" ? "athletic" : "athletic" }, skin: "#f0c8a8", hair: { style: sex === "f" ? "long" : "short", colour: "#3b2a2a", length: 0.6 }, eyes: "#6f4ad8", expression: "smile", outfit: outfitFor("adventurer", sex) };
}
function cleanLook(raw) {
  const r = Array.isArray(raw) ? { outfit: raw } : raw && typeof raw === "object" ? raw : {};
  const bodyR = r.body && typeof r.body === "object" ? r.body : {};
  const sexWord = String(bodyR.sex ?? r.sex ?? "").trim().toLowerCase();
  const sex = ["m", "male", "man", "boy", "masculine"].includes(sexWord) ? "m" : "f";
  const base = defaultLook(sex);
  const presets = Object.keys(PRESETS[sex]);
  const presetWord = (v) => typeof v === "string" ? v.split(/[:\s]+/).filter(Boolean).pop() : v;
  const body = { sex, preset: pick(presetWord(bodyR.preset), presets) ?? base.body.preset };
  const bl = bodyR.blend;
  if (bl && typeof bl === "object" && pick(presetWord(bl.preset), presets))
    body.blend = { preset: pick(presetWord(bl.preset), presets), amount: num(bl.amount, 0, 1) ?? 0.5 };
  const h = num(bodyR.height, 0.85, 1.15);
  if (h)
    body.height = h;
  const hairR = r.hair && typeof r.hair === "object" ? r.hair : {};
  const look = {
    body,
    skin: colour(r.skin, base.skin),
    hair: { style: pick(hairR.style, HAIR_STYLES) ?? base.hair.style, colour: colour(hairR.colour ?? hairR.color, base.hair.colour), length: num(hairR.length, 0, 1) ?? (sex === "m" ? 0.3 : 0.6) },
    eyes: colour(r.eyes, base.eyes),
    expression: pick(r.expression, EXPRESSIONS) ?? "neutral",
    ears: pick(r.ears, EARS) ?? null,
    tail: pick(r.tail, TAILS) ?? null,
    horns: pick(r.horns, HORNS) ?? null,
    outfit: Array.isArray(r.outfit) ? r.outfit.map(cleanGarment).filter((g) => !!g).slice(0, MAX_GARMENTS) : base.outfit
  };
  if (r.earColour ?? r.earColor)
    look.earColour = colour(r.earColour ?? r.earColor, look.hair.colour);
  if (r.tailColour ?? r.tailColor)
    look.tailColour = colour(r.tailColour ?? r.tailColor, look.hair.colour);
  if (r.modest === false)
    look.modest = false;
  return look;
}

// src/backend/questions.ts
var choice = (instructions, criteria) => ({ type: "choice", instructions, criteria });
var score = (instructions, criteria) => ({ type: "score", instructions, criteria });
var yes = (instructions) => ({ type: "noul", instructions });
var CLOTH = ["black", "charcoal", "grey", "silver", "white", "ivory", "cream", "beige", "tan", "khaki", "brown", "dark brown", "maroon", "burgundy", "crimson", "red", "coral", "pink", "rose", "magenta", "orange", "gold", "yellow", "olive", "green", "dark green", "emerald", "mint", "teal", "turquoise", "sky", "blue", "dark blue", "navy", "indigo", "violet", "purple", "lavender"];
var HAIR = { black: "black or jet", "dark brown": "dark brown", brown: "brown or chestnut", "light brown": "light brown", auburn: "auburn", ginger: "ginger, red or copper", blonde: "blonde or golden", platinum: "platinum or white", silver: "silver or grey", pink: "pink", blue: "blue", green: "green", purple: "purple or violet" };
var EYES = { brown: "brown or dark", hazel: "hazel", amber: "amber or gold", green: "green", emerald: "bright green", blue: "blue", sky: "pale blue or grey-blue", grey: "grey", violet: "violet or purple", red: "red or crimson", pink: "pink", gold: "golden or yellow" };
var SKIN = {
  pale: ["very pale, porcelain or snow-white", "#fbe3d3"],
  fair: ["fair or light", "#f6d7c3"],
  light: ["light with a warm tone", "#efc4a4"],
  olive: ["olive or lightly tanned", "#d9a37e"],
  tan: ["tanned or light brown", "#c98e65"],
  brown: ["brown", "#a8714c"],
  dark: ["dark brown", "#8d5a3b"],
  deep: ["very dark", "#6a4128"],
  blue: ["blue or blue-grey (not human)", "#c9d8e8"],
  green: ["green (not human)", "#9fd3a8"]
};
function slots() {
  const colourQ = (who, noun) => choice(`The main colour of ${who}'s ${noun}`, Object.fromEntries(CLOTH.map((c) => [c, c])));
  const patternQ = (who, noun) => choice(`The pattern on ${who}'s ${noun}`, { none: "plain, one colour", stripes: "horizontal stripes", vstripes: "vertical stripes or pinstripes", plaid: "plaid or tartan", check: "checked or gingham", dots: "polka dots", floral: "flowers or blossoms", waves: "waves or a Japanese wave pattern", stars: "stars or moons", cow: "cow print or black-and-white patches", leopard: "leopard or animal print", fishnet: "fishnet or mesh", scales: "scales, chainmail or overlapping plates" });
  const damageQ = (who, noun) => score(`How worn or damaged ${who}'s ${noun} is`, ["intact, clean", "worn, scuffed or stained", "torn or ripped in places", "in tatters, falling apart"]);
  const materialQ = (who, noun) => choice(`What ${who}'s ${noun} is made of`, { cloth: "ordinary cloth, cotton, linen, wool", leather: "leather or hide", metal: "metal, steel, iron or chainmail", sheer: "see-through, sheer, lace or mesh", knit: "knitted", silk: "silk, satin or other shiny cloth" });
  const base = (who, key, noun) => ({
    [`${key}.colour`]: colourQ(who, noun),
    [`${key}.pattern`]: patternQ(who, noun),
    [`${key}.damage`]: damageQ(who, noun),
    [`${key}.material`]: materialQ(who, noun)
  });
  const neckline = (who, noun) => choice(`The neckline of ${who}'s ${noun}`, { crew: "round, close to the neck (t-shirt)", scoop: "low round", v: "V-neck or plunging", wrap: "wrapped, crossing over (kimono, robe, wrap top)", collar: "shirt collar or lapels", turtle: "turtleneck or high collar", boat: "wide and shallow", strapless: "strapless or tube", offshoulder: "off the shoulders", halter: "halter, tied behind the neck" });
  const sleeves = (who, noun) => choice(`How long the sleeves of ${who}'s ${noun} are`, { none: "no sleeves", cap: "tiny cap sleeves", short: "short sleeves", elbow: "to the elbow", three: "three-quarter", long: "long, to the wrist" });
  const sleeveFit = (who, noun) => choice(`The shape of the sleeves of ${who}'s ${noun}`, { tight: "fitted", loose: "loose or baggy", wide: "very wide hanging sleeves (kimono)", puff: "puffed at the shoulder", bell: "flaring wide at the wrist" });
  const legLength = (who, noun) => choice(`How far down ${who}'s ${noun} reaches`, { micro: "barely below the hips", short: "upper thigh", mid: "mid thigh", knee: "the knee", calf: "mid calf", ankle: "the ankle", floor: "the floor" });
  const topReach = (who, noun) => choice(`Where the top of ${who}'s ${noun} sits`, { ankle: "at the ankle", calf: "mid calf", knee: "at the knee", short: "over the knee, on the thigh" });
  const fit = (who, noun) => choice(`How ${who}'s ${noun} fits`, { tight: "tight or form-fitting", regular: "ordinary fit", loose: "loose, baggy or oversized" });
  const S = (kind, noun, extra) => ({ kind, noun, ask: (who) => ({ ...base(who, kind, noun), ...extra(who) }) });
  return [
    S("top", "shirt or top", (w) => ({ "top.neckline": neckline(w, "top"), "top.sleeves": sleeves(w, "top"), "top.sleeveFit": sleeveFit(w, "top"), "top.fit": fit(w, "top"), "top.hem": choice(`Where ${w}'s top ends`, { crop: "cropped, showing the belly", waist: "at the waist", hip: "at the hips", knee: "a long tunic to the knee" }) })),
    S("outer", "jacket, coat or vest", (w) => ({ "outer.style": choice(`What kind of outer layer ${w} wears`, { jacket: "jacket or blazer", coat: "long coat, trench coat, duster or overcoat", vest: "vest or waistcoat (no sleeves)", hoodie: "hoodie or sweatshirt" }), "outer.open": yes(`${w}'s jacket or coat hangs open at the front`), "outer.neckline": neckline(w, "jacket or coat") })),
    S("dress", "dress", (w) => ({ "dress.neckline": neckline(w, "dress"), "dress.sleeves": sleeves(w, "dress"), "dress.sleeveFit": sleeveFit(w, "dress"), "dress.length": legLength(w, "dress"), "dress.flare": score(`How full ${w}'s dress skirt is`, ["straight or tight", "a little flared", "full and swishing", "very full, ball gown"]) })),
    S("robe", "robe or kimono", (w) => ({ "robe.neckline": neckline(w, "robe"), "robe.sleeveFit": sleeveFit(w, "robe"), "robe.length": legLength(w, "robe") })),
    S("armor", "armour", (w) => ({ "armor.sleeves": sleeves(w, "armour") })),
    S("bottom", "trousers or shorts", (w) => ({ "bottom.length": legLength(w, "trousers or shorts"), "bottom.fit": fit(w, "trousers or shorts") })),
    S("skirt", "skirt", (w) => ({ "skirt.length": legLength(w, "skirt"), "skirt.flare": score(`How full ${w}'s skirt is`, ["straight or pencil", "a little flared", "pleated or full", "very full"]) })),
    S("legwear", "socks, stockings or tights", (w) => ({ "legwear.style": choice(`What ${w} wears on the legs`, { socks: "socks", stockings: "stockings or thigh-highs", tights: "tights or pantyhose" }), "legwear.length": topReach(w, "socks or stockings") })),
    S("shoes", "shoes", (w) => ({ "shoes.style": choice(`What ${w} wears on the feet`, { shoes: "shoes, loafers or flats", boots: "boots", heels: "high heels", sandals: "sandals", geta: "geta or wooden clogs", sneakers: "sneakers or trainers" }), "shoes.length": topReach(w, "boots") })),
    S("gloves", "gloves", (w) => ({ "gloves.style": choice(`${w}'s gloves`, { full: "full gloves", fingerless: "fingerless gloves, bracers or arm warmers" }), "gloves.sleeves": choice(`How far up ${w}'s gloves go`, { cap: "just the hand and wrist", short: "the forearm", elbow: "to the elbow", long: "above the elbow" }) })),
    S("hat", "hat or headwear", (w) => ({ "hat.style": choice(`What ${w} wears on the head`, { newsboy: "flat or newsboy cap, beret", beanie: "beanie or knit cap", witch: "pointed witch or wizard hat", sunhat: "wide-brimmed hat, sun hat, cowboy or straw hat", cap: "baseball cap", crown: "crown", tiara: "tiara or circlet", headband: "headband or maid headdress", hood: "a hood, up" }) })),
    S("neck", "necklace, collar or scarf", (w) => ({ "neck.style": choice(`What ${w} wears around the neck`, { choker: "choker", necklace: "necklace or pendant", scarf: "scarf", collar: "collar with a bell or ring" }) })),
    S("belt", "belt", () => ({})),
    S("sash", "sash or obi", () => ({})),
    S("apron", "apron", () => ({})),
    S("cape", "cape or cloak", (w) => ({ "cape.length": legLength(w, "cape or cloak") })),
    S("sleeves", "detached sleeves", () => ({}))
  ];
}
var NOT = {
  top: " (a shirt, blouse, t-shirt or sweater; not a dress, robe, vest or jacket)",
  outer: " (not a cloak or cape)",
  cape: " (a cape or cloak, not a coat)",
  belt: " (a belt, not an obi or sash)"
};
function dollQuestions(who) {
  const q = {
    sex: choice(`Is ${who} female or male?`, { f: "female: a woman or girl", m: "male: a man or boy" }),
    build: choice(`${who}'s build`, { slim: "slim, slender, thin, petite or lithe", athletic: "athletic, fit, toned or sporty", big: "curvy or voluptuous (a woman); broad, burly or very muscular (a man)", heavy: "heavy, plump, chubby, stout or fat" }),
    height: score(`How tall ${who} is`, ["very short or tiny", "short or petite", "average height", "tall", "very tall"]),
    skin: choice(`${who}'s skin`, Object.fromEntries(Object.entries(SKIN).map(([k, [d]]) => [k, d]))),
    hairStyle: choice(`${who}'s hairstyle`, { long: "long and loose, straight", bob: "a bob, chin length", ponytail: "a ponytail", twintails: "twin tails or pigtails", short: "short and neat", spiky: "short and spiky", messy: "messy, tousled or shaggy", bun: "tied up in a bun", buzz: "shaved or buzzed" }),
    hairLength: score(`How long ${who}'s hair is`, ["shaved or very short", "short, above the ears", "chin or neck length", "to the shoulders", "past the shoulders", "to the waist or longer"]),
    hairColour: choice(`${who}'s hair colour`, HAIR),
    eyes: choice(`${who}'s eye colour`, EYES),
    expression: choice(`${who}'s usual expression or manner`, { neutral: "calm or neutral", smile: "cheerful, warm or smiling", serious: "serious, stern, cold or tired", surprised: "nervous, shy or startled", smug: "smug, teasing, sly or confident" }),
    ears: choice(`What kind of ears ${who} has`, { none: "ordinary human ears", cat: "cat ears", fox: "fox ears", wolf: "wolf or dog ears", bunny: "rabbit ears", elf: "long pointed elf ears" }),
    tail: choice(`What kind of tail ${who} has`, { none: "no tail", fox: "one fluffy fox tail", kitsune: "several fox tails (a kitsune)", cat: "a thin cat tail", wolf: "a wolf or dog tail", demon: "a thin demon tail with a spade tip" }),
    horns: choice(`What horns ${who} has`, { none: "no horns", small: "small horns", ram: "curled ram horns", oni: "one or two straight oni horns" }),
    furColour: choice(`The colour of ${who}'s animal ears and tail, if any`, { hair: "the same as their hair", orange: "orange or red, like a red fox", white: "white or snowy", black: "black", grey: "grey", brown: "brown", gold: "golden", silver: "silver" })
  };
  for (const s of slots()) {
    q[`${s.kind}.wears`] = yes(`${who} is wearing ${/^[aeiou]/.test(s.noun) ? "an" : "a"} ${s.noun}${NOT[s.kind] ?? ""}`);
    Object.assign(q, s.ask(who));
  }
  return q;
}
var pickOf = (a) => a?.type === "choice" ? a : null;
var scoreOf = (a) => a?.type === "score" ? a : null;
var yesOf = (a) => a?.type === "noul" ? a.noul : 0;
var SURE = 0.6;
function lookFromAnswers(a, who, force = new Set) {
  const guessed = [];
  const c = (id, label) => {
    const x = pickOf(a[id]);
    if (x && x.confidence < SURE)
      guessed.push(label);
    return x?.choice;
  };
  const sex = c("sex", "sex") === "m" ? "m" : "f";
  const buildPick = c("build", "build") ?? "athletic";
  const preset = buildPick === "big" ? sex === "f" ? "curvy" : "broad" : buildPick;
  const h = scoreOf(a.height);
  const hairL = scoreOf(a.hairLength);
  if (h && h.confidence < SURE)
    guessed.push("height");
  const hairStyle = c("hairStyle", "hairstyle") ?? "long";
  const skinKey = c("skin", "skin") ?? "fair";
  const look = {
    body: { sex, preset, ...h ? { height: 0.88 + h.score / 4 * 0.24 } : {} },
    skin: SKIN[skinKey]?.[1] ?? "#f0c8a8",
    hair: { style: hairStyle, colour: NAMED[c("hairColour", "hair colour") ?? "brown"] ?? NAMED.brown, length: hairL ? Math.min(1, hairL.score / 5) : 0.5 },
    eyes: NAMED[c("eyes", "eye colour") ?? "brown"] ?? "#6b4a32",
    expression: c("expression", "expression") ?? "neutral",
    ears: ((x) => x && x !== "none" ? x : null)(c("ears", "ears")),
    tail: ((x) => x && x !== "none" ? x : null)(c("tail", "tail")),
    horns: ((x) => x && x !== "none" ? x : null)(c("horns", "horns")),
    outfit: []
  };
  const fur = c("furColour", "ear and tail colour");
  const furHex = fur && fur !== "hair" ? NAMED[fur] ?? look.hair.colour : look.hair.colour;
  if (look.ears && look.ears !== "elf")
    look.earColour = furHex;
  if (look.tail)
    look.tailColour = furHex;
  const wears = (k) => yesOf(a[`${k}.wears`]);
  const on = new Set;
  for (const s of slots())
    if (wears(s.kind) >= 0.5 || force.has(s.kind))
      on.add(s.kind);
  const full = on.has("dress") || on.has("robe");
  if (full) {
    for (const k of ["top", "bottom", "skirt"])
      if (on.has(k) && wears(k) < 0.85 && !force.has(k))
        on.delete(k);
  }
  if (on.has("dress") && on.has("robe"))
    on.delete(wears("dress") >= wears("robe") ? "robe" : "dress");
  if (on.has("skirt") && on.has("bottom"))
    on.delete(wears("skirt") >= wears("bottom") ? "bottom" : "skirt");
  if (on.has("sash") && on.has("belt") && wears("belt") <= wears("sash"))
    on.delete("belt");
  if (on.has("armor") && on.has("outer") && wears("outer") < 0.85)
    on.delete("outer");
  const ORDER = ["legwear", "shoes", "bottom", "skirt", "top", "dress", "robe", "armor", "sash", "belt", "apron", "outer", "cape", "sleeves", "gloves", "neck", "hat"];
  for (const k of ORDER) {
    if (!on.has(k))
      continue;
    const slot = slots().find((s) => s.kind === k);
    if (wears(k) < 0.7)
      guessed.push(`whether ${who} wears ${/^[aeiou]/.test(slot.noun) ? "an" : "a"} ${slot.noun}`);
    const g = { kind: k, colour: NAMED[c(`${k}.colour`, `${slot.noun} colour`) ?? "grey"] ?? "#7a7a84", label: slot.noun.split(/,| or /)[0].trim() };
    const set = (field, id = `${k}.${String(field)}`) => {
      const x = pickOf(a[id]);
      if (x)
        g[field] = x.choice;
    };
    const pat = pickOf(a[`${k}.pattern`]);
    if (pat && pat.choice !== "none" && pat.confidence >= 0.5) {
      g.pattern = pat.choice;
      g.patternColour = pat.choice === "fishnet" ? "#1d1720" : g.colour === NAMED.black || g.colour === NAMED.charcoal ? "#e8e4dc" : "#1d1a22";
    }
    const mat = pickOf(a[`${k}.material`]);
    if (mat && mat.choice !== "cloth" && mat.confidence >= 0.5 && (k !== "shoes" || mat.choice === "metal"))
      g.material = mat.choice;
    const dmg = scoreOf(a[`${k}.damage`]);
    if (dmg && dmg.score >= 1)
      g.damage = Math.min(1, (dmg.score - 0.5) / 3);
    for (const f of ["neckline", "sleeves", "sleeveFit", "fit", "hem", "length", "style"])
      if (a[`${k}.${String(f)}`])
        set(f);
    for (const f of ["flare"]) {
      const s = scoreOf(a[`${k}.${f}`]);
      if (s)
        g.flare = s.score / 3;
    }
    if (k === "outer")
      g.open = yesOf(a["outer.open"]) >= 0.5;
    if (k === "shoes" && g.style !== "boots")
      delete g.length;
    if (k === "legwear" && g.style === "tights")
      delete g.length;
    if (k === "sash" || k === "belt")
      g.colour2 = "#c9a54a";
    look.outfit.push(g);
  }
  return { look, guessed };
}
var nameOf = (hex) => Object.entries(NAMED).find(([, h]) => h === hex)?.[0] ?? "coloured";
function describeLook(l) {
  const lines = [
    `${l.body.sex === "m" ? "Male" : "Female"}, ${l.body.preset} build.`,
    `Hair: ${l.hair.style}, ${nameOf(l.hair.colour)}. Eyes: ${nameOf(l.eyes)}.`,
    l.ears ? `Ears: ${l.ears}.` : "",
    l.tail ? `Tail: ${l.tail}.` : "",
    l.horns ? `Horns: ${l.horns}.` : "",
    l.outfit.length ? `Wearing: ${l.outfit.map((g) => [g.damage && g.damage > 0.4 ? "torn" : "", nameOf(g.colour), g.pattern && g.pattern !== "none" ? `${g.pattern}` : "", g.material && g.material !== "cloth" ? g.material : "", g.style ?? "", g.label ?? g.kind, g.kind === "outer" && g.open ? "(open)" : ""].filter(Boolean).join(" ")).join("; ")}.` : "Wearing: nothing."
  ];
  return lines.filter(Boolean).join(" ");
}
function dollChangeQuestions(who) {
  const q = {
    changed: yes(`In the latest story, ${who}'s clothes, hair or body visibly change (something put on, taken off, swapped, torn, or a transformation)`),
    "changed.hair": yes(`In the latest story, ${who}'s hairstyle changes (cut, let down, tied up, braided)`),
    "changed.hairColour": yes(`In the latest story, ${who}'s hair colour changes (dyed, bleached, magic)`),
    "changed.body": yes(`In the latest story, ${who} grows or loses animal ears, a tail or horns`)
  };
  for (const s of slots()) {
    q[`${s.kind}.off`] = yes(`In the latest story, ${who} takes off or loses their ${s.noun}`);
    q[`${s.kind}.on`] = yes(`In the latest story, ${who} puts on a ${s.noun}${NOT[s.kind] ?? ""}`);
    q[`${s.kind}.torn`] = yes(`In the latest story, ${who}'s ${s.noun} gets torn, cut or damaged`);
  }
  return q;
}
function applyChanges(current, a) {
  if (yesOf(a.changed) < 0.5)
    return null;
  const look = JSON.parse(JSON.stringify(current));
  const changed = [];
  const needs = new Set;
  const fullBody = look.outfit.some((g) => g.kind === "robe" || g.kind === "dress") || yesOf(a["robe.on"]) >= 0.6 || yesOf(a["dress.on"]) >= 0.6;
  for (const s of slots()) {
    const i = look.outfit.findIndex((g) => g.kind === s.kind);
    const bar = fullBody && ["top", "bottom", "skirt"].includes(s.kind) ? 0.85 : 0.6;
    const off = yesOf(a[`${s.kind}.off`]) >= 0.6, on = yesOf(a[`${s.kind}.on`]) >= bar, torn = yesOf(a[`${s.kind}.torn`]) >= 0.6;
    if (off && i >= 0 && !on) {
      look.outfit.splice(i, 1);
      changed.push(`${s.noun} off`);
      continue;
    }
    if (on) {
      needs.add(s.kind);
      continue;
    }
    if (torn && i >= 0) {
      look.outfit[i].damage = Math.max(look.outfit[i].damage ?? 0, 0.55);
      changed.push(`${s.noun} torn`);
    }
  }
  const hair = yesOf(a["changed.hair"]) >= 0.6, hairColour = yesOf(a["changed.hairColour"]) >= 0.6, body = yesOf(a["changed.body"]) >= 0.6;
  if (!changed.length && !needs.size && !hair && !hairColour && !body)
    return null;
  return { look, changed, needs, hair, hairColour, body };
}
var dollDetailQuestions = dollQuestions;
function finishChanges(ch, a, who) {
  const fresh = lookFromAnswers(a, who, ch.needs).look;
  const look = ch.look, changed = [...ch.changed];
  if (ch.hair) {
    look.hair = { ...look.hair, style: fresh.hair.style, length: fresh.hair.length };
    changed.push("hair");
  }
  if (ch.hairColour) {
    look.hair = { ...look.hair, colour: fresh.hair.colour };
    changed.push("hair colour");
  }
  if (ch.body) {
    look.ears = fresh.ears;
    look.tail = fresh.tail;
    look.horns = fresh.horns;
    look.earColour = fresh.earColour;
    look.tailColour = fresh.tailColour;
    changed.push("ears, tail or horns");
  }
  for (const k of ch.needs) {
    const now = fresh.outfit.find((g) => g.kind === k);
    if (!now)
      continue;
    const i = look.outfit.findIndex((g) => g.kind === k);
    if (i >= 0)
      look.outfit[i] = now;
    else
      look.outfit.push(now);
    changed.push(`${slots().find((s) => s.kind === k).noun} on`);
  }
  return { look, changed };
}

// src/backend/host.ts
function host() {
  return spindle;
}
function send(msg, userId) {
  spindle.sendToFrontend(msg, userId);
}
function toast(level, message, userId) {
  try {
    spindle.toast[level](message, { title: "LumiDoll", ...userId ? { userId } : {} });
  } catch {}
}
function logError(where, err) {
  const msg = err instanceof Error ? err.message : String(err);
  try {
    spindle.log.error(`[doll] ${where}: ${msg}`);
  } catch {}
}

// src/backend/helper.ts
var helperCalls = { n: 0 };
async function ask(system, user, settings, userId, timeoutMs, opts = {}) {
  helperCalls.n++;
  const res = await host().generate.quiet({
    type: "quiet",
    messages: [{ role: "system", content: system }, { role: "user", content: user }],
    connection_id: settings.helperConnectionId || undefined,
    reasoning: { source: "off" },
    parameters: { temperature: opts.temperature ?? 0.1 },
    userId,
    signal: AbortSignal.timeout(Math.max(3000, timeoutMs))
  });
  return typeof res === "string" ? res : res?.content ?? "";
}

// src/shared/classifier-config.ts
var JEV_URL = "https://api.typesafe.ai/v1/systemone";
var JEV_MODEL = "jev-latest";
var OPENROUTER_JEV = { jevModel: "typesafe/jev-1.13", jevUrl: "https://openrouter.ai/api/alpha/decisions" };
function classifierIssue(model, url) {
  let path = "";
  try {
    path = new URL(url).pathname.replace(/\/+$/, "");
  } catch {
    return "The classifier endpoint isn't a valid URL.";
  }
  if (/\/chat\/completions$/.test(path))
    return `This URL is a chat endpoint. Jev needs the typed-question API: ${JEV_URL}, or ${OPENROUTER_JEV.jevUrl} with model ${OPENROUTER_JEV.jevModel} for Jev on OpenRouter.`;
  if (!model.trim())
    return "Name the classifier model (jev-latest for TypeSafe).";
  return null;
}

// src/backend/jev.ts
var JEV_KEY = "jev_api_key";

class JevError extends Error {
}
function abortable(call, signal) {
  return new Promise((resolve, reject) => {
    const abort = () => reject(signal.reason ?? new JevError("Jev was canceled"));
    signal.addEventListener("abort", abort, { once: true });
    if (signal.aborted)
      abort();
    call.then(resolve, reject).finally(() => signal.removeEventListener("abort", abort));
  });
}
async function post(url, headers, body, signal) {
  signal.throwIfAborted();
  const call = (async () => {
    try {
      const r = await host().cors(url, { method: "POST", headers, body, signal });
      signal.throwIfAborted();
      return { status: r.status, body: r.body };
    } catch (e) {
      signal.throwIfAborted();
      if (typeof fetch !== "function")
        throw e;
      const r = await fetch(url, { method: "POST", headers, body, signal });
      return { status: r.status, body: await r.text() };
    }
  })();
  return abortable(call, signal);
}
async function postJson(url, key, body, timeoutMs, supplied) {
  const headers = { "Content-Type": "application/json", ...key ? { Authorization: `Bearer ${key}` } : {} };
  const who = url === JEV_URL ? "Jev" : "The classifier";
  const controller = new AbortController;
  const onAbort = () => controller.abort(supplied?.reason);
  supplied?.addEventListener("abort", onAbort, { once: true });
  if (supplied?.aborted)
    onAbort();
  const timer = setTimeout(() => controller.abort(new JevError(`${who} timed out`)), Math.max(1, timeoutMs));
  let delay = 400;
  try {
    for (let attempt = 0;; attempt++) {
      const res = await post(url, headers, body, controller.signal);
      if (res.status === 200)
        return res.body;
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

class JevClassifier {
  key;
  model;
  url;
  calls = 0;
  constructor(key, model, url = JEV_URL) {
    this.key = key;
    this.model = model;
    this.url = url;
  }
  async ask(state, questions, opts = {}) {
    if (!Object.keys(questions).length)
      return {};
    const issue = classifierIssue(this.model, this.url);
    if (issue)
      throw new JevError(issue);
    this.calls++;
    const body = JSON.stringify({ model: this.model || "jev-latest", state, questions });
    const parsed = JSON.parse(await postJson(this.url || JEV_URL, this.key, body, opts.timeoutMs ?? 15000, opts.signal));
    return parsed.answers ?? {};
  }
}
async function keyOf(userId) {
  try {
    return await host().enclave.get(JEV_KEY, userId);
  } catch {
    return null;
  }
}
async function jevStatus(s, userId) {
  let keySet = false;
  try {
    keySet = await host().enclave.has(JEV_KEY, userId);
  } catch {}
  const ready = s.jev && !classifierIssue(s.jevModel, s.jevUrl) && (keySet || s.jevUrl !== JEV_URL);
  return { keySet, ready };
}
async function getJev(s, userId) {
  if (!s.jev || classifierIssue(s.jevModel, s.jevUrl))
    return null;
  const key = await keyOf(userId);
  if (!key && s.jevUrl === JEV_URL)
    return null;
  return new JevClassifier(key ?? "", s.jevModel, s.jevUrl);
}

// src/shared/protocol.ts
var DEFAULT_SETTINGS = {
  helperConnectionId: "",
  jev: false,
  jevModel: JEV_MODEL,
  jevUrl: JEV_URL,
  follow: "jev"
};

// src/backend/settings.ts
var cache = new Map;
var writes = new Map;
var key = (userId) => userId ?? "_";
function normalizeSettings(value) {
  const raw = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const str = (v, def) => typeof v === "string" ? v.trim().slice(0, 400) : def;
  const s = {
    helperConnectionId: str(raw.helperConnectionId, DEFAULT_SETTINGS.helperConnectionId),
    jev: raw.jev === true || raw.jev === "true",
    jevModel: str(raw.jevModel, DEFAULT_SETTINGS.jevModel) || DEFAULT_SETTINGS.jevModel,
    jevUrl: str(raw.jevUrl, DEFAULT_SETTINGS.jevUrl),
    follow: raw.follow === "always" || raw.follow === "off" ? raw.follow : "jev"
  };
  if (!/^https?:\/\/\S+$/i.test(s.jevUrl))
    s.jevUrl = DEFAULT_SETTINGS.jevUrl;
  return s;
}
async function getSettings(userId) {
  const hit = cache.get(key(userId));
  if (hit)
    return hit;
  let stored = {};
  try {
    stored = await host().userStorage.getJson("settings.json", { fallback: {}, userId });
  } catch {}
  const s = normalizeSettings(stored);
  cache.set(key(userId), s);
  return s;
}
async function patchSettings(patch, userId) {
  let result;
  const k = key(userId);
  const op = (writes.get(k) ?? Promise.resolve()).then(async () => {
    const next = normalizeSettings({ ...await getSettings(userId), ...patch });
    await host().userStorage.setJson("settings.json", next, { indent: 2, userId });
    cache.set(k, next);
    result = next;
  });
  const tail = op.catch(() => {});
  writes.set(k, tail);
  tail.then(() => {
    if (writes.get(k) === tail)
      writes.delete(k);
  });
  await op;
  return result;
}

// src/backend/source.ts
async function getMessages(chatId) {
  const msgs = await host().chat.getMessages(chatId);
  return [...msgs].sort((a, b) => a.index_in_chat - b.index_in_chat);
}
var chatCharacter = new Map;
async function characterForChat(chatId, userId) {
  let id = chatCharacter.get(chatId);
  if (id === undefined) {
    const chat = await host().chats.get(chatId, userId).catch(() => null);
    id = chat?.character_id || null;
    chatCharacter.set(chatId, id);
  }
  return id ? await host().characters.get(id, userId).catch(() => null) : null;
}
function forgetChat(chatId) {
  if (chatId)
    chatCharacter.delete(chatId);
  else
    chatCharacter.clear();
  profiles.clear();
}
var RULESET_BOOK = /^\s*warp[-_ ]?ruleset\b/i;
var RULESET_ENTRY = /^\s*(?:\[[^\]]*\]\s*)?warp[-_ ]?ruleset\b/i;
function looksLikeScenario(c) {
  const tags = (c.tags ?? []).map((t) => t.toLowerCase());
  if (tags.some((t) => /scenario|\brpg\b|narrator|simulator|multiple characters|multi-?char|multi-?character|\bgroup\b|text adventure|\bworld\b|setting|dungeon|sandbox/.test(t)))
    return true;
  const text = `${c.description ?? ""}
${c.personality ?? ""}
${c.scenario ?? ""}`.toLowerCase();
  const narrator = [
    /\b(?:the )?narrator\b/,
    /\bgame ?master\b/,
    /\bdungeon master\b/,
    /\bstoryteller\b/,
    /\{\{char\}\} (?:is|will be) (?:not a (?:single |specific )?character|the (?:narrator|world|setting|game))/,
    /\{\{char\}\} (?:will )?(?:play|voice|control)s? (?:all |every |each )?(?:of )?(?:the )?(?:other )?(?:characters|npcs|side characters|cast)/,
    /\bmultiple characters\b/,
    /\bvarious characters\b/,
    /\ball (?:the )?npcs\b/
  ];
  if (narrator.some((re) => re.test(text)))
    return true;
  const settingName = /\b(simulator|scenario|rpg|academy|world|kingdom|empire|city|town|village|school|university|dungeon|adventure|quest|game|isekai|apocalypse|station)\b/i;
  return settingName.test(c.name) && !(c.personality ?? "").trim();
}
var nameRe = (name) => {
  const n = name.trim();
  if (!n)
    return /(?!)/u;
  const safe = n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^\\p{L}])${safe}(?=[^\\p{L}]|$)`, "iu");
};
function aboutThem(text, re, budget) {
  if (!text)
    return "";
  const out = [];
  let n = 0;
  for (const para of text.split(/\n\s*\n|\n(?=[-*•]|\w+:)/)) {
    const p = para.trim();
    if (!p || !re.test(p))
      continue;
    const piece = p.length > 700 ? `${p.slice(0, 700)}…` : p;
    if (n + piece.length > budget)
      break;
    out.push(piece);
    n += piece.length;
  }
  return out.join(`
`);
}
async function listAllEntries(bookId, userId) {
  const out = [];
  for (let offset = 0;offset < 5000; offset += 200) {
    const page = await host().world_books.entries.list(bookId, { limit: 200, offset, userId });
    out.push(...page.data);
    if (out.length >= page.total || page.data.length === 0)
      break;
  }
  return out;
}
var profiles = new Map;
var PROFILE_TTL = 10 * 60000;
async function personProfile(chatId, name, userId) {
  const key = `${chatId}:${userId ?? "_"}:${name.toLowerCase()}`;
  const hit = profiles.get(key);
  if (hit && Date.now() - hit.at < PROFILE_TTL)
    return hit.p;
  const re = nameRe(name);
  const c = await characterForChat(chatId, userId).catch(() => null);
  const parts = [];
  let setting = "";
  if (c && !looksLikeScenario(c) && re.test(c.name)) {
    parts.push([`Name: ${c.name}`, c.description && `Description: ${c.description}`, c.personality && `Personality: ${c.personality}`, c.scenario && `Scenario: ${c.scenario}`].filter(Boolean).join(`
`).slice(0, 4000));
  } else if (c) {
    const fromCard = [c.description, c.personality, c.scenario].map((t) => aboutThem(t, re, 1200)).filter(Boolean).join(`
`);
    if (fromCard)
      parts.push(`From the card:
${fromCard}`);
    setting = [c.scenario, c.description].filter(Boolean).join(`
`).slice(0, 600);
    const lore = [];
    for (const bookId of c.world_book_ids ?? []) {
      if (lore.length >= 3)
        break;
      const book = await host().world_books.get(bookId, userId).catch(() => null);
      if (!book || RULESET_BOOK.test(book.name ?? ""))
        continue;
      const entries = await listAllEntries(bookId, userId).catch(() => []);
      for (const e of entries) {
        if (lore.length >= 3)
          break;
        if (RULESET_ENTRY.test(e.comment ?? ""))
          continue;
        if (re.test([...e.key ?? [], e.comment ?? ""].join(" ")))
          lore.push(e.content.length > 900 ? `${e.content.slice(0, 900)}…` : e.content);
      }
    }
    if (lore.length)
      parts.push(`From the lorebook:
${lore.join(`
---
`)}`);
  }
  try {
    const msgs = await getMessages(chatId);
    const seen = [];
    let n = 0;
    for (const m of [...msgs].reverse().slice(0, 40)) {
      if (m.is_user || !re.test(m.content))
        continue;
      const bit = aboutThem(m.content, re, 500);
      if (!bit || n + bit.length > 1400)
        continue;
      seen.unshift(bit);
      n += bit.length;
      if (seen.length >= 4)
        break;
    }
    if (seen.length)
      parts.push(`How the story has shown them:
${seen.join(`
`)}`);
  } catch {}
  const p = { text: parts.filter(Boolean).join(`

`).slice(0, 4500), setting };
  profiles.set(key, { at: Date.now(), p });
  return p;
}
async function cardPerson(chatId, userId) {
  const c = await characterForChat(chatId, userId).catch(() => null);
  return c && c.name?.trim() && !looksLikeScenario(c) ? c.name.trim().slice(0, 80) : null;
}
async function macro(text, chatId, userId) {
  if (!chatId)
    return "";
  try {
    const { text: t } = await host().macros.resolve(text, { chatId, userId, commit: false });
    return t && t !== text ? t.trim() : "";
  } catch {
    return "";
  }
}

// src/backend/dress.ts
var list = (xs) => xs.join(" | ");
var DOLL_SYSTEM = `You dress a paper doll for a roleplay game. You never draw; you pick from fixed lists, and the game draws it.

Reply with JSON only:
{"look": {...}, "invented": ["short notes on what you made up because the sources didn't say"]}

look fields:
- body: {"sex": "f" | "m", "preset": one word — for "f" one of ${list(Object.keys(PRESETS.f))}; for "m" one of ${list(Object.keys(PRESETS.m))}, "blend": {"preset": another preset of the same sex, "amount": 0..1} (optional, for in-between builds), "height": 0.85..1.15 (1 = average)}
- skin, eyes: hex colours ("#e8b896"). Colour words also work: ${Object.keys(NAMED).slice(0, 20).join(", ")}…
- hair: {"style": ${list(HAIR_STYLES)}, "colour": hex, "length": a number 0..1 (0 short, 1 waist-long)}
- expression: ${list(EXPRESSIONS)}
- ears (only for non-human ears): ${list(EARS)} or null; earColour
- tail: ${list(TAILS)} or null; tailColour. kitsune = several fox tails.
- horns: ${list(HORNS)} or null
- outfit: a list of garments, innermost first. Each garment:
  List garments innermost first: something listed later (armour over a robe, a belt over a coat) is drawn over earlier ones.
  {"kind": ${list(KINDS)}, "label": "what it is, 1-3 words", "colour": hex, "colour2": trim hex (optional),
   "pattern": ${list(PATTERNS)}, "patternColour": hex, "material": ${list(MATERIALS)},
   "neckline": ${list(NECKLINES)}, "sleeves": ${list(SLEEVES)}, "sleeveFit": ${list(SLEEVE_FITS)},
   "hem": ${list(HEMS)} (tops), "length": one word, ${list(LENGTHS)} — for trousers, skirts, dresses and robes how far DOWN they reach; for socks, stockings and boots where their TOP sits ("knee" socks, "ankle" boots, "short" = thigh-high), "fit": ${list(FITS)},
   "rise": high | mid | low, "flare": 0..1 (skirts, coat tails), "open": true|false (jackets), "damage": 0..1 (torn or worn),
   "style": ${Object.entries(STYLES).map(([k, v]) => `${k}: ${list(v)}`).join("; ")}}

How to build things that aren't on the lists — compose them:
- kimono / yukata: robe (wrap neckline, wide sleeves, a pattern) + sash (obi) + shoes geta
- hanfu, bathrobe, wizard robe: robe with sleeveFit bell or wide; a priest's cassock: robe with collar neckline
- plate armour: armor (material metal) + gloves metal + shoes boots metal; chainmail: top with pattern scales, material metal
- a dress shirt: top, collar neckline; a hoodie: outer style hoodie; a trench coat: outer style coat, length knee
- leggings / jeans: bottom, fit tight; a kilt: skirt with plaid; overalls: bottom + apron in the same colour
- detached sleeves: sleeves; arm warmers: gloves style fingerless, sleeves elbow
Never add a garment the sources don't support unless you need it to clothe them plausibly for the setting; note those in "invented".
Keep what the sources say exactly (colours, cuts, animal features). Fill gaps to fit the setting and the person.
"look" is one object with the fields above (not a list of garments). Write nothing before or after the JSON.`;
function lookFrom(text) {
  const cleaned = text.replace(/```(?:json)?/gi, "");
  for (let start = cleaned.indexOf("{");start >= 0; start = cleaned.indexOf("{", start + 1)) {
    let depth = 0, inStr = false, end = -1;
    for (let i = start;i < cleaned.length; i++) {
      const c = cleaned[i];
      if (inStr) {
        if (c === "\\")
          i++;
        else if (c === '"')
          inStr = false;
        continue;
      }
      if (c === '"')
        inStr = true;
      else if (c === "{")
        depth++;
      else if (c === "}" && --depth === 0) {
        end = i;
        break;
      }
    }
    if (end < 0)
      return null;
    let o;
    try {
      o = JSON.parse(cleaned.slice(start, end + 1));
    } catch {
      continue;
    }
    if (!o || typeof o !== "object" || Array.isArray(o))
      continue;
    const r = o;
    const invented = Array.isArray(r.invented) ? r.invented.filter((x) => typeof x === "string").slice(0, 8) : [];
    if (r.look && typeof r.look === "object")
      return { look: r.look, invented };
    if ("outfit" in r || "body" in r || "hair" in r)
      return { look: r, invented };
    start = end;
  }
  return null;
}
function warpLines(w) {
  if (!w)
    return [];
  return [w.appearance ? `Appearance: ${w.appearance}` : "", w.outfit ? `Wearing: ${w.outfit}` : ""].filter(Boolean);
}
function mergeWarp(current, fresh, changed, guessed = []) {
  const look = JSON.parse(JSON.stringify(current));
  const g = (label) => guessed.includes(label);
  const done = [];
  if (changed.includes("outfit")) {
    look.outfit = fresh.outfit.map((x) => ({ ...x }));
    done.push("outfit");
  }
  if (changed.includes("appearance")) {
    if (!g("sex") && fresh.body.sex !== look.body.sex)
      look.body = { ...fresh.body };
    else {
      if (!g("build") && fresh.body.preset !== look.body.preset) {
        look.body.preset = fresh.body.preset;
        delete look.body.blend;
      }
      if (!g("height") && fresh.body.height)
        look.body.height = fresh.body.height;
    }
    if (!g("skin"))
      look.skin = fresh.skin;
    if (!g("hairstyle"))
      look.hair = { ...look.hair, style: fresh.hair.style, length: fresh.hair.length };
    if (!g("hair colour"))
      look.hair = { ...look.hair, colour: fresh.hair.colour };
    if (!g("eye colour"))
      look.eyes = fresh.eyes;
    if (!g("ears"))
      look.ears = fresh.ears ?? null;
    if (!g("tail"))
      look.tail = fresh.tail ?? null;
    if (!g("horns"))
      look.horns = fresh.horns ?? null;
    if (!g("ear and tail colour")) {
      if (fresh.earColour)
        look.earColour = fresh.earColour;
      else
        delete look.earColour;
      if (fresh.tailColour)
        look.tailColour = fresh.tailColour;
      else
        delete look.tailColour;
    }
    done.push("appearance");
  }
  return { look: cleanLook(look), changed: done };
}
async function answerLook(m, userId, deps = {}) {
  const who = String(m.who ?? "").replace(/\s+/g, " ").trim().slice(0, 80);
  const base = { type: "doll_look", who: m.who, chatId: m.chatId, ...m.auto ? { auto: true } : {} };
  let name = who;
  try {
    const settings = deps.settings ?? await getSettings(userId);
    const parts = [];
    const context = {};
    if (m.source === "text") {
      const text = String(m.text ?? "").trim().slice(0, 3000);
      if (text) {
        parts.push(`Describe this look:
${text}`);
        context.description = text;
      }
    } else if (who === "you") {
      name = (await macro("{{user}}", m.chatId, userId) || "the player").slice(0, 80);
      parts.push(`Who: ${name}, the player character.`);
      if (m.source === "profile") {
        const persona = await macro("{{persona}}", m.chatId, userId);
        if (persona) {
          parts.push(`Their persona:
${persona.slice(0, 3000)}`);
          context.description = persona.slice(0, 3000);
        }
      }
    } else {
      parts.push(who && who !== "them" ? `Who: ${who}.` : "Who: the other person in the scene.");
      if (m.source === "profile" && m.chatId && who && who !== "them") {
        const p = await personProfile(m.chatId, who, userId);
        if (p.text) {
          parts.push(p.text);
          context.description = p.text;
        }
        if (p.setting) {
          parts.push(`The setting:
${p.setting}`);
          context.setting = p.setting;
        }
      }
    }
    const warp = warpLines(m.warp);
    if (warp.length && m.source !== "text") {
      parts.push(`What the game says about them now (this is true; keep all of it):
${warp.join(`
`)}`);
      if (m.warp?.appearance)
        context.appearance_now = m.warp.appearance;
      if (m.warp?.outfit)
        context.wearing_now = m.warp.outfit;
    }
    const current = m.current ? cleanLook(m.current) : null;
    if (m.source === "story" && m.chatId) {
      const msgs = await getMessages(m.chatId);
      const recent = msgs.slice(-6).map((x) => `${x.is_user ? "(player)" : "(story)"} ${x.content.slice(0, 1500)}`).join(`

`);
      parts.push(`Their look right now:
${JSON.stringify(m.current ?? {}).slice(0, 4000)}`);
      parts.push(`The latest story:
${recent}`);
      context.latest_story = msgs.slice(-3).map((x) => x.content.slice(0, 2500)).join(`

`);
      parts.push("Return the whole look, changed only where the latest story changed it (clothes put on, taken off, torn, swapped; hair let down; a transformation). If nothing changed, return it as it was.");
    } else if (m.source === "warp" && current) {
      const what = (m.warp?.changed ?? []).join(" and ") || "look";
      parts.push(`Their look right now:
${JSON.stringify(current).slice(0, 4000)}`);
      parts.push(`Return the whole look. Change only their ${what} to match what the game says now; keep everything else exactly as it is.`);
    } else if (m.source !== "text" && current) {
      parts.push(`Their current look, for reference (replace it): ${JSON.stringify(current).slice(0, 2000)}`);
    }
    if (m.chatId && m.source === "profile" && !warp.length) {
      const msgs = await getMessages(m.chatId).catch(() => []);
      const tail = msgs.slice(-3).map((x) => x.content.slice(0, 800)).join(`

`);
      if (tail) {
        parts.push(`The story lately (for what they're wearing now):
${tail}`);
        context.story_lately = tail;
      }
    }
    const enough = m.source === "text" ? parts.length > 0 : m.source === "story" ? !!m.chatId : m.source === "warp" ? warp.length > 0 : parts.length > 1;
    if (!enough)
      return { ...base, look: null, note: "", error: m.source === "text" ? "Describe the look first." : "Nothing to go on yet: open a chat with them, or describe the look." };
    const label = who === "you" ? name : who && who !== "them" ? who : "the other person";
    const named = who !== "them" ? { name } : {};
    const jev = deps.jev !== undefined ? deps.jev : await getJev(settings, userId).catch(() => null);
    if (jev) {
      const done = await classify(jev, m, label, context, current).catch((e) => {
        logError("doll classifier", e);
        return null;
      });
      if (done)
        return { ...base, look: done.look, note: done.note, ...named };
    }
    const got = lookFrom(await ask(DOLL_SYSTEM, parts.join(`

`), settings, userId, 60000, { temperature: 0.6 }));
    if (!got)
      throw new Error("the helper didn't send a look");
    let look = cleanLook(got.look);
    let note = got.invented.length ? `Made up: ${got.invented.join("; ")}` : "";
    if (m.source === "warp" && current) {
      const merged = mergeWarp(current, look, m.warp?.changed ?? ["appearance", "outfit"]);
      look = merged.look;
      note = `Changed: ${merged.changed.join(" and ")} (from Warp).`;
    }
    return { ...base, look, note, ...named };
  } catch (e) {
    logError("doll look", e);
    return { ...base, look: null, note: "", error: String(e?.message ?? e).slice(0, 200) };
  }
}
async function dollLook(m, userId) {
  const out = await answerLook(m, userId);
  if (out.error && !m.auto && m.source !== "text")
    toast("warning", "The helper couldn't dress the doll this time. Try again, or describe the look.", userId);
  send(out, userId);
}
var nothing = "Nothing about their look changed in the latest replies.";
async function classify(d, m, who, context, current) {
  if (m.source === "story") {
    const now = current ?? cleanLook(m.current);
    const story = String(context.latest_story ?? "");
    if (!story)
      return null;
    const before = describeLook(now);
    const gate = await d.ask({ who, how_they_looked_before: before, latest_story: story }, dollChangeQuestions(who), { timeoutMs: 15000 });
    const ch = applyChanges(now, gate);
    if (!ch)
      return { look: now, note: nothing };
    const done = ch.needs.size || ch.hair || ch.hairColour || ch.body ? finishChanges(ch, await d.ask({ who, latest_story: story, how_they_looked_before: before }, dollDetailQuestions(who), { timeoutMs: 15000 }), who) : { look: ch.look, changed: ch.changed };
    return { look: done.look, note: done.changed.length ? `Changed: ${done.changed.join(", ")}.` : nothing };
  }
  if (m.source === "warp" && current) {
    const facts = { who, ...context.appearance_now ? { appearance: context.appearance_now } : {}, ...context.wearing_now ? { wearing: context.wearing_now } : {} };
    const answers = await d.ask(facts, dollQuestions(who), { timeoutMs: 15000 });
    if (!Object.keys(answers).length)
      return null;
    const { look: fresh, guessed } = lookFromAnswers(answers, who);
    const merged = mergeWarp(current, fresh, m.warp?.changed ?? ["appearance", "outfit"], guessed);
    return { look: merged.look, note: `Changed: ${merged.changed.join(" and ")} (from Warp).` };
  }
  if (!context.description && !context.story_lately && !context.wearing_now && !context.appearance_now)
    return null;
  const answers = await d.ask({ who, ...context }, dollQuestions(who), { timeoutMs: 15000 });
  if (!Object.keys(answers).length)
    return null;
  const { look, guessed } = lookFromAnswers(answers, who);
  return { look, note: guessed.length ? `Guessed: ${guessed.join("; ")}.` : "" };
}

// src/shared/names.ts
var castKey = (name) => name.replace(/\s+/g, " ").trim().toLowerCase();
var BAD = new Set(["__proto__", "constructor", "prototype"]);
var okName = (name) => !!castKey(name) && !BAD.has(castKey(name));
var reEsc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
function mentionScore(text, name) {
  const forms = [...new Set([name, name.split(/\s+/)[0]].filter((f) => f.length >= 2))];
  let n = 0, last = -1;
  for (const f of forms) {
    for (const m of text.matchAll(new RegExp(`(?<![\\p{L}\\p{N}])${reEsc(f)}(?![\\p{L}\\p{N}])`, "gu"))) {
      n++;
      last = Math.max(last, m.index ?? 0);
    }
  }
  return n ? n * 1e5 + last : 0;
}
function focusFrom(text, people) {
  let best = "", score = 0;
  for (const name of people) {
    const s = mentionScore(text, name);
    if (s > score) {
      best = name;
      score = s;
    }
  }
  return best;
}
function uniqueNames(names, max = 16) {
  const seen = new Set;
  const out = [];
  for (const raw of names) {
    const n = String(raw ?? "").replace(/\s+/g, " ").trim().slice(0, 80);
    if (!okName(n) || seen.has(castKey(n)))
      continue;
    seen.add(castKey(n));
    out.push(n);
    if (out.length >= max)
      break;
  }
  return out;
}

// src/backend/follow.ts
function focusQuestions(user, people) {
  const criteria = {};
  people.forEach((p, i) => {
    criteria[`p${i}`] = p;
  });
  criteria.none = "none of these people";
  return { about: { type: "choice", instructions: `Besides ${user}, who the latest reply is mostly about: who is there with ${user}, acting or speaking`, criteria } };
}
async function askFocus(jev, user, text, people) {
  const a = (await jev.ask({ player: user, latest_reply: text.slice(-4000) }, focusQuestions(user, people), { timeoutMs: 1e4 })).about;
  if (a?.type !== "choice" || a.confidence < 0.4)
    return null;
  if (a.choice === "none")
    return "";
  const i = Number(a.choice.slice(1));
  return people[i] ?? null;
}
async function follow(m, userId, deps = {}) {
  let youDone = false;
  try {
    youDone = await run(m, userId, deps);
  } finally {
    if (m.you && !youDone)
      send({ type: "doll_look", who: "you", chatId: m.chatId, look: null, note: "", auto: true }, userId);
  }
}
async function run(m, userId, deps) {
  const settings = deps.settings ?? await getSettings(userId);
  if (settings.follow === "off")
    return false;
  const jev = deps.jev !== undefined ? deps.jev : await getJev(settings, userId).catch(() => null);
  if (!jev && settings.follow !== "always")
    return false;
  const opts = { settings, jev };
  const people = uniqueNames(Array.isArray(m.people) ? m.people : []);
  const looks = new Map;
  for (const c of Array.isArray(m.cast) ? m.cast : [])
    if (c && typeof c.name === "string" && c.look)
      looks.set(castKey(c.name), c.look);
  let text = "";
  try {
    const msgs = await getMessages(m.chatId);
    text = (msgs.find((x) => x.id === m.messageId) ?? [...msgs].reverse().find((x) => !x.is_user))?.content ?? "";
  } catch (e) {
    logError("follow: messages", e);
  }
  const pinned = people.find((p) => castKey(p) === castKey(m.pin ?? ""));
  const focusP = (async () => {
    if (pinned)
      return pinned;
    if (!people.length)
      return null;
    if (jev && text) {
      const user = await macro("{{user}}", m.chatId, userId) || "the player";
      const got = await askFocus(jev, user, text, people).catch((e) => {
        logError("follow: focus", e);
        return null;
      });
      if (got !== null)
        return got || null;
    }
    return focusFrom(text, people) || null;
  })();
  const youP = m.you ? answerLook({ type: "doll_look", chatId: m.chatId, who: "you", source: "story", current: cleanLook(m.you), auto: true }, userId, opts) : null;
  const focus = await focusP;
  const look = focus ? looks.get(castKey(focus)) : undefined;
  const asked = new Set((Array.isArray(m.asked) ? m.asked : []).filter((x) => typeof x === "string").map(castKey));
  const dress = !!focus && (!!look || !asked.has(castKey(focus)));
  send({ type: "doll_focus", chatId: m.chatId, messageId: m.messageId, name: focus, ...dress && !look ? { dressing: true } : {} }, userId);
  const themP = focus && dress ? answerLook(look ? { type: "doll_look", chatId: m.chatId, who: focus, source: "story", current: cleanLook(look), auto: true } : { type: "doll_look", chatId: m.chatId, who: focus, source: "profile", auto: true }, userId, opts) : null;
  const [you, them] = await Promise.all([youP, themP]);
  if (you)
    send(you, userId);
  if (them)
    send(them, userId);
  return !!you;
}

// src/backend.ts
async function sendSettings(userId) {
  const settings = await getSettings(userId);
  const { keySet, ready } = await jevStatus(settings, userId);
  let connections = [];
  try {
    connections = (await spindle.connections.list(userId)).map((c) => ({ id: c.id, name: c.name }));
  } catch {}
  send({ type: "settings", settings, jevKeySet: keySet, jevReady: ready, connections }, userId);
}
async function sendChat(chatId, userId) {
  if (!chatId) {
    send({ type: "chat", chatId: null, character: null, user: "" }, userId);
    return;
  }
  const [character, user] = await Promise.all([cardPerson(chatId, userId).catch(() => null), macro("{{user}}", chatId, userId)]);
  send({ type: "chat", chatId, character, user }, userId);
}
spindle.on("CHAT_SWITCHED", (p, userId) => {
  sendChat(p.chatId ?? null, userId).catch((e) => logError("chat", e));
});
spindle.on("CHARACTER_EDITED", () => forgetChat());
spindle.on("GENERATION_ENDED", (p, userId) => {
  if (p.error || !p.messageId || !p.chatId || p.generationType === "impersonate")
    return;
  send({ type: "reply", chatId: p.chatId, messageId: p.messageId, text: String(p.content ?? "").slice(-6000) }, userId);
});
spindle.onFrontendMessage(async (raw, userId) => {
  const msg = raw;
  try {
    switch (msg.type) {
      case "hello":
        await sendSettings(userId);
        await sendChat(msg.chatId ?? null, userId);
        break;
      case "doll_look":
        await dollLook(msg, userId);
        break;
      case "doll_follow":
        await follow(msg, userId);
        break;
      case "settings":
        await patchSettings(msg.patch, userId);
        await sendSettings(userId);
        break;
      case "set_jev_key": {
        const key = String(msg.key ?? "").trim();
        if (key)
          await spindle.enclave.put(JEV_KEY, key, userId);
        else
          await spindle.enclave.delete(JEV_KEY, userId);
        await sendSettings(userId);
        toast(key ? "success" : "info", key ? "Jev key saved (encrypted)." : "Jev key removed.", userId);
        break;
      }
      case "test_jev": {
        const jev = await getJev(await getSettings(userId), userId);
        if (!jev) {
          toast("warning", "Jev isn't set up: turn it on and add a key (or an endpoint that needs none).", userId);
          break;
        }
        const t0 = Date.now();
        const a = (await jev.ask({ latest_reply: "Mara pulls a red wool coat over her dress and steps out into the rain." }, { coat: { type: "noul", instructions: "Mara puts on a coat" } })).coat;
        const ms = Date.now() - t0;
        if (a?.type === "noul")
          toast("success", `Jev answered in ${ms} ms (${Math.round(a.noul * 100)}% sure Mara put on a coat).`, userId);
        else
          toast("warning", `Jev replied in ${ms} ms but gave no usable answer.`, userId);
        break;
      }
    }
  } catch (e) {
    logError(`frontend ${msg.type}`, e);
    toast("error", `LumiDoll: ${e instanceof Error ? e.message : String(e)}`, userId);
  }
});
