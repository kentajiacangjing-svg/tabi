// Renders the demo "work photos" (public/seed/*.jpg): soft, architectural-photo-style scenes of
// finished rooms, kitchens, baths, facades, roofs and gardens. They are drawn (SVG → Chromium → JPEG),
// so nothing here is a real customer's house. Real companies replace them with their own photos.
// Run: node scripts/gen-seed-photos.mjs
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";

const W = 1600, H = 1200;
const out = new URL("../public/seed/", import.meta.url);
mkdirSync(out, { recursive: true });

/* ---------- small helpers ---------- */
function rng(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const f = (n) => Math.round(n * 10) / 10;
const pts = (a) => a.map(([x, y]) => `${f(x)},${f(y)}`).join(" ");
const poly = (a, fill, extra = "") => `<polygon points="${pts(a)}" fill="${fill}" ${extra}/>`;
const lin = (id, stops, x1 = 0, y1 = 0, x2 = 0, y2 = 1) =>
  `<linearGradient id="${id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${stops.map(([o, c, a = 1]) => `<stop offset="${o}" stop-color="${c}" stop-opacity="${a}"/>`).join("")}</linearGradient>`;
const rad = (id, stops, cx = 0.5, cy = 0.5, r = 0.5) =>
  `<radialGradient id="${id}" cx="${cx}" cy="${cy}" r="${r}">${stops.map(([o, c, a = 1]) => `<stop offset="${o}" stop-color="${c}" stop-opacity="${a}"/>`).join("")}</radialGradient>`;
const blur = (id, s) => `<filter id="${id}" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="${s}"/></filter>`;

/** Shared finish: grain, vignette, a hint of warm light. Makes flat vectors read as a photograph. */
function finish(body, defs, { warmth = 0.06, vignette = 0.28, seed = 3 } = {}) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
  <defs>${defs}
    <filter id="grain" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="${seed}"/>
      <feColorMatrix type="saturate" values="0"/>
      <feComponentTransfer><feFuncA type="linear" slope="0.07"/></feComponentTransfer>
    </filter>
    ${rad("vig", [[0.55, "#000", 0], [1, "#000", vignette]], 0.5, 0.5, 0.75)}
    ${lin("warm", [[0, "#ffd9a8", warmth], [1, "#ffd9a8", 0]], 0, 0, 1, 1)}
    <filter id="soft"><feGaussianBlur stdDeviation="0.6"/></filter>
  </defs>
  <g filter="url(#soft)">${body}</g>
  <rect width="${W}" height="${H}" fill="url(#warm)"/>
  <rect width="${W}" height="${H}" fill="url(#vig)"/>
  <rect width="${W}" height="${H}" filter="url(#grain)"/>
</svg>`;
}

/* ---------- one-point perspective room ---------- */
function room(o) {
  const R = rng(o.seed ?? 7);
  const bx0 = o.back?.[0] ?? 430, by0 = o.back?.[1] ?? 250, bx1 = o.back?.[2] ?? 1170, by1 = o.back?.[3] ?? 780;
  const vpx = (bx0 + bx1) / 2 + (o.vpShift ?? 0), vpy = by0 + (by1 - by0) * 0.6;
  const S = (x, y, t) => [vpx + (x - vpx) * t, vpy + (y - vpy) * t];
  const T = 8; // "infinitely near"
  const tAt = (k, step) => 6 / (6 - step * k); // equal real-world spacing in depth
  let defs = "", body = "";

  // walls, ceiling, floor
  defs += lin("bw", [[0, o.wall[1]], [1, o.wall[0]]]);
  defs += lin("lw", [[0, o.wall[2] ?? o.wall[0]], [1, o.wall[1]]], 0, 0, 1, 0);
  defs += lin("rw", [[0, o.wall[1]], [1, o.wall[2] ?? o.wall[0]]], 0, 0, 1, 0);
  defs += lin("cl", [[0, o.ceiling[0]], [1, o.ceiling[1]]]);
  defs += lin("fl", [[0, o.floor[0]], [1, o.floor[1]]]);
  const floorPoly = [S(bx0, by1, 1), S(bx1, by1, 1), S(bx1, by1, T), S(bx0, by1, T)];
  body += poly([S(bx0, by0, 1), S(bx1, by0, 1), S(bx1, by0, T), S(bx0, by0, T)], "url(#cl)");
  body += poly([S(bx0, by0, 1), S(bx0, by1, 1), S(bx0, by1, T), S(bx0, by0, T)], "url(#lw)");
  body += poly([S(bx1, by0, 1), S(bx1, by1, 1), S(bx1, by1, T), S(bx1, by0, T)], "url(#rw)");
  body += `<rect x="${bx0}" y="${by0}" width="${bx1 - bx0}" height="${by1 - by0}" fill="url(#bw)"/>`;
  if (o.backAccent) body += `<rect x="${o.backAccent[0]}" y="${by0}" width="${o.backAccent[1] - o.backAccent[0]}" height="${by1 - by0}" fill="${o.backAccent[2]}"/>`;

  // floor + boards / tiles
  defs += `<clipPath id="floorClip"><polygon points="${pts(floorPoly)}"/></clipPath>`;
  body += poly(floorPoly, "url(#fl)");
  let lines = "";
  if (o.floorKind === "boards" || o.floorKind === "tiles") {
    const n = o.floorKind === "boards" ? 22 : 8;
    for (let i = -n; i <= 2 * n; i++) {
      const x = bx0 + ((bx1 - bx0) * i) / n;
      lines += `<line x1="${f(S(x, by1, 1)[0])}" y1="${by1}" x2="${f(S(x, by1, T)[0])}" y2="${f(S(x, by1, T)[1])}"/>`;
    }
    if (o.floorKind === "tiles") {
      for (let k = 1; k < 13; k++) { const [, y] = S(0, by1, tAt(k, 0.42)); lines += `<line x1="-200" y1="${f(y)}" x2="${W + 200}" y2="${f(y)}"/>`; }
    } else {
      for (let i = -n; i < 2 * n; i++) for (let k = 0; k < 12; k++) {
        if (R() < 0.55) continue;
        const t = tAt(k + R(), 0.42), xa = bx0 + ((bx1 - bx0) * i) / n, xb = bx0 + ((bx1 - bx0) * (i + 1)) / n;
        const [x1, y] = S(xa, by1, t), [x2] = S(xb, by1, t);
        lines += `<line x1="${f(x1)}" y1="${f(y)}" x2="${f(x2)}" y2="${f(y)}"/>`;
      }
    }
  }
  body += `<g clip-path="url(#floorClip)" stroke="${o.floorLine ?? "#000"}" stroke-opacity="${o.floorLineOpacity ?? 0.12}" stroke-width="1.6">${lines}</g>`;
  // baseboards
  body += poly([S(bx0, by1 - 14, 1), S(bx1, by1 - 14, 1), S(bx1, by1, 1), S(bx0, by1, 1)], o.baseboard ?? "#e9e5de");
  body += poly([S(bx0, by1 - 14, 1), S(bx0, by1 - 14, T), S(bx0, by1, T), S(bx0, by1, 1)], o.baseboard ?? "#e9e5de", 'opacity=".8"');

  // window on the back wall, with an out-of-focus garden
  if (o.window) {
    const [wx0, wy0, wx1, wy1] = o.window;
    defs += lin("sky", [[0, o.sky?.[0] ?? "#e7ecea"], [1, o.sky?.[1] ?? "#f4f3ee"]]);
    defs += `<clipPath id="winClip"><rect x="${wx0}" y="${wy0}" width="${wx1 - wx0}" height="${wy1 - wy0}"/></clipPath>` + blur("bk", 16);
    let green = "";
    for (let i = 0; i < 26; i++) {
      const cx = wx0 + R() * (wx1 - wx0), cy = wy0 + (wy1 - wy0) * (0.45 + R() * 0.6), r = 40 + R() * 90;
      green += `<ellipse cx="${f(cx)}" cy="${f(cy)}" rx="${f(r)}" ry="${f(r * 0.8)}" fill="${["#6f8a62", "#58744f", "#86a07a", "#4b6447"][i % 4]}" opacity=".9"/>`;
    }
    body += `<g clip-path="url(#winClip)"><rect x="${wx0}" y="${wy0}" width="${wx1 - wx0}" height="${wy1 - wy0}" fill="url(#sky)"/><g filter="url(#bk)">${green}</g><rect x="${wx0}" y="${wy0}" width="${wx1 - wx0}" height="${wy1 - wy0}" fill="#fff" opacity=".28"/></g>`;
    const fr = o.frame ?? "#2b2a28";
    body += `<rect x="${wx0}" y="${wy0}" width="${wx1 - wx0}" height="${wy1 - wy0}" fill="none" stroke="${fr}" stroke-width="10"/>`;
    for (const mx of o.mullions ?? [(wx0 + wx1) / 2]) body += `<rect x="${mx - 3}" y="${wy0}" width="6" height="${wy1 - wy0}" fill="${fr}"/>`;
    // light pool on the floor
    defs += blur("lp", 34) + rad("glow", [[0, "#fff", 0.55], [1, "#fff", 0]]);
    const a = S(wx0, by1, 1.25), b = S(wx1, by1, 1.25), c = S(wx1 + 240, by1, 2.6), d = S(wx0 + 240, by1, 2.6);
    body += poly([a, b, c, d], "#fff8ea", 'opacity=".42" filter="url(#lp)"');
    body += `<ellipse cx="${(wx0 + wx1) / 2}" cy="${(wy0 + wy1) / 2}" rx="${(wx1 - wx0) * 0.9}" ry="${(wy1 - wy0) * 0.8}" fill="url(#glow)"/>`;
  }

  // downlights
  for (const [x, t] of o.downlights ?? []) {
    const [cx, cy] = S(x, by0, t);
    body += `<ellipse cx="${f(cx)}" cy="${f(cy)}" rx="${f(9 * t)}" ry="${f(3 * t)}" fill="#fffdf6"/>`;
  }

  /** A box standing on the floor (or wall-hung when yb < by1). x/y in back-wall units, t0..t1 = depth. */
  const box = (x0, x1, yt, yb, t0, t1, [front, top, side], { shadow = true, stroke } = {}) => {
    let g = "";
    if (shadow && yb >= by1 - 1) {
      const s = [S(x0 - 10, by1, t0 - 0.02), S(x1 + 10, by1, t0 - 0.02), S(x1 + 18, by1, t1 + 0.06), S(x0 - 18, by1, t1 + 0.06)];
      g += poly(s, "#000", 'opacity=".28" filter="url(#sh)"');
    }
    if (x1 < vpx) g += poly([S(x1, yt, t0), S(x1, yt, t1), S(x1, yb, t1), S(x1, yb, t0)], side);
    if (x0 > vpx) g += poly([S(x0, yt, t0), S(x0, yt, t1), S(x0, yb, t1), S(x0, yb, t0)], side);
    if (yt > vpy) g += poly([S(x0, yt, t0), S(x1, yt, t0), S(x1, yt, t1), S(x0, yt, t1)], top);
    if (yb < vpy) g += poly([S(x0, yb, t0), S(x1, yb, t0), S(x1, yb, t1), S(x0, yb, t1)], side);
    g += poly([S(x0, yt, t1), S(x1, yt, t1), S(x1, yb, t1), S(x0, yb, t1)], front, stroke ? `stroke="${stroke}" stroke-width="1"` : "");
    return g;
  };
  defs += blur("sh", 14) + blur("leaf", 1.2);

  const plant = (x, t, scale = 1, pot = "#d9d3c8") => {
    let g = box(x - 34, x + 34, by1 - 80, by1, t - 0.05, t, [pot, "#cfc8bc", "#c6bfb2"]);
    const [px, py] = S(x, by1 - 80, t);
    let leaves = "";
    for (let i = 0; i < 16; i++) {
      const ang = -90 + (R() - 0.5) * 150, len = (90 + R() * 120) * scale * t;
      const ex = px + Math.cos((ang * Math.PI) / 180) * len, ey = py + Math.sin((ang * Math.PI) / 180) * len;
      leaves += `<path d="M${f(px)} ${f(py)} Q ${f((px + ex) / 2 + 20)} ${f((py + ey) / 2 - 10)} ${f(ex)} ${f(ey)}" stroke="${["#3f5e45", "#557a5a", "#2f4a36"][i % 3]}" stroke-width="${f(3 * t)}" fill="none"/>`;
      leaves += `<ellipse cx="${f(ex)}" cy="${f(ey)}" rx="${f(26 * scale * t)}" ry="${f(11 * scale * t)}" transform="rotate(${f(ang)} ${f(ex)} ${f(ey)})" fill="${["#476b4c", "#5d8462", "#365540"][i % 3]}"/>`;
    }
    return g + `<g filter="url(#leaf)">${leaves}</g>`;
  };
  const pendant = (x, t, drop, color = "#2b2a28") => {
    const [cx, cy] = S(x, by0, t), [, ly] = S(x, by0 + drop, t);
    return `<line x1="${f(cx)}" y1="${f(cy)}" x2="${f(cx)}" y2="${f(ly)}" stroke="#333" stroke-width="2"/>
      <ellipse cx="${f(cx)}" cy="${f(ly + 30 * t)}" rx="${f(60 * t)}" ry="${f(26 * t)}" fill="#ffe7b8" opacity=".35" filter="url(#lp)"/>
      <path d="M${f(cx - 26 * t)} ${f(ly + 22 * t)} Q ${f(cx)} ${f(ly - 14 * t)} ${f(cx + 26 * t)} ${f(ly + 22 * t)} Z" fill="${color}"/>
      <ellipse cx="${f(cx)}" cy="${f(ly + 22 * t)}" rx="${f(24 * t)}" ry="${f(5 * t)}" fill="#fff4d6"/>`;
  };
  return { S, box, plant, pendant, bx0, bx1, by0, by1, vpx, vpy, R, add: (s) => (body += s), addDefs: (s) => (defs += s), done: (opt) => finish(body, defs, opt) };
}

