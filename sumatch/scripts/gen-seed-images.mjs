// Generates calm, material-style placeholder images for demo data (public/seed/*.svg).
// Deliberately NOT fake houses: close-ups of surfaces (plaster, siding, slate, tile, wood),
// so nothing pretends to be a real photo. Real companies replace these with their own work photos.
// Run: node scripts/gen-seed-images.mjs
import { mkdirSync, writeFileSync } from "node:fs";

const out = new URL("../public/seed/", import.meta.url);
mkdirSync(out, { recursive: true });

const W = 1200, H = 900;
const grain = (id, freq, opacity, seed = 3) => `
  <filter id="${id}" x="0" y="0" width="100%" height="100%">
    <feTurbulence type="fractalNoise" baseFrequency="${freq}" numOctaves="3" seed="${seed}" result="n"/>
    <feColorMatrix type="saturate" values="0"/>
    <feComponentTransfer><feFuncA type="linear" slope="${opacity}"/></feComponentTransfer>
  </filter>`;

const svg = (defs, body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"><defs>${defs}</defs>${body}</svg>\n`;

/** Plaster / mortar wall, optional hairline crack and a strip of masking tape. */
function plaster({ base, crack = false, tape = false, seed = 2 }) {
  return svg(
    grain("g", 0.9, 0.35, seed) + grain("g2", 0.012, 0.25, seed + 5),
    `<rect width="${W}" height="${H}" fill="${base}"/>
     <rect width="${W}" height="${H}" filter="url(#g2)"/>
     <rect width="${W}" height="${H}" filter="url(#g)"/>
     ${crack ? `<path d="M420 0 L452 160 L430 300 L488 470 L460 640 L506 900" stroke="#5f574c" stroke-width="3" fill="none" opacity=".55"/><path d="M452 160 L560 214" stroke="#5f574c" stroke-width="2" fill="none" opacity=".45"/>` : ""}
     ${tape ? `<rect x="0" y="690" width="${W}" height="70" fill="#d9cfa4" opacity=".92"/><rect x="0" y="690" width="${W}" height="70" filter="url(#g)" opacity=".5"/>` : ""}`,
  );
}

/** Horizontal lap siding, half freshly painted. */
function siding({ old, fresh, split = 0.55, seed = 4 }) {
  let boards = "";
  for (let y = 0; y < H; y += 90) {
    boards += `<rect x="0" y="${y}" width="${W}" height="88" fill="${old}"/><rect x="0" y="${y + 84}" width="${W}" height="6" fill="#000" opacity=".12"/>`;
  }
  const x = Math.round(W * split);
  let freshBoards = "";
  for (let y = 0; y < H; y += 90) freshBoards += `<rect x="${x}" y="${y}" width="${W - x}" height="88" fill="${fresh}"/><rect x="${x}" y="${y + 84}" width="${W - x}" height="6" fill="#000" opacity=".1"/>`;
  return svg(grain("g", 0.8, 0.28, seed), `${boards}${freshBoards}<rect width="${W}" height="${H}" filter="url(#g)"/><rect x="${x - 2}" y="0" width="4" height="${H}" fill="#000" opacity=".08"/>`);
}

/** Roof slate / tile courses. */
function slate({ base, alt, seed = 6 }) {
  let tiles = "";
  for (let r = 0, y = -20; y < H; r++, y += 110) {
    for (let x = r % 2 ? -110 : 0; x < W; x += 220) {
      tiles += `<rect x="${x + 3}" y="${y}" width="214" height="128" rx="4" fill="${(x / 220 + r) % 3 ? base : alt}"/>`;
    }
    tiles += `<rect x="0" y="${y + 104}" width="${W}" height="8" fill="#000" opacity=".22"/>`;
  }
  return svg(grain("g", 0.7, 0.3, seed), `<rect width="${W}" height="${H}" fill="${base}"/>${tiles}<rect width="${W}" height="${H}" filter="url(#g)"/>`);
}

/** Square ceramic tile with grout. */
function tile({ base, grout, size = 150, seed = 8 }) {
  let t = "";
  for (let y = 0; y < H; y += size) for (let x = 0; x < W; x += size) t += `<rect x="${x + 3}" y="${y + 3}" width="${size - 6}" height="${size - 6}" rx="3" fill="${base}"/>`;
  return svg(grain("g", 0.9, 0.18, seed) + `<linearGradient id="sheen" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".18"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/></linearGradient>`,
    `<rect width="${W}" height="${H}" fill="${grout}"/>${t}<rect width="${W}" height="${H}" fill="url(#sheen)"/><rect width="${W}" height="${H}" filter="url(#g)"/>`);
}

/** Wood flooring planks. */
function wood({ tones, seed = 10 }) {
  let p = "";
  let i = 0;
  for (let x = 0; x < W; x += 150) {
    const offset = (i * 97) % 600;
    for (let y = -offset; y < H; y += 600) {
      p += `<rect x="${x}" y="${y}" width="148" height="596" fill="${tones[i % tones.length]}"/>`;
    }
    i++;
  }
  return svg(
    `<filter id="w"><feTurbulence type="fractalNoise" baseFrequency="0.004 0.18" numOctaves="2" seed="${seed}"/><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncA type="linear" slope=".35"/></feComponentTransfer></filter>`,
    `<rect width="${W}" height="${H}" fill="${tones[0]}"/>${p}<rect width="${W}" height="${H}" filter="url(#w)"/>`,
  );
}

/** Concrete / paving. */
function concrete({ base, joints = true, seed = 12 }) {
  return svg(
    grain("g", 0.6, 0.4, seed) + grain("g2", 0.02, 0.25, seed + 1),
    `<rect width="${W}" height="${H}" fill="${base}"/><rect width="${W}" height="${H}" filter="url(#g2)"/><rect width="${W}" height="${H}" filter="url(#g)"/>
     ${joints ? `<path d="M0 450 H${W} M600 0 V${H}" stroke="#000" stroke-width="5" opacity=".18"/>` : ""}`,
  );
}

/** Paint colour swatches on a board — what you look at when choosing a colour. */
function swatches({ colors, seed = 14 }) {
  const cells = colors.map((c, i) => `<rect x="${120 + (i % 3) * 330}" y="${150 + Math.floor(i / 3) * 330}" width="290" height="290" rx="6" fill="${c}"/>`).join("");
  return svg(grain("g", 0.85, 0.22, seed), `<rect width="${W}" height="${H}" fill="#ece8df"/>${cells}<rect width="${W}" height="${H}" filter="url(#g)"/>`);
}

/** Matte appliance surface with a single vent line (aircon). */
function appliance({ base, seed = 16 }) {
  let vents = "";
  for (let y = 560; y < 700; y += 18) vents += `<rect x="160" y="${y}" width="${W - 320}" height="6" rx="3" fill="#000" opacity=".1"/>`;
  return svg(grain("g", 0.9, 0.14, seed), `<rect width="${W}" height="${H}" fill="#e7e3da"/><rect x="120" y="260" width="${W - 240}" height="460" rx="18" fill="${base}"/>${vents}<rect width="${W}" height="${H}" filter="url(#g)"/>`);
}

const files = {
  "exterior-1.svg": siding({ old: "#b9b2a4", fresh: "#e8e4da", split: 0.5 }),
  "exterior-2.svg": plaster({ base: "#d8d0c2", tape: true }),
  "exterior-3.svg": siding({ old: "#8d8b84", fresh: "#3f4a45", split: 0.62, seed: 5 }),
  "exterior-4.svg": plaster({ base: "#e6e0d4", seed: 9 }),
  "exterior-5.svg": siding({ old: "#cfc8bb", fresh: "#2f3330", split: 0.4, seed: 7 }),
  "wall-crack.svg": plaster({ base: "#d6cdbd", crack: true, seed: 11 }),
  "roof-1.svg": slate({ base: "#3b3d3c", alt: "#444745" }),
  "roof-2.svg": slate({ base: "#6a5c52", alt: "#73655a", seed: 13 }),
  "bath-1.svg": tile({ base: "#e9ece9", grout: "#c9cdc9" }),
  "bath-2.svg": tile({ base: "#efe9df", grout: "#cfc6b8", size: 112, seed: 15 }),
  "kitchen-1.svg": concrete({ base: "#9a9790", joints: false }),
  "kitchen-2.svg": wood({ tones: ["#b89a78", "#ad8f6d", "#c3a684"], seed: 17 }),
  "interior-1.svg": wood({ tones: ["#c7ab86", "#bd9f7a", "#d0b591"] }),
  "interior-2.svg": plaster({ base: "#ece7dd", seed: 19 }),
  "garden-1.svg": concrete({ base: "#b8b3a8" }),
  "garden-2.svg": wood({ tones: ["#6f5a46", "#7a6550", "#655140"], seed: 21 }),
  "aircon-1.svg": appliance({ base: "#f4f2ed" }),
  "clean-1.svg": tile({ base: "#f3f3f1", grout: "#dcdcd8", size: 200, seed: 23 }),
  "swatches.svg": swatches({ colors: ["#e8e4da", "#cfc8bb", "#8d8b84", "#3f4a45", "#2f3330", "#b9b2a4"] }),
};

for (const [name, s] of Object.entries(files)) writeFileSync(new URL(name, out), s);
console.log(`wrote ${Object.keys(files).length} images`);
