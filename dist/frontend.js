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

// src/doll/patterns.ts
var HEX = /^#[0-9a-f]{6}$/i;
function patternDef(id, kind, colour, baseColour) {
  const c = HEX.test(colour) ? colour : "#1d1a22", base = HEX.test(baseColour) ? baseColour : "#7a7a84";
  const tile = (w, h, body, extra = "") => `<pattern id="${id}" width="${w}" height="${h}" patternUnits="userSpaceOnUse"${extra}>${body}</pattern>`;
  switch (kind) {
    case "stripes":
      return tile(10, 10, `<rect y="0" width="10" height="4" fill="${c}"/>`);
    case "vstripes":
      return tile(10, 10, `<rect x="0" width="4" height="10" fill="${c}"/>`);
    case "plaid":
      return tile(24, 24, `<rect x="0" y="9" width="24" height="6" fill="${c}" opacity=".55"/><rect x="9" y="0" width="6" height="24" fill="${c}" opacity=".55"/><rect x="0" y="2" width="24" height="1.2" fill="${mix(c, base, 0.4)}" opacity=".8"/><rect x="2" y="0" width="1.2" height="24" fill="${mix(c, base, 0.4)}" opacity=".8"/>`);
    case "check":
      return tile(12, 12, `<rect width="6" height="6" fill="${c}" opacity=".7"/><rect x="6" y="6" width="6" height="6" fill="${c}" opacity=".7"/>`);
    case "dots":
      return tile(12, 12, `<circle cx="3" cy="3" r="1.8" fill="${c}"/><circle cx="9" cy="9" r="1.8" fill="${c}"/>`);
    case "cow":
      return tile(46, 40, `<path d="M4 4c6-4 14 0 12 7s-10 9-14 4-3-8 2-11z" fill="${c}"/><path d="M28 18c5-3 13-2 14 4s-6 11-12 9-7-10-2-13z" fill="${c}"/><path d="M12 28c3-2 7 0 7 4s-4 6-7 4-3-6 0-8z" fill="${c}"/><path d="M36 2c3 0 5 2 4 5s-5 3-6 1 0-6 2-6z" fill="${c}"/>`);
    case "leopard":
      return tile(30, 28, `<path d="M5 5c3-2 7 0 6 3s-5 3-7 1z M18 14c3-2 7 0 6 3s-5 3-7 1z M6 20c3-2 6 0 5 3s-4 3-6 1z" fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round"/><circle cx="8" cy="7" r="1.4" fill="${mix(c, base, 0.5)}"/><circle cx="21" cy="16" r="1.4" fill="${mix(c, base, 0.5)}"/>`);
    case "floral":
      return tile(28, 28, [[7, 7], [21, 20]].map(([x, y]) => `<g transform="translate(${x} ${y})">${[0, 72, 144, 216, 288].map((a) => `<ellipse rx="2.4" ry="4" cy="-3.6" transform="rotate(${a})" fill="${c}"/>`).join("")}<circle r="1.8" fill="${mix(c, "#ffe08a", 0.6)}"/></g>`).join("") + `<circle cx="21" cy="5" r="1" fill="${c}" opacity=".6"/><circle cx="6" cy="22" r="1" fill="${c}" opacity=".6"/>`);
    case "waves":
      return tile(20, 10, `<path d="M0 10a10 10 0 0 1 20 0M4 10a6 6 0 0 1 12 0M-10 5a10 10 0 0 1 20 0M10 5a10 10 0 0 1 20 0" fill="none" stroke="${c}" stroke-width="1.1"/>`);
    case "stars":
      return tile(30, 30, `<path d="M8 3l1.6 3.4 3.7.4-2.8 2.5.8 3.7L8 11.2 4.7 13l.8-3.7L2.7 6.8l3.7-.4z" fill="${c}"/><circle cx="22" cy="20" r="1.3" fill="${c}"/><circle cx="25" cy="7" r=".8" fill="${c}"/>`);
    case "fishnet":
      return tile(7, 7, `<path d="M0 0L7 7M7 0L0 7" stroke="${c}" stroke-width=".9"/>`);
    case "scales":
      return tile(12, 10, `<path d="M0 10a6 6 0 0 1 12 0M-6 5a6 6 0 0 1 12 0M6 5a6 6 0 0 1 12 0" fill="none" stroke="${c}" stroke-width="1"/>`);
    default:
      return "";
  }
}