/* ---------- scenes ---------- */
const scenes = {};

scenes["interior-1"] = () => {
  const r = room({ seed: 11, wall: ["#f3f0ea", "#e9e4dc", "#d9d3ca"], ceiling: ["#ebe7e0", "#f4f1ec"], floor: ["#c39d72", "#a57c52"], floorKind: "boards", window: [620, 320, 1080, 700], mullions: [850], downlights: [[700, 1.6], [900, 1.6], [700, 2.6], [900, 2.6]] });
  // rug, sofa, coffee table, plant, art
  r.add(poly([r.S(560, r.by1, 1.35), r.S(1100, r.by1, 1.35), r.S(1100, r.by1, 2.2), r.S(560, r.by1, 2.2)], "#ece6db", 'opacity=".95"'));
  r.add(r.box(450, 760, r.by1 - 175, r.by1 - 40, 1.18, 1.3, ["#cdc4b6", "#d9d1c4", "#bdb3a4"]));
  r.add(r.box(450, 760, r.by1 - 95, r.by1, 1.18, 1.62, ["#c8bfb1", "#ddd5c8", "#b8ae9f"]));
  r.add(r.box(470, 600, r.by1 - 112, r.by1 - 95, 1.3, 1.58, ["#d7cfc2", "#e4ddd1", "#c6bdaf"], { shadow: false }));
  r.add(r.box(612, 742, r.by1 - 112, r.by1 - 95, 1.3, 1.58, ["#d7cfc2", "#e4ddd1", "#c6bdaf"], { shadow: false }));
  r.add(r.box(820, 1010, r.by1 - 60, r.by1, 1.7, 1.95, ["#6e5641", "#8a6f56", "#5e4836"]));
  r.add(r.plant(1110, 1.5, 1.1));
  r.add(`<rect x="470" y="380" width="120" height="160" fill="#f7f5f0" stroke="#2b2a28" stroke-width="4"/><rect x="488" y="398" width="84" height="124" fill="#d8cfc0"/>`);
  return r.done({ seed: 4 });
};

scenes["interior-2"] = () => {
  const r = room({ seed: 21, wall: ["#f1efe9", "#e6e2da", "#d6d0c6"], ceiling: ["#ebe8e2", "#f4f2ee"], floor: ["#d8bf9a", "#bb9a70"], floorKind: "boards", backAccent: [430, 760, "#a9b5a2"], window: [860, 330, 1110, 690], mullions: [], downlights: [[640, 1.7], [960, 1.7]], vpShift: 40 });
  // bench + shelf against the sage accent wall
  r.add(r.box(470, 720, r.by1 - 70, r.by1, 1.02, 1.2, ["#9b7b5a", "#b08f6c", "#856749"]));
  r.add(r.box(500, 690, 420, 436, 1.0, 1.06, ["#8f7155", "#a48466", "#7a5e45"], { shadow: false }));
  r.add(`<rect x="520" y="372" width="34" height="48" fill="#e9e4da"/><rect x="566" y="384" width="26" height="36" fill="#c9b79c"/><circle cx="640" cy="400" r="18" fill="#556b52"/>`);
  r.add(r.plant(1060, 1.55, 0.9, "#e4ddd2"));
  r.add(poly([r.S(500, r.by1, 1.4), r.S(980, r.by1, 1.4), r.S(980, r.by1, 2.3), r.S(500, r.by1, 2.3)], "#efe9df", 'opacity=".9"'));
  return r.done({ seed: 5, warmth: 0.08 });
};