// src/doll/render.ts
var seq = 0;
var LW = 1.25;
function renderDoll(raw, opts = {}) {
  const look = cleanLook(raw);
  const uid = (opts.id ?? `wd${++seq}`).replace(/[^\w-]/g, "");
  const b = buildBody(look.body);
  const defs = [];
  const g = [];
  let n = 0;
  const id = (k) => `${uid}-${k}${++n}`;
  const paint = (shapes, fill, o = {}) => {
    const ds = shapes.map((s) => typeof s === "string" ? s : poly(s)).filter(Boolean);
    if (!ds.length)
      return;
    const lc = o.line ?? ink(fill);
    const lw = o.lw ?? LW;
    const paths = (attrs = "") => ds.map((d) => `<path d="${d}"${attrs}/>`).join("");
    const parts = [];
    if (!o.noOutline)
      parts.push(o.sheer ? `<g fill="none" stroke="${lc}" stroke-width="${f(lw)}" stroke-linejoin="round" opacity=".6">${paths()}</g>` : `<g fill="${lc}" stroke="${lc}" stroke-width="${f(lw * 2)}" stroke-linejoin="round">${paths()}</g>`);
    if (!o.sheer)
      parts.push(`<g fill="${fill}">${paths()}</g>`);
    else
      parts.push(`<g fill="${fill}" opacity="${o.pattern ? 0.08 : 0.45}">${paths()}</g>`);
    if (o.pattern)
      parts.push(`<g fill="url(#${o.pattern})">${paths()}</g>`);
    if ((o.shadeAmt ?? 0.22) > 0 && !o.sheer) {
      const m = id("sh");
      defs.push(`<mask id="${m}" maskUnits="userSpaceOnUse" x="-50" y="-50" width="340" height="640"><g fill="#fff">${paths()}</g><g fill="#000" transform="translate(-4.5 -3.5)">${paths()}</g></mask>`);
      parts.push(`<g fill="${shade(fill, o.shadeAmt ?? 0.22)}" mask="url(#${m})">${paths()}</g>`);
    }
    if (o.gloss) {
      const m = id("gl");
      defs.push(`<mask id="${m}" maskUnits="userSpaceOnUse" x="-50" y="-50" width="340" height="640"><g fill="#fff">${paths()}</g><g fill="#000" transform="translate(2.5 2)">${paths()}</g></mask>`);
      parts.push(`<g fill="${light(fill, 0.55)}" opacity=".7" mask="url(#${m})">${paths()}</g>`);
    }
    g.push(`<g${o.opacity !== undefined ? ` opacity="${o.opacity}"` : ""}${o.mask ? ` mask="url(#${o.mask})"` : ""}>${parts.join("")}</g>`);
  };
  const stroke = (d, c, w = 1, extra = "") => g.push(`<path d="${d}" fill="none" stroke="${c}" stroke-width="${f(w)}" stroke-linecap="round" stroke-linejoin="round"${extra}/>`);
  const skin = look.skin, skinLine = ink(skin);
  const hairC = look.hair.colour;
  const outfit = look.outfit;
  const covers = (k) => outfit.some((x) => k.includes(x.kind));
  const auto = [];
  if (look.modest !== false) {
    if (b.sex === "f" && !covers(["top", "dress", "robe", "bra", "armor"]) && !outfit.some((x) => x.kind === "outer" && x.open === false))
      auto.push({ kind: "bra", colour: "#e9e4ef" });
    if (!covers(["bottom", "dress", "robe", "briefs"]) && !outfit.some((x) => x.kind === "legwear" && x.style === "tights" && x.material !== "sheer"))
      auto.push({ kind: "briefs", colour: "#e9e4ef" });
  }
  const listed = [...auto, ...look.outfit];
  const coverers = new Set(["top", "dress", "robe", "armor", "outer"]);
  const handsCovered = listed.some((x) => x.kind === "robe" && (x.sleeveFit ?? "wide") === "wide" || x.sleeveFit === "wide" || x.sleeveFit === "bell");
  let topSoFar = 0;
  const order = new Map;
  for (const x of listed) {
    let o = x.kind === "shoes" && x.style === "boots" ? 33 : LAYER[x.kind];
    if (["armor", "belt", "sash", "apron"].includes(x.kind) && topSoFar >= o)
      o = topSoFar + 0.5;
    if (x.kind === "gloves" && handsCovered)
      o = 39;
    if (coverers.has(x.kind))
      topSoFar = Math.max(topSoFar, o);
    order.set(x, o);
  }
  const all = listed.map((x, i) => ({ x, i })).sort((a, c) => order.get(a.x) - order.get(c.x) || a.i - c.i).map((e) => e.x);
  const built = all.map((x, i) => ({ g: x, bt: build(b, x), i }));
  const hatHidesHair = built.some((x) => x.bt.hairUnder);
  if (look.tail) {
    const tc = look.tailColour ?? hairC;
    const t = tail(b, look.tail, tc);
    paint(t.main, tc, { shadeAmt: 0.25 });
    if (t.tip.length)
      paint(t.tip, t.tipColour, { shadeAmt: 0.15, line: ink(tc) });
  }
  for (const x of built)
    if (x.bt.back.length)
      paint(x.bt.back, shade(x.g.colour, 0.25), { shadeAmt: 0.15 });
  const hl = hair(b, look.hair.style, look.hair.length ?? 0.6);
  if (hl.back.length && !hatHidesHair)
    paint(hl.back, shade(hairC, 0.12), { shadeAmt: 0.25 });
  const sk = skinShapes(b);
  paint([...sk.trunk, neckPath(b)], skin, { line: skinLine, shadeAmt: 0.13 });
  for (const d of sk.lines)
    stroke(d, skinLine, LW);
  bodyMarks(b, skin, stroke);
  if (look.ears === "elf")
    for (const s of [1, -1])
      paint([earPath(b, s, true)], skin, { line: skinLine, shadeAmt: 0.1 });
  else if (!look.ears || look.ears === "cat" || look.ears === "fox" || look.ears === "wolf" || look.ears === "bunny") {
    if (!look.ears)
      for (const s of [1, -1])
        paint([earPath(b, s, false)], skin, { line: skinLine, shadeAmt: 0.1 });
  }
  paint([headPath(b)], skin, { line: skinLine, shadeAmt: 0.1 });
  g.push(face(b, look.eyes, look.expression ?? "neutral", skin, skinLine));
  let handsOver = false;
  for (const { g: x, bt } of built) {
    if (x.kind === "hat")
      continue;
    drawGarment(x, bt);
    handsOver ||= !!bt.handsOver;
  }
  if (handsOver && !built.some((x) => x.g.kind === "gloves")) {
    const hands = skinShapes(b).trunk.slice(-4).filter((_, i) => i % 2 === 0);
    paint(hands, skin, { line: skinLine, shadeAmt: 0.12 });
  }
  if (hl.front.length) {
    const clip = id("hc");
    defs.push(`<clipPath id="${clip}">${hl.front.map((d) => `<path d="${d}"/>`).join("")}</clipPath>`);
    paint(hl.front, hairC, { shadeAmt: 0.28 });
    const r = b.head;
    g.push(`<path d="M${f(r.c.x - r.rx * 0.85)} ${f(r.c.y - r.ry * 0.78)}Q${f(r.c.x)} ${f(r.c.y - r.ry * 1.12)} ${f(r.c.x + r.rx * 0.85)} ${f(r.c.y - r.ry * 0.78)}" stroke="${light(hairC, 0.4)}" stroke-width="3" fill="none" opacity=".35" clip-path="url(#${clip})"/>`);
    for (const e of hl.extra) {
      const m = /^tie:([\d.]+),([\d.]+)$/.exec(e);
      if (m)
        g.push(`<circle cx="${m[1]}" cy="${m[2]}" r="3.4" fill="${mix(hairC, "#e05a7e", 0.7)}" stroke="${ink(hairC)}" stroke-width="1"/>`);
    }
  }
  const hats = built.filter((x) => x.g.kind === "hat");
  const overEars = hats.filter((x) => ["sunhat", "witch", "hood"].includes(x.g.style ?? ""));
  for (const { g: x, bt } of hats)
    if (!overEars.some((o) => o.g === x))
      drawGarment(x, bt);
  if (look.ears && look.ears !== "elf" && overEars.length)
    drawEars();
  for (const { g: x, bt } of overEars)
    drawGarment(x, bt);
  if (look.ears && look.ears !== "elf" && !overEars.length)
    drawEars();
  if (look.horns)
    paint(horns(b, look.horns), look.horns === "oni" ? "#d8c9a3" : "#3b3140", { shadeAmt: 0.3, gloss: true });
  function drawEars() {
    if (!look.ears || look.ears === "elf")
      return;
    const ec = look.earColour ?? hairC;
    const e = animalEars(b, look.ears, ec);
    if (e) {
      paint(e.outer, ec, { shadeAmt: 0.2 });
      paint(e.innerD, e.inner, { shadeAmt: 0, noOutline: true });
      if (e.tipD.length)
        paint(e.tipD, shade(ec, 0.55), { shadeAmt: 0, noOutline: true });
    }
  }
  function drawGarment(x, bt) {
    const base = x.colour;
    let pat;
    if (x.pattern && x.pattern !== "none") {
      pat = id("pt");
      defs.push(patternDef(pat, x.pattern, x.patternColour ?? (x.pattern === "fishnet" ? "#1d1720" : "#1d1a22"), base));
    }
    let mask;
    const scuffs = x.kind === "shoes" || x.kind === "gloves" || x.kind === "hat" || x.kind === "armor" || x.material === "metal" || x.material === "leather";
    const holes = x.damage && x.damage > 0 ? tears(bt.pieces, x.damage, rng(`${x.kind}:${x.label ?? ""}:${base}`)) : [];
    if (holes.length && !scuffs) {
      mask = id("dm");
      defs.push(`<mask id="${mask}" maskUnits="userSpaceOnUse" x="-50" y="-50" width="340" height="640"><rect x="-50" y="-50" width="340" height="640" fill="#fff"/>${holes.map((h) => `<path d="${poly(h)}" fill="#000"/>`).join("")}</mask>`);
    }
    const metal = x.material === "metal";
    const sheer = x.material === "sheer" || x.pattern === "fishnet";
    let fill = base;
    if (metal) {
      const gr = id("mt");
      const xs = bt.pieces.flat().map((p) => p.x), ys = bt.pieces.flat().map((p) => p.y);
      defs.push(`<linearGradient id="${gr}" gradientUnits="userSpaceOnUse" x1="${f(Math.min(...xs))}" y1="${f(Math.min(...ys))}" x2="${f(Math.max(...xs))}" y2="${f(Math.max(...ys))}"><stop offset="0" stop-color="${light(base, 0.45)}"/><stop offset=".45" stop-color="${base}"/><stop offset=".55" stop-color="${shade(base, 0.25)}"/><stop offset="1" stop-color="${light(base, 0.15)}"/></linearGradient>`);
      fill = `url(#${gr})`;
    }
    const lc = ink(base);
    if (bt.pieces.length)
      paint(bt.pieces, fill, { line: lc, pattern: pat, mask, sheer, gloss: metal || x.material === "leather" || x.material === "silk", shadeAmt: metal ? 0 : x.material === "silk" ? 0.18 : 0.24 });
    const c2 = x.colour2 ?? (metal ? "#c9a54a" : x.kind === "shoes" || x.kind === "belt" ? light(base, 0.6) : shade(base, 0.35));
    if (bt.trim.length)
      paint(bt.trim, c2, { line: ink(c2), shadeAmt: 0.15 });
    if (holes.length && scuffs) {
      const clip = id("sc");
      defs.push(`<clipPath id="${clip}">${bt.pieces.map((p) => `<path d="${poly(p)}"/>`).join("")}</clipPath>`);
      g.push(`<g clip-path="url(#${clip})" fill="${light(base, 0.35)}" opacity=".55">${holes.map((h) => `<path d="${poly(h)}"/>`).join("")}</g>`);
    }
    for (const l of bt.lines) {
      const c = l.c === "trim" ? c2 : l.c === "shade" ? shade(base, 0.35) : l.c === "light" ? light(base, 0.5) : lc;
      stroke(l.d, c, l.w ?? 1, mask ? ` mask="url(#${mask})"` : "");
    }
  }
  const above = look.ears === "bunny" || built.some((x) => x.g.kind === "hat" && x.g.style === "witch") ? 3.05 : look.ears || look.horns || look.hair.style === "spiky" || look.hair.style === "bun" ? 1.9 : 1.35;
  const tall = Math.max(8, Math.ceil(-(b.head.c.y - b.head.ry * above) + 4));
  const wide = look.tail || look.hair.style === "twintails" ? 32 : 0;
  const vb = opts.crop === "bust" ? `${f(b.cx - 80)} ${f(b.head.c.y - b.head.ry * 2.1)} 160 ${f(b.waistY - (b.head.c.y - b.head.ry * 2.1) + 10)}` : `${-wide} ${-tall} ${240 + wide * 2} ${532 + tall}`;
  const px = (v) => typeof v === "number" && Number.isFinite(v) && v > 0 ? Math.round(v) : null;
  const w = px(opts.width) ? ` width="${px(opts.width)}"` : "", h = px(opts.height) ? ` height="${px(opts.height)}"` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}"${w}${h} class="doll-svg" role="img"><defs>${defs.join("")}</defs>${g.join("")}</svg>`;
}
function bodyMarks(b, skin, stroke) {
  const c = shade(skin, 0.3);
  const cx = b.cx;
  for (const s of [1, -1])
    stroke(`M${f(cx + s * 4)} ${f(b.neckBot + 6)}Q${f(cx + s * b.s.neck * 1.6)} ${f(b.neckBot + 3)} ${f(cx + s * b.s.shoulder * 0.62)} ${f(b.neckBot + 4)}`, c, 0.9, ' opacity=".7"');
  if (b.breast)
    for (const s of [1, -1]) {
      const x = cx + s * (b.breast.x - cx), y = b.breast.y, r = b.breast.r;
      stroke(`M${f(x - s * r * 0.75)} ${f(y + r * 0.55)}Q${f(x)} ${f(y + r * 1.12)} ${f(x + s * r * 0.85)} ${f(y + r * 0.35)}`, shade(skin, 0.38), 1);
    }
  if (b.sex === "m" && b.s.muscle > 0.25)
    for (const s of [1, -1])
      stroke(`M${f(cx + s * 2)} ${f(b.bustY + 8)}Q${f(cx + s * b.s.chest * 0.5)} ${f(b.bustY + 12)} ${f(cx + s * b.s.chest * 0.8)} ${f(b.bustY - 2)}`, c, 1, ` opacity="${Math.min(1, b.s.muscle)}"`);
  if (b.s.muscle > 0.5) {
    stroke(`M${f(cx)} ${f(b.underY + 2)}L${f(cx)} ${f(b.waistY - 2)}`, c, 0.8, ' opacity=".5"');
    for (let i = 0;i < 2; i++)
      for (const s of [1, -1])
        stroke(`M${f(cx + s * 3)} ${f(b.underY + 12 + i * 12)}l${f(s * 6)} -1`, c, 0.8, ' opacity=".45"');
  }
  stroke(`M${f(cx)} ${f(b.waistY + 6)}l0 3.5`, shade(skin, 0.4), 1.4);
  if (b.s.belly > 0.4)
    stroke(`M${f(cx - b.s.waist * 0.6)} ${f(b.hipY - 6)}Q${f(cx)} ${f(b.hipY + 2)} ${f(cx + b.s.waist * 0.6)} ${f(b.hipY - 6)}`, c, 1, ' opacity=".6"');
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

// src/shared/protocol.ts
var DEFAULT_SETTINGS = {
  helperConnectionId: "",
  jev: false,
  jevModel: JEV_MODEL,
  jevUrl: JEV_URL,
  follow: "jev"
};

// src/shared/warp-state.ts
var WARP_STATE = "warp-state-v1";
var WARP_STATE_REQUEST = "warp-state-request-v1";
var text = (v, max = 600) => typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "";
var opt = (v, max = 600) => {
  const t = text(v, max);
  return t ? t : undefined;
};
function cleanWarpState(detail) {
  if (!detail || typeof detail !== "object")
    return null;
  const d = detail;
  if (d.version !== 1 || d.provider !== "warp")
    return null;
  const you = d.you && typeof d.you === "object" ? d.you : {};
  const people = (Array.isArray(d.people) ? d.people : []).filter((p) => !!p && typeof p === "object").map((p) => ({ id: text(p.id, 80), name: text(p.name, 80), present: p.present === true, appearance: opt(p.appearance), outfit: opt(p.outfit) })).filter((p) => p.name).slice(0, 40);
  return {
    version: 1,
    provider: "warp",
    chatId: typeof d.chatId === "string" ? d.chatId : null,
    messageId: typeof d.messageId === "string" ? d.messageId : null,
    place: typeof d.place === "string" ? d.place : null,
    you: { name: text(you.name, 80), appearance: opt(you.appearance), outfit: opt(you.outfit) },
    people
  };
}
var warpDrives = (s) => !!s && (s.people.length > 0 || !!s.you.appearance || !!s.you.outfit);
var hereOf = (s) => s.people.filter((p) => p.present).map((p) => p.name);
function textOf(s, who) {
  const key = (n) => n.replace(/\s+/g, " ").trim().toLowerCase();
  const p = who === "you" ? s.you : s.people.find((x) => key(x.name) === key(who));
  return { appearance: p?.appearance ?? "", outfit: p?.outfit ?? "" };
}
function changedParts(seen, now) {
  const out = [];
  for (const k of ["appearance", "outfit"])
    if (now[k] && now[k] !== (seen?.[k] ?? ""))
      out.push(k);
  return out;
}

// src/frontend/scene.ts
var MAX_CAST = 16;
var MAX_CHATS = 40;
var str = (v, max = 80) => typeof v === "string" ? v.slice(0, max) : "";
function cleanPrefs(v) {
  const o = v && typeof v === "object" ? v : {};
  return { hud: o.hud !== false, scene: o.scene !== false };
}
function cleanSeen(v) {
  const out = {};
  if (!v || typeof v !== "object" || Array.isArray(v))
    return out;
  for (const [k, x] of Object.entries(v).slice(0, MAX_CAST + 1)) {
    if (!okName(k) || !x || typeof x !== "object")
      continue;
    const t = x;
    out[k] = { appearance: str(t.appearance, 600), outfit: str(t.outfit, 600) };
  }
  return out;
}
function cleanChat(v, seed) {
  const o = v && typeof v === "object" ? v : {};
  const notes = o.notes && typeof o.notes === "object" ? o.notes : {};
  const cast = {};
  const rawCast = o.cast && typeof o.cast === "object" && !Array.isArray(o.cast) ? o.cast : {};
  const entries = Object.values(rawCast).filter((e) => !!e && typeof e === "object" && typeof e.name === "string" && !!e.look).map((e) => ({ name: str(e.name).trim(), look: cleanLook(e.look), note: str(e.note, 400), at: Number.isFinite(e.at) ? Number(e.at) : 0 })).filter((e) => okName(e.name)).sort((a, b) => b.at - a.at).slice(0, MAX_CAST);
  for (const e of entries)
    cast[castKey(e.name)] = e;
  return {
    you: o.you ? cleanLook(o.you) : cleanLook(seed.you),
    them: o.them ? cleanLook(o.them) : cleanLook(seed.them),
    themName: str(o.themName),
    who: o.who === "them" ? "them" : "you",
    notes: { you: str(notes.you, 400), them: str(notes.them, 400) },
    cast,
    pin: str(o.pin),
    focus: str(o.focus),
    lastAuto: str(o.lastAuto, 200),
    asked: Array.isArray(o.asked) ? o.asked.filter((x) => typeof x === "string").slice(-MAX_CAST) : [],
    warpSeen: cleanSeen(o.warpSeen)
  };
}
function putCast(c, name, look, note, at) {
  if (!okName(name))
    return;
  c.cast[castKey(name)] = { name: name.replace(/\s+/g, " ").trim().slice(0, 80), look, note: note.slice(0, 400), at };
  const keys = Object.keys(c.cast).sort((a, b) => c.cast[b].at - c.cast[a].at);
  for (const old of keys.slice(MAX_CAST))
    delete c.cast[old];
}
function sceneFocus(here, pin, focus) {
  const find = (n) => n ? here.find((h) => castKey(h) === castKey(n)) : undefined;
  return find(pin) ?? find(focus) ?? here[0] ?? null;
}
function touchChat(list, chatId, max = MAX_CHATS) {
  const next = [chatId, ...list.filter((x) => x !== chatId)];
  return { list: next.slice(0, max), drop: next.slice(max) };
}

// src/frontend/settings-ui.ts
var esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
var toggle = (attr, label, hint, on) => `<label class="doll-toggle"><span>${esc(label)}</span><small>${esc(hint)}</small><input type="checkbox" ${attr}${on ? " checked" : ""}></label>`;
function followHint(v, withWarp) {
  const f = v.settings.follow;
  if (f === "off")
    return "The dolls change only when you press a button.";
  if (f === "jev" && !v.jevReady)
    return 'Off for now: set up Jev below to turn this on, or pick "Always".';
  if (withWarp)
    return v.jevReady ? "Warp is running this chat: when it says someone's outfit or looks changed, Jev re-dresses just that. Nothing else is read." : "Warp is running this chat: when it says someone's outfit or looks changed, the helper re-dresses just that (one call each time).";
  return v.jevReady ? "After each reply, Jev checks who it's about and what changed (about a quarter of a second). Someone new is dressed the first time they're with you." : "After each reply, the helper model checks each doll: one call per doll, every reply.";
}
function renderSettings(v, prefs, withWarp) {
  const s = v.settings;
  const issue = s.jev ? classifierIssue(s.jevModel, s.jevUrl) : null;
  const typesafe = s.jevUrl === JEV_URL;
  const host = (() => {
    try {
      return new URL(s.jevUrl).host;
    } catch {
      return s.jevUrl;
    }
  })();
  const follow = [["jev", "After each reply, with Jev"], ["always", "After each reply, always"], ["off", "Only when I ask"]].map(([k, l]) => `<option value="${k}"${s.follow === k ? " selected" : ""}>${l}</option>`).join("");
  return `<div class="doll-settings">
  <div class="doll-card">
    <h3>Status window</h3>
    ${toggle('data-doll-pref="hud"', "Show my doll", "Your doll in the floating window.", prefs.hud)}
    ${toggle('data-doll-pref="scene"', "Show who's with me", withWarp ? "The person Warp says is with you (the one the story is about, or the one you pin)." : "The person the latest reply is about (or the one you pin): the card's character, or anyone you've dressed in this chat.", prefs.scene)}
  </div>
  <div class="doll-card">
    <h3>Follow the story</h3>
    <select class="doll-input" data-setting="follow">${follow}</select>
    <p>${esc(followHint(v, withWarp))}</p>
  </div>
  <div class="doll-card">
    <h3>Helper model</h3>
    <p>Writes looks from your persona, a card, a description or the story${s.jev ? " when Jev can't" : ""}. A fast, cheap model works best.</p>
    <select class="doll-input" data-setting="helperConnectionId">
      <option value="">Same as the chat</option>
      ${v.connections.map((c) => `<option value="${esc(c.id)}"${c.id === s.helperConnectionId ? " selected" : ""}>${esc(c.name)}</option>`).join("")}
    </select>
  </div>
  <div class="doll-card">
    <h3>Jev (optional)</h3>
    <p>A classifier from TypeSafe: it answers the doll's questions (what someone wears, what changed, who a reply is about) faster and cheaper than a helper model. When it's on and set up, every one of those questions goes to Jev; the helper only writes what Jev can't.</p>
    ${toggle('data-setting="jev"', "Use Jev", "Needs a TypeSafe key, or Jev on OpenRouter with an OpenRouter key.", s.jev)}
    ${s.jev ? `
    <label class="doll-field">Endpoint
      <input class="doll-input" data-setting="jevUrl" value="${esc(s.jevUrl)}" placeholder="${esc(JEV_URL)}" spellcheck="false" autocomplete="off">
    </label>
    <label class="doll-field">Model
      <input class="doll-input" data-setting="jevModel" value="${esc(s.jevModel)}" placeholder="jev-latest" spellcheck="false" autocomplete="off">
    </label>
    <div class="doll-flex"><button class="doll-btn" data-jev-openrouter>Jev on OpenRouter</button><span class="doll-dim">Sets the endpoint and model for OpenRouter.</span></div>
    ${issue ? `<p class="doll-warn" role="alert">${esc(issue)}</p>` : ""}
    <div class="doll-flex">
      <input class="doll-input" type="password" data-jevkey placeholder="${v.jevKeySet ? "Key saved. Paste to replace" : typesafe ? "TypeSafe API key (sk-…)" : "API key"}" autocomplete="off">
      <button class="doll-btn" data-save-jev>${v.jevKeySet ? "Replace" : "Save"}</button>
      ${v.jevKeySet ? `<button class="doll-btn doll-btn-ghost" data-clear-jev>Remove</button>` : ""}
    </div>
    <p>${v.jevKeySet ? "✓ Key stored encrypted on the server." : "No key yet. Until you add one, the helper model does everything."} The doll's questions send story text to <b>${esc(host)}</b>.</p>
    <div class="doll-flex"><button class="doll-btn" data-test-jev>Test Jev</button><span class="doll-dim">${v.jevReady ? "Ready." : "Not ready yet."}</span></div>` : ""}
  </div>
</div>`;
}
function handleSettings(e, root, o) {
  const t = e.target;
  if (e.type === "click") {
    const b = t.closest?.("[data-jev-openrouter],[data-save-jev],[data-clear-jev],[data-test-jev]");
    if (!b)
      return false;
    e.preventDefault();
    if (b.hasAttribute("data-jev-openrouter"))
      o.send({ type: "settings", patch: { ...OPENROUTER_JEV } });
    else if (b.hasAttribute("data-save-jev")) {
      const input = root.querySelector("[data-jevkey]");
      const key = input?.value.trim() ?? "";
      if (key) {
        o.send({ type: "set_jev_key", key });
        if (input)
          input.value = "";
      }
    } else if (b.hasAttribute("data-clear-jev"))
      o.send({ type: "set_jev_key", key: "" });
    else
      o.send({ type: "test_jev" });
    return true;
  }
  if (e.type !== "change")
    return t.matches?.("[data-setting],[data-doll-pref],[data-jevkey]") ?? false;
  const pref = t.dataset?.dollPref;
  if (pref === "hud" || pref === "scene") {
    o.prefs({ [pref]: t.checked });
    return true;
  }
  const key = t.dataset?.setting;
  if (!key)
    return false;
  const el = t;
  const value = el.type === "checkbox" ? el.checked : el.value;
  o.send({ type: "settings", patch: { [key]: value } });
  return true;
}

// src/frontend/lab.ts
function renderDoll2(look, opts = {}) {
  try {
    return renderDoll(look, opts);
  } catch (e) {
    console.error("[doll]", e);
    return `<p class="doll-dim">This look couldn't be drawn. Change a garment, or pick a ready-made outfit.</p>`;
  }
}
var KEY = "doll:last";
var CHAT_KEY = (id) => `doll:chat:${id}`;
var CHATS_KEY = "doll:chats";
var OLD_KEY = "warp:doll";
var OLD_CHAT_KEY = (id) => `warp:doll:chat:${id}`;
var shownNote = (n) => !n || /^(Guessed|Made up):/i.test(n.trim()) ? "" : n;
var esc2 = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
var cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
var FIELDS = {
  top: ["neckline", "sleeves", "sleeveFit", "hem", "fit", "material"],
  dress: ["neckline", "sleeves", "sleeveFit", "length", "flare", "fit", "material"],
  robe: ["neckline", "sleeves", "sleeveFit", "length", "flare", "material"],
  outer: ["style", "neckline", "sleeves", "sleeveFit", "hem", "length", "open", "material"],
  cape: ["length"],
  armor: ["neckline", "sleeves", "hem", "material"],
  bottom: ["style", "length", "fit", "rise", "material"],
  skirt: ["length", "flare", "rise"],
  legwear: ["style", "length", "material"],
  shoes: ["style", "length", "material"],
  gloves: ["style", "sleeves", "material"],
  sleeves: ["sleeves", "sleeveFit"],
  hat: ["style"],
  neck: ["style"],
  belt: ["rise"],
  sash: [],
  apron: ["length"],
  bra: [],
  briefs: []
};
var OPTIONS = {
  neckline: NECKLINES,
  sleeves: SLEEVES,
  sleeveFit: SLEEVE_FITS,
  hem: HEMS,
  length: LENGTHS,
  fit: FITS,
  material: MATERIALS,
  rise: ["high", "mid", "low"]
};
var read = (k) => {
  try {
    return JSON.parse(localStorage.getItem(k) ?? "null");
  } catch {
    return null;
  }
};
var write = (k, v) => {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {}
};
function seed() {
  const v = read(KEY) ?? read(OLD_KEY);
  if (v && typeof v === "object" && v.you)
    return { you: cleanLook(v.you), them: cleanLook(v.them ?? { body: { sex: "f", preset: "curvy" } }) };
  const them = defaultLook("f");
  them.body.preset = "curvy";
  them.hair = { style: "twintails", colour: "#e8c26a", length: 0.7 };
  them.eyes = "#2f8f6f";
  them.ears = "cat";
  them.outfit = outfitFor("street", "f");
  return { you: defaultLook("f"), them };
}
function createDollLab(o) {
  const later = o.later ?? ((fn) => {
    setTimeout(fn, 1500);
  });
  const prefs = cleanPrefs(read(KEY) ?? read(OLD_KEY));
  let view = "dolls";
  let sv = { settings: { ...DEFAULT_SETTINGS }, jevKeySet: false, jevReady: false, connections: [] };
  let chat = { chatId: null, character: null, user: "" };
  const warps = new Map;
  let loadedFor = null;
  let st = cleanChat(null, seed());
  const busy = new Set;
  const busyKey = (who, c = loadedFor) => `${c ?? ""}|${who === "you" ? "you" : castKey(who)}`;
  let text = "";
  let jsonDraft = null;
  function ensure() {
    const id = o.chatId();
    if (id === loadedFor)
      return;
    loadedFor = id;
    st = cleanChat(id ? read(CHAT_KEY(id)) ?? read(OLD_CHAT_KEY(id)) : null, seed());
    jsonDraft = null;
  }
  function saveChat(id, c) {
    if (id) {
      write(CHAT_KEY(id), c);
      const { list, drop } = touchChat(Array.isArray(read(CHATS_KEY)) ? read(CHATS_KEY).filter((x) => typeof x === "string") : [], id);
      write(CHATS_KEY, list);
      for (const d of drop) {
        try {
          localStorage.removeItem(CHAT_KEY(d));
        } catch {}
      }
    }
    write(KEY, { ...prefs, you: c.you, them: c.them });
  }
  const save = () => {
    if (st.themName.trim())
      putCast(st, st.themName, st.them, st.notes.them, Date.now());
    saveChat(loadedFor, st);
  };
  const cur = () => st.who === "you" ? st.you : st.them;
  const autoOn = () => sv.settings.follow === "always" || sv.settings.follow === "jev" && sv.jevReady;
  const warp = () => {
    const w = loadedFor ? warps.get(loadedFor) : undefined;
    return w && warpDrives(w) ? w : null;
  };
  const warpText = (who) => {
    const w = warp();
    if (!w)
      return;
    const t = textOf(w, who);
    return t.appearance || t.outfit ? { ...t.appearance ? { appearance: t.appearance } : {}, ...t.outfit ? { outfit: t.outfit } : {} } : undefined;
  };
  function here() {
    const w = warp();
    if (w)
      return hereOf(w);
    const user = castKey(chat.chatId === loadedFor ? chat.user : "");
    const names = [chat.chatId === loadedFor ? chat.character ?? "" : "", ...Object.values(st.cast).sort((a, b) => b.at - a.at).map((c) => c.name)];
    return uniqueNames(names).filter((n) => castKey(n) !== user);
  }
  const sel = (path, value, opts, labels, none) => `<select class="doll-input" data-doll-set="${path}">${none !== undefined ? `<option value=""${value ? "" : " selected"}>${esc2(none)}</option>` : ""}${opts.map((x) => `<option value="${esc2(x)}"${x === value ? " selected" : ""}>${esc2(labels ? labels(x) : cap(x))}</option>`).join("")}</select>`;
  const colour = (path, value) => `<input type="color" class="doll-colour" data-doll-set="${path}" value="${esc2(value)}">`;
  const swatches = (path, list, value) => `<div class="doll-swatches">${list.map((c) => `<button class="doll-swatch${c === value ? " on" : ""}" style="background:${c}" data-doll-pick="${path}" data-value="${c}" title="${c}"></button>`).join("")}${colour(path, value)}</div>`;
  const range = (path, value, min, max, step) => `<input type="range" class="doll-range" data-doll-set="${path}" min="${min}" max="${max}" step="${step}" value="${value}">`;
  const row = (label, ctl) => `<label class="doll-row"><span>${esc2(label)}</span>${ctl}</label>`;
  function garmentRow(g, i) {
    const fields = FIELDS[g.kind].map((k) => {
      if (k === "style")
        return STYLES[g.kind] ? row("Style", sel(`outfit.${i}.style`, g.style ?? "", STYLES[g.kind], undefined, "default")) : "";
      if (k === "flare")
        return row("Flare", range(`outfit.${i}.flare`, g.flare ?? 0.4, 0, 1, 0.05));
      if (k === "open")
        return row("Open front", `<input type="checkbox" data-doll-set="outfit.${i}.open"${g.open ?? g.style !== "hoodie" ? " checked" : ""}>`);
      const opts = OPTIONS[k];
      return opts ? row(cap(k === "sleeveFit" ? "sleeve fit" : k), sel(`outfit.${i}.${k}`, String(g[k] ?? ""), opts, undefined, "default")) : "";
    }).join("");
    return `<details class="doll-garment" data-doll-g="${i}" data-section="doll-g-${i}">
      <summary>${colour(`outfit.${i}.colour`, g.colour)}<span class="doll-gname">${esc2(g.label ?? cap(g.kind))}</span><span class="doll-dim">${esc2(g.kind)}</span><button class="doll-btn doll-x" data-doll-del="${i}" title="Take it off">×</button></summary>
      <div class="doll-fields">
        ${row("Name", `<input class="doll-input" data-doll-set="outfit.${i}.label" value="${esc2(g.label ?? "")}" placeholder="${esc2(cap(g.kind))}">`)}
        ${row("Pattern", `<span class="doll-pair">${sel(`outfit.${i}.pattern`, g.pattern ?? "none", PATTERNS)}${colour(`outfit.${i}.patternColour`, g.patternColour ?? "#1d1a22")}</span>`)}
        ${row("Trim", colour(`outfit.${i}.colour2`, g.colour2 ?? "#c9a54a"))}
        ${fields}
        ${row("Wear and tear", range(`outfit.${i}.damage`, g.damage ?? 0, 0, 1, 0.05))}
      </div>
    </details>`;
  }
  function dollsHtml() {
    const L = cur();
    const sex = L.body.sex;
    const presets = Object.entries(PRESETS[sex]);
    const w = warp();
    const people = uniqueNames([...here(), ...w ? w.people.map((p) => p.name) : []]);
    const who = st.who;
    const target = who === "you" ? "you" : st.themName.trim() || "them";
    const isBusy = busy.has(busyKey(target));
    const fromWarp = target !== "them" && !!warpText(target);
    return `<div class="doll-lab">
      <div class="doll-who" role="tablist">
        <button class="doll-tab" data-doll-who="you" aria-selected="${who === "you"}">You</button>
        <button class="doll-tab" data-doll-who="them" data-doll-them-tab aria-selected="${who === "them"}">${esc2(st.themName.trim() || "Someone else")}</button>
      </div>
      <div class="doll-stage" data-doll-stage>${renderDoll2(L, { id: `lab${who}` })}</div>
      ${shownNote(st.notes[who]) ? `<p class="doll-dim doll-note">${esc2(shownNote(st.notes[who]))}</p>` : ""}
      <div class="doll-card doll-helper">
        <h3>Dress it</h3>
        ${who === "them" ? row("Who", `<input class="doll-input" list="doll-people" data-doll-name value="${esc2(st.themName)}" placeholder="A name from the story"><datalist id="doll-people">${people.map((p) => `<option value="${esc2(p)}">`).join("")}</datalist>`) : ""}
        <div class="doll-buttons">
          <button class="doll-btn doll-btn-primary" data-doll-ask="profile"${isBusy ? " disabled" : ""} title="${who === "you" ? "Reads your persona" : "Reads the card, the lorebook and how the story has shown them"}">${who === "you" ? "From my persona" : "From card & lorebook"}</button>
          <button class="doll-btn" data-doll-ask="story"${isBusy ? " disabled" : ""} title="Changes only what the latest replies changed">Update from story</button>
          ${fromWarp ? `<button class="doll-btn" data-doll-ask="warp"${isBusy ? " disabled" : ""} title="Dresses them as Warp describes them now">Match Warp</button>` : ""}
        </div>
        <textarea class="doll-input doll-text" data-doll-text rows="2" placeholder="Or describe it: a fox girl in a blue yukata with a torn sleeve…">${esc2(text)}</textarea>
        <button class="doll-btn" data-doll-ask="text"${isBusy ? " disabled" : ""}>Dress from description</button>
        ${isBusy ? `<p class="doll-dim">Asking ${sv.jevReady ? "Jev" : "the helper"}…</p>` : ""}
      </div>
      <details class="doll-section" data-section="doll-body" open><summary>Body</summary>
        ${row("Sex", sel("body.sex", sex, ["f", "m"], (x) => x === "f" ? "Female" : "Male"))}
        ${row("Build", `<div class="doll-chips">${presets.map(([k, p]) => `<button class="doll-btn${L.body.preset === k ? " doll-btn-primary" : ""}" data-doll-pick="body.preset" data-value="${k}">${esc2(p.label)}</button>`).join("")}</div>`)}
        ${row("Blend toward", sel("body.blend.preset", L.body.blend?.preset ?? "", presets.map(([k]) => k), (x) => PRESETS[sex][x].label, "nothing"))}
        ${L.body.blend ? row("Blend", range("body.blend.amount", L.body.blend.amount, 0, 1, 0.05)) : ""}
        ${row("Height", range("body.height", L.body.height ?? 1, 0.85, 1.15, 0.01))}
        ${row("Skin", swatches("skin", SKINS, L.skin))}
      </details>
      <details class="doll-section" data-section="doll-head"><summary>Hair &amp; face</summary>
        ${row("Hair", sel("hair.style", L.hair.style, HAIR_STYLES))}
        ${row("Length", range("hair.length", L.hair.length ?? 0.6, 0, 1, 0.05))}
        ${row("Colour", swatches("hair.colour", HAIR_COLOURS, L.hair.colour))}
        ${row("Eyes", colour("eyes", L.eyes))}
        ${row("Expression", sel("expression", L.expression ?? "neutral", EXPRESSIONS))}
      </details>
      <details class="doll-section" data-section="doll-extra"><summary>Ears, tail, horns</summary>
        ${row("Ears", `<span class="doll-pair">${sel("ears", L.ears ?? "", EARS, undefined, "human")}${colour("earColour", L.earColour ?? L.hair.colour)}</span>`)}
        ${row("Tail", `<span class="doll-pair">${sel("tail", L.tail ?? "", TAILS, undefined, "none")}${colour("tailColour", L.tailColour ?? L.hair.colour)}</span>`)}
        ${row("Horns", sel("horns", L.horns ?? "", HORNS, undefined, "none"))}
      </details>
      <details class="doll-section" data-section="doll-outfit" open><summary>Outfit · ${L.outfit.length}</summary>
        ${row("Ready-made", `<select class="doll-input" data-doll-outfit><option value="">Pick one…</option>${Object.entries(OUTFITS).map(([k, x]) => `<option value="${k}">${esc2(x.label)}</option>`).join("")}<option value="none">Nothing</option></select>`)}
        <div class="doll-garments">${L.outfit.map(garmentRow).join("")}</div>
        ${L.outfit.length >= MAX_GARMENTS ? `<p class="doll-dim">That's as many layers as the doll can wear.</p>` : row("Add", `<select class="doll-input" data-doll-add><option value="">A garment…</option>${KINDS.map((k) => `<option value="${k}">${cap(k)}</option>`).join("")}</select>`)}
        <label class="doll-row"><span>Underwear when bare</span><input type="checkbox" data-doll-set="modest"${L.modest === false ? "" : " checked"}></label>
      </details>
      <details class="doll-section" data-section="doll-json"><summary>As data</summary>
        <p class="doll-dim">The look the helper writes and the chat saves. Edit and apply, or paste one in.</p>
        <textarea class="doll-input doll-json" data-doll-json rows="8">${esc2(jsonDraft ?? JSON.stringify(L, null, 1))}</textarea>
        <button class="doll-btn" data-doll-json-apply>Apply</button>
      </details>
    </div>`;
  }
  function html() {
    ensure();
    const tabs = `<div class="doll-tabs" role="tablist"><button class="doll-tab" data-doll-view="dolls" aria-selected="${view === "dolls"}">Dolls</button><button class="doll-tab" data-doll-view="settings" aria-selected="${view === "settings"}">Settings</button></div>`;
    return tabs + (view === "settings" ? renderSettings(sv, prefs, !!warp()) : dollsHtml());
  }
  const BAD_KEYS = new Set(["__proto__", "constructor", "prototype"]);
  const NUMERIC = new Set(["amount", "height", "flare", "damage"]);
  function setPath(L, path, v) {
    const parts = path.split(".");
    if (parts.some((k) => BAD_KEYS.has(k)))
      return;
    if (path === "body.sex") {
      const sex = v === "m" ? "m" : "f";
      const from = Object.keys(PRESETS[L.body.sex]), to = Object.keys(PRESETS[sex]);
      const map = (p) => to[Math.max(0, from.indexOf(p))] ?? to[0];
      L.body = { sex, preset: map(L.body.preset), ...L.body.height ? { height: L.body.height } : {}, ...L.body.blend ? { blend: { preset: map(L.body.blend.preset), amount: L.body.blend.amount } } : {} };
      return;
    }
    if (path === "body.blend.preset") {
      L.body.blend = v ? { preset: String(v), amount: L.body.blend?.amount ?? 0.5 } : undefined;
      return;
    }
    if (path === "modest") {
      L.modest = v ? undefined : false;
      return;
    }
    const last = parts[parts.length - 1];
    let x = v;
    if (typeof v === "string") {
      if (v === "")
        x = undefined;
      else if (NUMERIC.has(last) || last === "length" && parts[0] === "hair") {
        const n = Number(v);
        x = Number.isFinite(n) ? n : undefined;
      }
    }
    let obj = L;
    for (let i = 0;i < parts.length - 1; i++) {
      const k = parts[i];
      const next = Array.isArray(obj) ? obj[Number(k)] : Object.prototype.hasOwnProperty.call(obj, k) ? obj[k] : undefined;
      if (!next || typeof next !== "object")
        return;
      obj = next;
    }
    if (x === undefined || last === "pattern" && x === "none")
      delete obj[last];
    else
      obj[last] = x;
    if (["ears", "tail", "horns"].includes(path) && x === undefined)
      L[path] = null;
  }
  function refresh(root, full) {
    st[st.who] = cleanLook(st[st.who]);
    save();
    if (full) {
      o.changed();
      return;
    }
    const stage = root.querySelector("[data-doll-stage]");
    if (stage)
      stage.innerHTML = renderDoll2(cur(), { id: `lab${st.who}` });
  }
  function ask(source) {
    const who = st.who;
    if (who === "them" && source === "profile" && !st.themName.trim()) {
      st.notes.them = "Type their name first.";
      o.changed();
      return;
    }
    const target = who === "you" ? "you" : st.themName.trim() || "them";
    if (source === "warp") {
      const t = warpText(target);
      if (!t)
        return;
      if (target !== "them")
        st.warpSeen[target === "you" ? "you" : castKey(target)] = { appearance: t.appearance ?? "", outfit: t.outfit ?? "" };
      request(target, "warp", cur(), false, { ...t, changed: ["appearance", "outfit"] });
    } else
      request(target, source, cur(), false);
    o.changed();
  }
  function request(who, source, current, auto, warpWords) {
    const k = busyKey(who);
    if (busy.has(k))
      return false;
    busy.add(k);
    const words = warpWords ?? (source === "profile" && who !== "them" ? warpText(who) : undefined);
    o.send({
      type: "doll_look",
      chatId: loadedFor,
      who,
      source,
      ...source === "text" ? { text } : {},
      ...source === "story" || source === "warp" ? { current } : {},
      ...words ? { warp: words } : {},
      ...auto ? { auto: true } : {}
    });
    return true;
  }
  function handle(e, root) {
    const t = e.target;
    ensure();
    if (t.closest?.(".doll-scene")) {
      if (e.type !== "click")
        return false;
      const b = t.closest("[data-doll-focus],[data-doll-edit],[data-doll-scene-ask]");
      if (!b)
        return false;
      if (b.dataset.dollFocus !== undefined) {
        e.preventDefault();
        const n = b.dataset.dollFocus;
        st.pin = castKey(st.pin) === castKey(n) ? "" : n;
        save();
        o.changed();
        return true;
      }
      if (b.dataset.dollSceneAsk) {
        e.preventDefault();
        const n = b.dataset.dollSceneAsk;
        if (!st.asked.includes(castKey(n)))
          st.asked.push(castKey(n));
        request(n, "profile", undefined, false);
        save();
        o.changed();
        return true;
      }
      const n = b.dataset.dollEdit ?? "";
      if (n) {
        if (st.themName.trim())
          putCast(st, st.themName, st.them, st.notes.them, Date.now());
        const c = st.cast[castKey(n)];
        st.who = n === "you" ? "you" : "them";
        view = "dolls";
        jsonDraft = null;
        if (n !== "you") {
          st.themName = n;
          if (c) {
            st.them = c.look;
            st.notes.them = c.note;
          }
        }
        save();
      }
      return false;
    }
    if (e.type === "click") {
      const v = t.closest?.("[data-doll-view]");
      if (v) {
        e.preventDefault();
        view = v.dataset.dollView === "settings" ? "settings" : "dolls";
        o.changed();
        return true;
      }
    }
    if (t.closest?.(".doll-settings")) {
      return handleSettings(e, root, {
        send: o.send,
        prefs: (p) => {
          Object.assign(prefs, p);
          saveChat(loadedFor, st);
          o.changed();
        }
      });
    }
    if (!t.closest?.(".doll-lab"))
      return false;
    const L = cur();
    if (e.type === "click") {
      const b = t.closest("[data-doll-who],[data-doll-pick],[data-doll-del],[data-doll-ask],[data-doll-json-apply]");
      if (!b)
        return false;
      e.preventDefault();
      if (b.dataset.dollWho) {
        if (b.dataset.dollWho === "you" || b.dataset.dollWho === "them") {
          st.who = b.dataset.dollWho;
          jsonDraft = null;
          refresh(root, true);
        }
      } else if (b.dataset.dollPick) {
        setPath(L, b.dataset.dollPick, b.dataset.value ?? "");
        refresh(root, true);
      } else if (b.dataset.dollDel) {
        const i = Number(b.dataset.dollDel);
        if (Number.isInteger(i) && i >= 0 && i < L.outfit.length) {
          L.outfit.splice(i, 1);
          refresh(root, true);
        }
      } else if (b.dataset.dollAsk) {
        const s = b.dataset.dollAsk;
        if (s === "profile" || s === "story" || s === "text" || s === "warp")
          ask(s);
      } else if (b.hasAttribute("data-doll-json-apply")) {
        const ta = root.querySelector("[data-doll-json]");
        try {
          st[st.who] = cleanLook(JSON.parse(ta?.value ?? ""));
          st.notes[st.who] = "";
          jsonDraft = null;
        } catch {
          jsonDraft = ta?.value ?? "";
          st.notes[st.who] = "That isn't valid JSON. Fix it and apply again.";
        }
        refresh(root, true);
      }
      return true;
    }
    if (t.matches("[data-doll-text]")) {
      text = t.value;
      return true;
    }
    if (t.matches("[data-doll-name]")) {
      const prev = st.themName;
      st.themName = t.value.slice(0, 80);
      const known = st.cast[castKey(st.themName)];
      if (e.type === "change" && known && castKey(prev) !== castKey(st.themName)) {
        st.them = known.look;
        st.notes.them = known.note;
        jsonDraft = null;
        refresh(root, true);
        return true;
      }
      if (e.type === "change")
        save();
      const tab = root.querySelector("[data-doll-them-tab]");
      if (tab)
        tab.textContent = st.themName.trim() || "Someone else";
      return true;
    }
    if (t.matches("[data-doll-json]")) {
      jsonDraft = t.value;
      return true;
    }
    if (t.matches("[data-doll-outfit]") && e.type === "change") {
      const k = t.value;
      if (k && (k === "none" || OUTFITS[k])) {
        L.outfit = k === "none" ? [] : outfitFor(k, L.body.sex);
        refresh(root, true);
      }
      return true;
    }
    if (t.matches("[data-doll-add]") && e.type === "change") {
      const k = t.value;
      if (KINDS.includes(k) && L.outfit.length < MAX_GARMENTS) {
        L.outfit.push({ kind: k, colour: "#5a6a8a" });
        refresh(root, true);
      }
      return true;
    }
    const path = t.dataset?.dollSet;
    if (path) {
      const v = t.type === "checkbox" ? t.checked : t.value;
      setPath(L, path, v);
      const live = t.type === "range" || t.type === "color";
      if (e.type === "input" && live)
        refresh(root, false);
      else if (e.type === "change")
        refresh(root, !live || path.startsWith("body.blend"));
      return true;
    }
    return false;
  }
  function apply(c, m) {
    const at = Date.now();
    const failed = m.error ? `${sv.jevReady ? "Jev and the helper" : "The helper"} couldn't do it: ${m.error}` : "";
    if (m.who === "you") {
      if (m.look) {
        const look = cleanLook(m.look);
        const changed = JSON.stringify(look) !== JSON.stringify(c.you);
        c.you = look;
        if (!m.auto || changed)
          c.notes.you = m.note;
      } else if (!m.auto)
        c.notes.you = failed;
      return;
    }
    if (m.who === "them") {
      if (m.look) {
        c.them = cleanLook(m.look);
        c.notes.them = m.note;
      } else
        c.notes.them = failed;
      return;
    }
    const k = castKey(m.who);
    const onTab = castKey(c.themName) === k || !c.themName.trim() && !m.auto;
    if (m.look) {
      const look = cleanLook(m.look);
      const before = c.cast[k];
      const changed = !before || JSON.stringify(look) !== JSON.stringify(before.look);
      const note = m.auto && !changed ? before?.note ?? "" : m.note;
      putCast(c, m.name && m.name !== "them" ? m.name : m.who, look, note, at);
      if (onTab) {
        c.them = look;
        c.notes.them = note;
        if (!c.themName.trim())
          c.themName = m.name ?? m.who;
      }
    } else if (onTab && !m.auto)
      c.notes.them = failed;
  }
  function onLook(m) {
    ensure();
    const c = m.chatId === undefined ? loadedFor : m.chatId;
    busy.delete(busyKey(m.who, c));
    if (c === loadedFor) {
      apply(st, m);
      saveChat(loadedFor, st);
    } else if (c) {
      const other = cleanChat(read(CHAT_KEY(c)) ?? read(OLD_CHAT_KEY(c)), seed());
      apply(other, m);
      write(CHAT_KEY(c), other);
    }
    const w = loadedFor ? warps.get(loadedFor) : undefined;
    if (c === loadedFor && w)
      followWarp(w);
    o.changed();
  }
  function hudSection() {
    if (!prefs.hud)
      return null;
    ensure();
    const name = chat.chatId === loadedFor && chat.user ? chat.user : "You";
    return { title: name, body: `<div class="doll-scene"><div class="doll-hud">${renderDoll2(st.you, { id: "hud" })}</div><div class="doll-scene-foot"><span>${busy.has(busyKey("you")) ? `<span class="doll-dim">Updating…</span>` : ""}</span><button class="doll-btn" data-doll-edit="you" title="Open your doll in the LumiDoll tab">Edit</button></div></div>` };
  }
  function sceneSection() {
    if (!prefs.scene)
      return null;
    ensure();
    const people = here();
    const who = sceneFocus(people, st.pin, st.focus);
    if (!who) {
      const hint = warp() ? "No one's with you right now." : "No one yet. Dress someone in the LumiDoll tab, or open a chat with a character.";
      return { title: "With you", body: `<div class="doll-scene"><p class="doll-dim">${hint}</p></div>` };
    }
    const entry = st.cast[castKey(who)];
    const pinned = castKey(st.pin) === castKey(who);
    const chips = people.length > 1 ? `<div class="doll-scene-who">${people.map((n) => `<button class="doll-btn${castKey(n) === castKey(who) ? " doll-btn-primary" : ""}" data-doll-focus="${esc2(n)}" title="${castKey(st.pin) === castKey(n) ? "Pinned: click to follow the story again" : "Show them (pinned while they're here)"}">${esc2(n)}${castKey(st.pin) === castKey(n) ? " \uD83D\uDCCC" : ""}</button>`).join("")}</div>` : "";
    const isBusy = busy.has(busyKey(who));
    const doll = entry ? `<div class="doll-hud">${renderDoll2(entry.look, { id: "scene" })}</div>` : `<p class="doll-dim">${isBusy ? `Dressing ${esc2(who)}…` : `No look for ${esc2(who)} yet.`}</p>${isBusy ? "" : `<button class="doll-btn" data-doll-scene-ask="${esc2(who)}">Dress ${esc2(who)}</button>`}`;
    const foot = `<div class="doll-scene-foot"><span>${entry && isBusy ? `<span class="doll-dim">Updating…</span>` : ""}</span><button class="doll-btn" data-doll-edit="${esc2(who)}" title="Open their doll in the LumiDoll tab">Edit</button></div>`;
    return { title: `With you · ${who}${pinned ? " \uD83D\uDCCC" : ""}`, body: `<div class="doll-scene">${chips}${doll}${foot}</div>` };
  }
  function dressNewcomer() {
    const who = prefs.scene ? sceneFocus(here(), st.pin, st.focus) : null;
    if (!who || st.cast[castKey(who)] || st.asked.includes(castKey(who)) || !autoOn())
      return false;
    st.asked.push(castKey(who));
    st.asked = st.asked.slice(-16);
    const words = warpText(who);
    if (words)
      st.warpSeen[castKey(who)] = { appearance: words.appearance ?? "", outfit: words.outfit ?? "" };
    request(who, "profile", undefined, true);
    return true;
  }
  function followWarp(w) {
    if (!warpDrives(w) || w.chatId !== loadedFor || !autoOn())
      return false;
    let dirty = false;
    const redress = (who, look) => {
      const k = who === "you" ? "you" : castKey(who);
      const t = textOf(w, who);
      const parts = changedParts(st.warpSeen[k], t);
      if (!parts.length)
        return;
      if (request(who, "warp", look, true, { ...t.appearance ? { appearance: t.appearance } : {}, ...t.outfit ? { outfit: t.outfit } : {}, changed: parts })) {
        st.warpSeen[k] = t;
        dirty = true;
      }
    };
    if (prefs.hud)
      redress("you", st.you);
    if (prefs.scene)
      for (const name of hereOf(w)) {
        const e = st.cast[castKey(name)];
        if (e)
          redress(name, e.look);
      }
    if (dressNewcomer())
      dirty = true;
    if (dirty)
      saveChat(loadedFor, st);
    return dirty;
  }
  function onWarp(s) {
    if (!s.chatId)
      return;
    warps.set(s.chatId, s);
    ensure();
    if (s.chatId !== loadedFor)
      return;
    followWarp(s);
    o.changed();
  }
  function onReply(m) {
    ensure();
    if (m.chatId !== loadedFor || m.messageId === st.lastAuto)
      return;
    st.lastAuto = m.messageId;
    const people = here();
    const about = focusFrom(m.text, people);
    if (about)
      st.focus = about;
    saveChat(loadedFor, st);
    if (!warp() && autoOn()) {
      const you = prefs.hud && !busy.has(busyKey("you"));
      const names = prefs.scene ? people : [];
      if (you || names.length) {
        if (you)
          busy.add(busyKey("you"));
        o.send({
          type: "doll_follow",
          chatId: m.chatId,
          messageId: m.messageId,
          people: names,
          pin: st.pin,
          you: you ? st.you : null,
          cast: names.filter((n) => st.cast[castKey(n)]).map((n) => ({ name: n, look: st.cast[castKey(n)].look })),
          asked: st.asked
        });
      }
    }
    o.changed();
  }
  function onFocus(m) {
    ensure();
    if (m.chatId !== loadedFor || !m.name)
      return;
    st.focus = m.name;
    if (m.dressing) {
      busy.add(busyKey(m.name));
      if (!st.asked.includes(castKey(m.name)))
        st.asked = [...st.asked, castKey(m.name)].slice(-16);
    }
    saveChat(loadedFor, st);
    o.changed();
  }
  function catchUp() {
    const w = warp();
    if (w) {
      followWarp(w);
      return;
    }
    const forChat = loadedFor;
    later(() => {
      ensure();
      if (loadedFor !== forChat || warp())
        return;
      if (dressNewcomer()) {
        saveChat(loadedFor, st);
        o.changed();
      }
    });
  }
  function onChat(info) {
    chat = info;
    ensure();
    if (info.chatId === loadedFor)
      catchUp();
    o.changed();
  }
  function onSettings(v) {
    const was = autoOn();
    sv = v;
    ensure();
    if (!was && autoOn())
      catchUp();
    o.changed();
  }
  return { html, handle, onLook, onFocus, onReply, onWarp, onChat, onSettings, hudSection, sceneSection, autoOn, current: () => {
    ensure();
    return cur();
  } };
}

// src/frontend/panel.ts
var KEY2 = "doll:panel";
var COL_W = 170;
var OPEN_H = 380;
var CLOSED = { w: 112, h: 30 };
function load() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY2) ?? "null");
    return v && Number.isFinite(v.x) && Number.isFinite(v.y) ? { x: v.x, y: v.y, open: v.open !== false } : null;
  } catch {
    return null;
  }
}
function store(v) {
  try {
    localStorage.setItem(KEY2, JSON.stringify(v));
  } catch {}
}
function panelHtml(lab, open) {
  const cols = [lab.hudSection(), lab.sceneSection()].filter((x) => !!x);
  const head = `<div class="doll-panel-head"><span>LumiDoll</span><button class="doll-btn doll-btn-ghost" data-doll-panel-toggle title="${open ? "Fold" : "Open"}">${open ? "▾" : "▸"}</button></div>`;
  const body = `<div class="doll-panel-body">${cols.map((c) => `<div class="doll-panel-col"><h4 title="${esc2(c.title)}">${esc2(c.title)}</h4>${c.body}</div>`).join("")}</div>`;
  return { html: head + body, cols: cols.length };
}
function createPanel(ctx, lab, onEdit) {
  const saved = load();
  let open = saved?.open ?? true;
  let widget = null;
  const el = document.createElement("div");
  el.className = "doll-panel";
  let size = { w: 0, h: 0 };
  let shown = true;
  const width = (cols) => open ? Math.max(1, cols) * COL_W + 16 : CLOSED.w;
  try {
    const vw = window.innerWidth || 1200;
    widget = ctx.ui.createFloatWidget({ width: width(2), height: OPEN_H, initialPosition: saved ? { x: saved.x, y: saved.y } : { x: Math.max(8, vw - width(2) - 24), y: 120 }, snapToEdge: true, chromeless: true, tooltip: "LumiDoll" });
    widget.root.appendChild(el);
    widget.onDragEnd((p) => store({ x: p.x, y: p.y, open }));
  } catch (e) {
    console.warn("[doll] no status window", e);
  }
  const onClick = (e) => {
    const t = e.target;
    if (t.closest?.("[data-doll-panel-toggle]")) {
      e.preventDefault();
      open = !open;
      if (widget) {
        const p = widget.getPosition();
        store({ x: p.x, y: p.y, open });
      }
      render();
      return;
    }
    const edit = !!t.closest?.("[data-doll-edit]");
    if (lab.handle(e, el))
      return;
    if (edit)
      onEdit();
  };
  el.addEventListener("click", onClick);
  function render() {
    if (!widget)
      return;
    const { html, cols } = panelHtml(lab, open);
    if (shown !== cols > 0) {
      shown = cols > 0;
      widget.setVisible(shown);
    }
    if (!cols)
      return;
    el.classList.toggle("doll-closed", !open);
    el.innerHTML = html;
    const next = { w: width(cols), h: open ? OPEN_H : CLOSED.h };
    if (next.w !== size.w || next.h !== size.h) {
      size = next;
      widget.setSize(next.w, next.h);
    }
  }
  return {
    render,
    destroy: () => {
      el.removeEventListener("click", onClick);
      widget?.destroy();
    }
  };
}