const kitchen = (o) => () => {
  const r = room({ seed: o.seed, wall: o.wall, ceiling: ["#ecebe7", "#f5f4f1"], floor: o.floor, floorKind: o.floorKind, floorLineOpacity: 0.09, window: o.window, mullions: o.mullions, downlights: [[620, 2.2], [980, 2.2]] });
  const { by1, by0 } = r;
  // upper cabinets and backsplash on the back wall
  r.add(`<rect x="${r.bx0}" y="${by0 + 20}" width="${o.window ? 160 : r.bx1 - r.bx0}" height="150" fill="${o.cab}"/>`);
  if (!o.window) for (let x = r.bx0 + 4; x < r.bx1 - 10; x += 92) r.add(`<rect x="${x}" y="${by0 + 24}" width="88" height="142" fill="none" stroke="#000" stroke-opacity=".12"/>`);
  r.add(`<rect x="${r.bx0}" y="${by1 - 260}" width="${r.bx1 - r.bx0}" height="140" fill="${o.splash}"/>`);
  for (let x = r.bx0; x < r.bx1; x += 38) r.add(`<line x1="${x}" y1="${by1 - 260}" x2="${x}" y2="${by1 - 120}" stroke="#000" stroke-opacity=".06"/>`);
  for (let y = by1 - 260; y < by1 - 120; y += 19) r.add(`<line x1="${r.bx0}" y1="${y}" x2="${r.bx1}" y2="${y}" stroke="#000" stroke-opacity=".05"/>`);
  // base run + counter
  r.add(r.box(r.bx0, r.bx1, by1 - 120, by1, 1.0, 1.1, [o.cab, o.counter, o.cab], { shadow: false }));
  r.add(r.box(r.bx0, r.bx1, by1 - 128, by1 - 120, 1.0, 1.115, [o.counter, o.counter, o.counter], { shadow: false }));
  for (let x = r.bx0 + 80; x < r.bx1; x += 130) { const [a, b] = r.S(x, by1 - 110, 1.1), [, c] = r.S(x, by1 - 6, 1.1); r.add(`<line x1="${f(a)}" y1="${f(b)}" x2="${f(a)}" y2="${f(c)}" stroke="#000" stroke-opacity=".14"/>`); }
  // island
  r.add(r.box(560, 1040, by1 - 125, by1, 1.62, 1.95, [o.island, o.counter, o.islandSide]));
  r.add(r.box(545, 1055, by1 - 134, by1 - 125, 1.6, 1.97, [o.counter, o.counter, "#d8d5ce"], { shadow: false }));
  for (const x of [660, 800, 940]) r.add(r.pendant(x, 1.75, 170, o.lamp));
  r.add(r.plant(1110, 1.25, 0.6, "#efece6"));
  return r.done({ seed: o.seed, warmth: 0.05 });
};
scenes["kitchen-1"] = kitchen({ seed: 31, wall: ["#f4f3ef", "#e9e7e1", "#dad7cf"], floor: ["#cfb38d", "#b49064"], floorKind: "boards", cab: "#f1efea", counter: "#e9e7e2", splash: "#dcd8cf", island: "#3b3f3a", islandSide: "#2f332f", lamp: "#2b2a28", window: [880, 300, 1150, 500], mullions: [] });
scenes["kitchen-2"] = kitchen({ seed: 37, wall: ["#f2f0eb", "#e7e3db", "#d7d1c7"], floor: ["#d9d4cb", "#bdb6aa"], floorKind: "tiles", cab: "#b9aa8f", counter: "#f0eee9", splash: "#e7e3da", island: "#a48b68", islandSide: "#8d7656", lamp: "#e8e4dc" });
scenes["clean-1"] = kitchen({ seed: 41, wall: ["#f7f6f3", "#eeece7", "#e0ddd6"], floor: ["#e2dbcf", "#c9bfae"], floorKind: "boards", cab: "#f6f5f1", counter: "#fbfaf8", splash: "#f0eee9", island: "#f3f1ec", islandSide: "#e3e0d9", lamp: "#f0ede6", window: [880, 300, 1150, 500], mullions: [] });

const bath = (o) => () => {
  const r = room({ seed: o.seed, wall: o.wall, ceiling: ["#e9e8e4", "#f2f1ee"], floor: o.floor, floorKind: "tiles", floorLine: "#000", floorLineOpacity: 0.16, window: o.window, mullions: [], frame: "#d9d6cf", sky: ["#f2f3f0", "#f7f7f4"], back: [470, 230, 1130, 790] });
  const { by1, by0 } = r;
  for (let x = r.bx0; x <= r.bx1; x += 110) r.add(`<line x1="${x}" y1="${by0}" x2="${x}" y2="${by1}" stroke="#000" stroke-opacity=".07"/>`);
  for (let y = by0; y <= by1; y += 110) r.add(`<line x1="${r.bx0}" y1="${y}" x2="${r.bx1}" y2="${y}" stroke="#000" stroke-opacity=".07"/>`);
  r.add(r.box(r.bx0, r.bx1, by1 - 140, by1, 1.0, 1.42, [o.tub, "#f8f8f6", "#e2e1dd"]));
  const [ix0, iy] = r.S(r.bx0 + 26, by1 - 140, 1.06), [ix1] = r.S(r.bx1 - 26, by1 - 140, 1.06), [jx0, jy] = r.S(r.bx0 + 26, by1 - 140, 1.36), [jx1] = r.S(r.bx1 - 26, by1 - 140, 1.36);
  r.add(poly([[ix0, iy], [ix1, iy], [jx1, jy], [jx0, jy]], "#d9dcdb"));
  r.add(`<rect x="${r.vpx - 6}" y="${by1 - 330}" width="12" height="150" fill="#bfc0bd"/><rect x="${r.vpx - 40}" y="${by1 - 336}" width="80" height="10" rx="5" fill="#b4b5b2"/>`);
  if (o.shelf) r.add(`<rect x="${r.bx0 + 40}" y="${by1 - 330}" width="200" height="8" fill="#a68a69"/><rect x="${r.bx0 + 60}" y="${by1 - 372}" width="26" height="42" rx="6" fill="#efede8"/><rect x="${r.bx0 + 100}" y="${by1 - 362}" width="20" height="32" rx="5" fill="#cfc8bc"/>`);
  r.add(r.plant(r.bx1 - 40, 1.6, 0.55, "#e9e6e0"));
  return r.done({ seed: o.seed, warmth: 0.04, vignette: 0.3 });
};
scenes["bath-1"] = bath({ seed: 51, wall: ["#efeeea", "#e3e1dc", "#d3d0c9"], floor: ["#8c8a85", "#6f6d68"], tub: "#f3f3f1", window: [900, 270, 1090, 400], shelf: true });
scenes["bath-2"] = bath({ seed: 57, wall: ["#e7e2d8", "#dad3c6", "#c8c0b2"], floor: ["#b9b2a6", "#9d968a"], tub: "#f6f5f2", window: null, shelf: true });

scenes["aircon-1"] = () => {
  const r = room({ seed: 61, wall: ["#f4f2ed", "#e8e5de", "#d9d5cd"], ceiling: ["#ecebe6", "#f5f4f0"], floor: ["#bf9c74", "#a17c56"], floorKind: "boards", window: [480, 360, 760, 700], mullions: [620], downlights: [[800, 1.8]] });
  const { by0 } = r;
  r.add(`<rect x="820" y="${by0 + 40}" width="270" height="78" rx="12" fill="#fbfbf9"/><rect x="820" y="${by0 + 96}" width="270" height="22" rx="6" fill="#ecebe7"/><line x1="836" y1="${by0 + 108}" x2="1074" y2="${by0 + 108}" stroke="#cfcdc7" stroke-width="3"/><rect x="${f(820 + 90)}" y="${by0 + 52}" width="90" height="4" rx="2" fill="#e3e2dd"/>`);
  r.add(r.box(820, 1110, r.by1 - 150, r.by1 - 40, 1.15, 1.26, ["#9aa39a", "#a9b1a8", "#89928a"]));
  r.add(r.box(820, 1110, r.by1 - 85, r.by1, 1.15, 1.55, ["#939c93", "#a8b0a6", "#828b82"]));
  r.add(r.plant(520, 1.45, 0.9));
  return r.done({ seed: 6 });
};