// src/frontend/styles.ts
var STYLES2 = `
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

// src/frontend/warp-bridge.ts
function connectWarp(onState, target = window) {
  const listener = (e) => {
    const s = cleanWarpState(e.detail);
    if (s)
      onState(s);
  };
  target.addEventListener(WARP_STATE, listener);
  return {
    request: () => {
      try {
        target.dispatchEvent(new CustomEvent(WARP_STATE_REQUEST, { detail: { version: 1 } }));
      } catch {}
    },
    stop: () => target.removeEventListener(WARP_STATE, listener)
  };
}

// src/frontend.ts
var CLEANUP_KEY = "__dollCleanup";
var ICON = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="5" r="2.6"/><path d="M12 7.6v6.4M8 10.5l4-1.6 4 1.6M9.5 21l2.5-7 2.5 7M8.6 17.5h6.8"/></svg>`;
var typing = (root) => {
  const a = document.activeElement;
  return !!a && root.contains(a) && (a.tagName === "TEXTAREA" || a.tagName === "INPUT" && ["text", "password", "search", ""].includes(a.type));
};
function setup(ctx) {
  const prev = globalThis[CLEANUP_KEY];
  if (typeof prev === "function")
    prev();
  const cleanups = [];
  cleanups.push(ctx.dom.addStyle(STYLES2));
  const send = (m) => ctx.sendToBackend(m);
  const chatId = () => {
    try {
      return ctx.getActiveChat().chatId ?? null;
    } catch {
      return null;
    }
  };
  const lab = createDollLab({ send, chatId, changed: () => renderAll() });
  const tab = ctx.ui.registerDrawerTab({
    id: "doll",
    title: "LumiDoll",
    shortName: "LumiDoll",
    headerTitle: "LumiDoll",
    description: "Your doll and the person with you, dressed from the story",
    keywords: ["lumidoll", "doll", "outfit", "clothes", "avatar", "dress up", "paper doll"],
    iconSvg: ICON
  });
  cleanups.push(() => tab.destroy());
  const drawerRoot = document.createElement("div");
  drawerRoot.className = "doll-root";
  tab.root.appendChild(drawerRoot);
  const openSections = new Map;
  let skipped = false;
  function renderDrawer() {
    if (typing(drawerRoot)) {
      skipped = true;
      return;
    }
    skipped = false;
    for (const d of drawerRoot.querySelectorAll("details[data-section]"))
      openSections.set(d.dataset.section, d.open);
    const scroll = drawerRoot.scrollTop;
    drawerRoot.innerHTML = lab.html();
    for (const d of drawerRoot.querySelectorAll("details[data-section]")) {
      const was = openSections.get(d.dataset.section);
      if (was !== undefined)
        d.open = was;
    }
    drawerRoot.scrollTop = scroll;
  }
  cleanups.push(tab.onActivate(() => renderDrawer()));
  const panel = createPanel(ctx, lab, () => {
    tab.activate();
    renderDrawer();
  });
  cleanups.push(() => panel.destroy());
  function renderAll() {
    renderDrawer();
    panel.render();
  }
  for (const type of ["click", "input", "change"]) {
    const h = (e) => {
      lab.handle(e, drawerRoot);
    };
    drawerRoot.addEventListener(type, h);
    cleanups.push(() => drawerRoot.removeEventListener(type, h));
  }
  const onBlur = () => {
    if (skipped)
      setTimeout(() => {
        if (!typing(drawerRoot))
          renderDrawer();
      }, 0);
  };
  drawerRoot.addEventListener("focusout", onBlur);
  cleanups.push(() => drawerRoot.removeEventListener("focusout", onBlur));
  const warp = connectWarp((s) => lab.onWarp(s));
  cleanups.push(() => warp.stop());
  cleanups.push(ctx.onBackendMessage((raw) => {
    const m = raw;
    switch (m.type) {
      case "settings":
        lab.onSettings({ settings: m.settings, jevKeySet: m.jevKeySet, jevReady: m.jevReady, connections: m.connections });
        break;
      case "chat":
        lab.onChat({ chatId: m.chatId, character: m.character, user: m.user });
        warp.request();
        break;
      case "reply":
        lab.onReply(m);
        break;
      case "doll_look":
        lab.onLook(m);
        break;
      case "doll_focus":
        lab.onFocus(m);
        break;
    }
  }));
  send({ type: "hello", chatId: chatId() });
  warp.request();
  renderAll();
  const teardown = () => {
    for (const c of cleanups.splice(0)) {
      try {
        c();
      } catch {}
    }
  };
  globalThis[CLEANUP_KEY] = teardown;
  return teardown;
}
export {
  setup
};