/* ---------- facades ---------- */
function facade(o) {
  const R = rng(o.seed);
  let defs = "", body = "";
  defs += lin("sky", [[0, o.sky[0]], [1, o.sky[1]]]) + blur("b8", 8) + blur("b20", 20) + blur("b3", 3) + blur("b40", 40);
  defs += lin("wallL", [[0, o.wall[0]], [1, o.wall[1]]], 0, 0, 1, 0);
  defs += lin("glass", [[0, "#5d6663"], [0.5, "#3c4442"], [1, "#2a302f"]], 0, 0, 0.4, 1);
  defs += lin("refl", [[0, "#fff", 0], [0.5, "#fff", 0.28], [1, "#fff", 0]], 0, 0, 1, 1);
  defs += lin("lawn", [[0, "#7d8f62"], [1, "#5b6c46"]]);
  body += `<rect width="${W}" height="${H}" fill="url(#sky)"/>`;
  // distant trees
  let far = "";
  for (let i = 0; i < 30; i++) far += `<ellipse cx="${f(R() * W)}" cy="${f(820 + R() * 60)}" rx="${f(80 + R() * 120)}" ry="${f(60 + R() * 70)}" fill="${["#8d9a83", "#7c8a73", "#9aa691"][i % 3]}"/>`;
  body += `<g filter="url(#b20)" opacity=".85">${far}</g>`;
  const x0 = o.x0 ?? 300, x1 = o.x1 ?? 1300, top = o.top ?? 380, base = 940;
  // house body
  body += `<rect x="${x0}" y="${top}" width="${x1 - x0}" height="${base - top}" fill="url(#wallL)"/>`;
  if (o.siding) for (let y = top + 6; y < base; y += 26) body += `<rect x="${x0}" y="${y}" width="${x1 - x0}" height="3" fill="#000" opacity=".09"/>`;
  if (o.accent) body += `<rect x="${o.accent[0]}" y="${top}" width="${o.accent[1] - o.accent[0]}" height="${base - top}" fill="${o.accent[2]}"/>${Array.from({ length: Math.floor((o.accent[1] - o.accent[0]) / 18) }, (_, i) => `<rect x="${o.accent[0] + i * 18}" y="${top}" width="2" height="${base - top}" fill="#000" opacity=".12"/>`).join("")}`;
  // roof
  if (o.roof === "gable") {
    const mid = (x0 + x1) / 2;
    body += poly([[x0 - 60, top + 10], [mid, top - 230], [x1 + 60, top + 10]], o.roofColor);
    body += poly([[x0 - 60, top + 10], [x1 + 60, top + 10], [x1 + 60, top + 26], [x0 - 60, top + 26]], o.trim);
    body += `<rect x="${x0}" y="${top + 26}" width="${x1 - x0}" height="40" fill="#000" opacity=".22" filter="url(#b8)"/>`;
    const gab = [[x0 + 60, top + 10], [mid, top - 175], [x1 - 60, top + 10]];
    body += poly(gab, o.gable ?? o.wall[0]);
    defs += `<clipPath id="gab"><polygon points="${pts(gab)}"/></clipPath>`;
    let gl = "";
    for (let y = top - 160; y < top + 10; y += 26) gl += `<line x1="${x0}" y1="${y}" x2="${x1}" y2="${y}" stroke="#000" stroke-opacity="${o.siding ? 0.09 : 0}" stroke-width="3"/>`;
    body += `<g clip-path="url(#gab)">${gl}</g>`;
    body += poly([[x0 - 60, top + 10], [mid, top - 230], [mid, top - 200], [x0 - 30, top + 10]], o.roofColor);
    body += poly([[x1 + 60, top + 10], [mid, top - 230], [mid, top - 200], [x1 + 30, top + 10]], o.roofColor);
  } else {
    body += `<rect x="${x0 - 30}" y="${top - 26}" width="${x1 - x0 + 60}" height="30" fill="${o.trim}"/><rect x="${x0}" y="${top + 4}" width="${x1 - x0}" height="30" fill="#000" opacity=".2" filter="url(#b8)"/>`;
  }
  // windows
  for (const [wx, wy, ww, wh] of o.windows) {
    body += `<rect x="${wx - 8}" y="${wy - 8}" width="${ww + 16}" height="${wh + 16}" fill="${o.frame}"/><rect x="${wx}" y="${wy}" width="${ww}" height="${wh}" fill="url(#glass)"/>`;
    body += `<polygon points="${wx},${wy + wh * 0.7} ${wx + ww * 0.6},${wy} ${wx + ww},${wy} ${wx + ww},${wy + wh * 0.2} ${wx + ww * 0.3},${wy + wh}  ${wx},${wy + wh}" fill="url(#refl)"/>`;
    if (ww > 160) body += `<rect x="${wx + ww / 2 - 3}" y="${wy}" width="6" height="${wh}" fill="${o.frame}"/>`;
    body += `<rect x="${wx - 12}" y="${wy + wh + 8}" width="${ww + 24}" height="8" fill="${o.trim}"/>`;
  }
  // door
  if (o.door) {
    const [dx, dw] = o.door;
    body += `<rect x="${dx}" y="${base - 260}" width="${dw}" height="260" fill="${o.doorColor ?? "#7b5b3e"}"/>${Array.from({ length: Math.floor(dw / 14) }, (_, i) => `<rect x="${dx + i * 14}" y="${base - 260}" width="2" height="260" fill="#000" opacity=".15"/>`).join("")}<rect x="${dx + dw - 22}" y="${base - 150}" width="5" height="60" fill="#c9c4b8"/>`;
    body += `<rect x="${dx - 40}" y="${base - 290}" width="${dw + 80}" height="16" fill="${o.trim}"/><rect x="${dx - 40}" y="${base - 274}" width="${dw + 80}" height="24" fill="#000" opacity=".18" filter="url(#b8)"/>`;
  }
  // light from the left: shade the right side of the house
  defs += lin("shade", [[0, "#000", 0], [0.65, "#000", 0], [1, "#000", 0.16]], 0, 0, 1, 0);
  body += `<rect x="${x0}" y="${top}" width="${x1 - x0}" height="${base - top}" fill="url(#shade)"/>`;
  // scaffolding with mesh (painting in progress)
  if (o.scaffold) {
    let s = `<rect x="${x0 - 40}" y="${top - 60}" width="${x1 - x0 + 80}" height="${base - top + 60}" fill="#dfe3dc" opacity=".55"/>`;
    for (let x = x0 - 40; x <= x1 + 40; x += 180) s += `<rect x="${x}" y="${top - 70}" width="8" height="${base - top + 70}" fill="#8b8f8a"/>`;
    for (let y = top - 40; y < base; y += 170) s += `<rect x="${x0 - 40}" y="${y}" width="${x1 - x0 + 88}" height="10" fill="#9a9e98"/>`;
    body += s;
  }
  // ground, path, hedge, foreground tree
  body += `<rect x="0" y="${base}" width="${W}" height="${H - base}" fill="url(#lawn)"/>`;
  body += poly([[o.door ? o.door[0] - 30 : 760, base], [o.door ? o.door[0] + o.door[1] + 30 : 840, base], [o.door ? o.door[0] + o.door[1] + 160 : 980, H], [o.door ? o.door[0] - 160 : 620, H]], "#cfc9bd");
  let hedge = "";
  const gap = o.door ? [o.door[0] - 70, o.door[0] + o.door[1] + 70] : [700, 900];
  for (let i = 0; i < 40; i++) {
    let hx = R() * W;
    if (hx > gap[0] && hx < gap[1]) hx = hx < (gap[0] + gap[1]) / 2 ? gap[0] - 40 : gap[1] + 40;
    hedge += `<ellipse cx="${f(hx)}" cy="${f(base + 20 + R() * 40)}" rx="${f(40 + R() * 50)}" ry="${f(30 + R() * 25)}" fill="${["#4f6342", "#5f7650", "#435638"][i % 3]}"/>`;
  }
  body += `<g filter="url(#b3)">${hedge}</g>`;
  let tree = "";
  for (let i = 0; i < 26; i++) tree += `<ellipse cx="${f(o.tree + (R() - 0.5) * 380)}" cy="${f(220 + R() * 420)}" rx="${f(70 + R() * 90)}" ry="${f(60 + R() * 80)}" fill="${["#3d5236", "#4b6442", "#58714c"][i % 3]}"/>`;
  body += `<rect x="${o.tree - 14}" y="500" width="28" height="${base - 480}" fill="#4a3d31" filter="url(#b8)"/><g filter="url(#b40)" opacity=".95">${tree}</g>`;
  return finish(body, defs, { seed: o.seed, warmth: 0.07, vignette: 0.22 });
}
scenes["exterior-1"] = () => facade({ seed: 71, sky: ["#c9d3d6", "#eef0ec"], wall: ["#e8e3d9", "#d9d2c5"], siding: true, roof: "gable", roofColor: "#3b3e3f", trim: "#f4f2ee", frame: "#f1efe9", windows: [[380, 480, 200, 150], [1010, 480, 200, 150], [380, 700, 200, 150]], door: [700, 120], tree: 1480 });
scenes["exterior-2"] = () => facade({ seed: 73, sky: ["#d4dadb", "#f1f1ec"], wall: ["#f4f3ef", "#e4e2dc"], roof: "flat", trim: "#e9e7e2", frame: "#2d2f2e", accent: [880, 1180, "#a77f5a"], windows: [[380, 470, 300, 170], [380, 700, 300, 170], [940, 520, 180, 300]], door: [720, 110], doorColor: "#2f3230", tree: 120 });
scenes["exterior-3"] = () => facade({ seed: 77, sky: ["#c6cfd1", "#ecede8"], wall: ["#5a5e5c", "#4a4e4c"], siding: true, roof: "gable", roofColor: "#2a2c2d", trim: "#e8e6e0", frame: "#e8e6e0", windows: [[400, 490, 200, 150], [1000, 490, 200, 150], [1000, 710, 200, 150]], door: [640, 120], doorColor: "#a07a52", tree: 1500 });
scenes["exterior-4"] = () => facade({ seed: 79, sky: ["#cdd5d6", "#f0f0eb"], wall: ["#ddd6c8", "#cdc5b6"], roof: "gable", roofColor: "#5b4a3d", trim: "#f2efe8", frame: "#f2efe8", windows: [[420, 500, 180, 140], [1000, 500, 180, 140], [1000, 720, 180, 140]], door: [700, 110], tree: 100, scaffold: true });
scenes["exterior-5"] = () => facade({ seed: 83, sky: ["#cbd2d3", "#eeeeea"], wall: ["#f1f0ec", "#e2e0da"], siding: true, roof: "gable", roofColor: "#1f2122", trim: "#1f2122", frame: "#1f2122", gable: "#2b2e2f", windows: [[400, 490, 220, 160], [980, 490, 220, 160], [400, 710, 220, 160]], door: [740, 120], doorColor: "#2b2e2f", tree: 1500 });

/* ---------- roofs ---------- */
function roofScene(o) {
  const R = rng(o.seed);
  let defs = lin("sky", [[0, "#bfcacd"], [1, "#eceee9"]]) + blur("b30", 30) + blur("b4", 4) + lin("rf", [[0, o.tile[1]], [1, o.tile[0]]]);
  let body = `<rect width="${W}" height="${H}" fill="url(#sky)"/>`;
  let trees = "";
  for (let i = 0; i < 20; i++) trees += `<ellipse cx="${f(R() * W)}" cy="${f(380 + R() * 140)}" rx="${f(90 + R() * 120)}" ry="${f(70 + R() * 60)}" fill="${["#8e9a86", "#7d8a76"][i % 2]}"/>`;
  body += `<g filter="url(#b30)">${trees}</g>`;
  const ridge = 330, eave = 1260, lx0 = -200, lx1 = W + 200, rx0 = 180, rx1 = W - 140;
  const plane = [[rx0, ridge], [rx1, ridge], [lx1, eave], [lx0, eave]];
  body += poly(plane, "url(#rf)");
  // courses: spacing grows towards the viewer
  let y = ridge, k = 0, rows = "";
  while (y < eave) {
    const h = 26 + k * 7, t = (y - ridge) / (eave - ridge), xl = rx0 + (lx0 - rx0) * t, xr = rx1 + (lx1 - rx1) * t, w = 60 + k * 14;
    rows += `<rect x="${f(xl)}" y="${f(y + h - 5)}" width="${f(xr - xl)}" height="${f(4 + k * 0.6)}" fill="#000" opacity=".28"/>`;
    for (let x = xl + ((k % 2) * w) / 2; x < xr; x += w) rows += `<rect x="${f(x)}" y="${f(y)}" width="2.5" height="${f(h)}" fill="#000" opacity=".18"/>${R() < 0.3 ? `<rect x="${f(x + 3)}" y="${f(y)}" width="${f(w - 4)}" height="${f(h - 5)}" fill="#fff" opacity=".05"/>` : ""}`;
    y += h; k++;
  }
  body += `<clipPath id="pc"><polygon points="${pts(plane)}"/></clipPath><g clip-path="url(#pc)">${rows}</g>`;
  body += `<rect x="${rx0 - 20}" y="${ridge - 30}" width="${rx1 - rx0 + 40}" height="34" fill="${o.ridge}"/><rect x="${rx0 - 20}" y="${ridge - 30}" width="${rx1 - rx0 + 40}" height="8" fill="#fff" opacity=".2"/>`;
  defs += lin("sun", [[0, "#fff", 0.16], [1, "#fff", 0]], 0, 0, 1, 0.6);
  body += poly(plane, "url(#sun)");
  return finish(body, defs, { seed: o.seed, warmth: 0.06, vignette: 0.26 });
}
scenes["roof-1"] = () => roofScene({ seed: 91, tile: ["#4a4f52", "#5f6467"], ridge: "#8d9092" });
scenes["roof-2"] = () => roofScene({ seed: 93, tile: ["#3c4146", "#545a60"], ridge: "#3a3e42" });

/* ---------- gardens ---------- */
function garden(o) {
  const R = rng(o.seed);
  let defs = lin("sky", [[0, "#c8d0cf"], [1, "#eef0ea"]]) + blur("b30", 30) + blur("b3", 2.5) + blur("b8", 8) + lin("gr", [[0, "#cfc8ba"], [1, "#b5ad9d"]]);
  let body = `<rect width="${W}" height="${H}" fill="url(#sky)"/>`;
  let trees = "";
  for (let i = 0; i < 26; i++) trees += `<ellipse cx="${f(R() * W)}" cy="${f(180 + R() * 220)}" rx="${f(100 + R() * 130)}" ry="${f(80 + R() * 80)}" fill="${["#6f8164", "#5d7154", "#83957a"][i % 3]}"/>`;
  body += `<g filter="url(#b30)">${trees}</g>`;
  const top = 300, bottom = 880;
  if (o.driveway) {
    body += `<rect x="0" y="420" width="${W}" height="${bottom - 420}" fill="#e8e4dc"/><rect x="560" y="520" width="520" height="${bottom - 520}" fill="#4a4d4c"/>`;
    for (let x = 568; x < 1080; x += 26) body += `<rect x="${x}" y="526" width="18" height="${bottom - 526}" fill="#5a5e5c"/>`;
  }
  // slatted fence
  const fx0 = o.driveway ? 0 : 0, fx1 = o.driveway ? 520 : W;
  for (let y = top + (o.driveway ? 220 : 0); y < bottom; y += 46) {
    const c = ["#9c7a57", "#a8865f", "#8f6f4f", "#a17e5a"][Math.floor(R() * 4)];
    body += `<rect x="${fx0}" y="${y}" width="${fx1 - fx0}" height="38" fill="${c}"/><rect x="${fx0}" y="${y}" width="${fx1 - fx0}" height="5" fill="#fff" opacity=".12"/>`;
  }
  for (let x = fx0 + 60; x < fx1; x += 300) body += `<rect x="${x}" y="${top + (o.driveway ? 220 : 0)}" width="16" height="${bottom - top}" fill="#5b5f5d"/>`;
  // concrete / gravel
  body += `<rect x="0" y="${bottom}" width="${W}" height="${H - bottom}" fill="url(#gr)"/>`;
  if (o.driveway) {
    const P = (x, y) => [800 + (x - 800) * y, bottom + (H - bottom) * (y - 1) / 2.4];
    body += poly([[340, bottom], [1260, bottom], [1700, H], [-100, H]], "#c9c6bf");
    for (const x of [600, 800, 1000]) body += `<line x1="${x}" y1="${bottom}" x2="${f(800 + (x - 800) * 2.4)}" y2="${H}" stroke="#000" stroke-opacity=".1" stroke-width="3"/>`;
    for (const yy of [960, 1070]) body += `<line x1="0" y1="${yy}" x2="${W}" y2="${yy}" stroke="#000" stroke-opacity=".08" stroke-width="3"/>`;
    void P;
  } else {
    let grav = "";
    for (let i = 0; i < 900; i++) grav += `<circle cx="${f(R() * W)}" cy="${f(bottom + R() * (H - bottom))}" r="${f(1 + R() * 2.5)}" fill="${R() < 0.5 ? "#a39b8b" : "#ded8cc"}"/>`;
    body += grav;
  }
  // plants in front of the fence
  let pl = "";
  for (let i = 0; i < 14; i++) {
    const cx = (o.driveway ? 40 + R() * 460 : R() * W), cy = bottom - 10 + R() * 40;
    for (let j = 0; j < 22; j++) {
      const a = -90 + (R() - 0.5) * 70, len = 90 + R() * 150;
      pl += `<path d="M${f(cx)} ${f(cy)} Q ${f(cx + Math.cos((a * Math.PI) / 180) * len * 0.5 + 10)} ${f(cy - len * 0.6)} ${f(cx + Math.cos((a * Math.PI) / 180) * len)} ${f(cy + Math.sin((a * Math.PI) / 180) * len)}" stroke="${["#6f8a54", "#8aa06a", "#57703f"][j % 3]}" stroke-width="3" fill="none"/>`;
    }
    pl += `<ellipse cx="${f(cx)}" cy="${f(cy - 20)}" rx="${f(60 + R() * 30)}" ry="${f(40 + R() * 20)}" fill="${["#4d6640", "#5e7a4c"][i % 2]}" opacity=".85"/>`;
  }
  body += `<g filter="url(#b3)">${pl}</g>`;
  return finish(body, defs, { seed: o.seed, warmth: 0.07, vignette: 0.24 });
}
scenes["garden-1"] = () => garden({ seed: 101 });
scenes["garden-2"] = () => garden({ seed: 103, driveway: true });

/* ---------- render ---------- */
const only = process.argv.slice(2);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: W, height: H } });
for (const [name, make] of Object.entries(scenes)) {
  if (only.length && !only.includes(name)) continue;
  await page.setContent(`<html><body style="margin:0">${make()}</body></html>`);
  writeFileSync(new URL(`${name}.jpg`, out), await page.screenshot({ type: "jpeg", quality: 82, clip: { x: 0, y: 0, width: W, height: H } }));
  console.log(name);
}
await browser.close();
