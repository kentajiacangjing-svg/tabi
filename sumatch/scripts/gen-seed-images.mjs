// Generates the calm, flat illustrations used as demo photos (public/seed/*.svg).
// Run: node scripts/gen-seed-images.mjs
import { mkdirSync, writeFileSync } from "node:fs";

const out = new URL("../public/seed/", import.meta.url);
mkdirSync(out, { recursive: true });

const W = 800, H = 600;
const wrap = (bg, body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="${bg}"/>${body}</svg>\n`;

function exterior({ sky, wall, roof, trim, ground, scaffold = false, sun = true }) {
  return wrap(
    sky,
    `${sun ? `<circle cx="660" cy="110" r="46" fill="#fff" opacity=".55"/>` : ""}
<rect y="470" width="800" height="130" fill="${ground}"/>
<rect x="190" y="250" width="420" height="230" fill="${wall}"/>
<polygon points="160,262 400,120 640,262" fill="${roof}"/>
<rect x="230" y="300" width="90" height="70" rx="4" fill="${trim}"/><rect x="480" y="300" width="90" height="70" rx="4" fill="${trim}"/>
<rect x="365" y="370" width="70" height="110" rx="4" fill="${roof}" opacity=".85"/>
<rect x="230" y="300" width="90" height="70" rx="4" fill="none" stroke="#fff" stroke-width="6" opacity=".6"/>
<rect x="480" y="300" width="90" height="70" rx="4" fill="none" stroke="#fff" stroke-width="6" opacity=".6"/>
${
  scaffold
    ? `<g stroke="#9AA3B2" stroke-width="6" opacity=".9">${[170, 290, 410, 530, 630].map((x) => `<line x1="${x}" y1="200" x2="${x}" y2="480"/>`).join("")}${[260, 340, 420].map((y) => `<line x1="160" y1="${y}" x2="640" y2="${y}"/>`).join("")}</g><rect x="150" y="190" width="500" height="290" fill="#E9EEF7" opacity=".35"/>`
    : ""
}`,
  );
}

function roofTiles({ bg, tile, line }) {
  let rows = "";
  for (let r = 0; r < 9; r++) {
    for (let c = -1; c < 11; c++) {
      const x = c * 80 + (r % 2 ? 40 : 0);
      rows += `<rect x="${x}" y="${r * 70 - 20}" width="76" height="66" rx="8" fill="${tile}" opacity="${0.75 + ((r * 7 + c * 3) % 5) * 0.05}"/>`;
    }
    rows += `<line x1="0" x2="800" y1="${r * 70 + 46}" y2="${r * 70 + 46}" stroke="${line}" stroke-width="4"/>`;
  }
  return wrap(bg, rows);
}

function bath({ wall, tub, floor }) {
  let tiles = "";
  for (let y = 0; y < 360; y += 60) for (let x = 0; x < 800; x += 60) tiles += `<rect x="${x + 2}" y="${y + 2}" width="56" height="56" fill="#fff" opacity=".35"/>`;
  return wrap(
    wall,
    `${tiles}<rect y="360" width="800" height="240" fill="${floor}"/>
<rect x="120" y="300" width="460" height="170" rx="40" fill="${tub}"/><rect x="140" y="300" width="420" height="40" rx="20" fill="#fff" opacity=".6"/>
<rect x="640" y="140" width="16" height="200" rx="8" fill="#B8C0CC"/><circle cx="648" cy="130" r="26" fill="#C9D0DA"/>`,
  );
}

function kitchen({ wall, cabinet, top }) {
  return wrap(
    wall,
    `<rect x="80" y="110" width="640" height="120" rx="10" fill="${cabinet}" opacity=".9"/>
<rect y="330" width="800" height="270" fill="${cabinet}"/><rect y="320" width="800" height="22" fill="${top}"/>
${[0, 1, 2, 3].map((i) => `<rect x="${60 + i * 180}" y="370" width="160" height="200" rx="8" fill="#fff" opacity=".22"/>`).join("")}
<rect x="430" y="250" width="12" height="72" fill="#9AA3B2"/><path d="M436 250 q0 -36 40 -36" stroke="#9AA3B2" stroke-width="12" fill="none"/>`,
  );
}

function interior({ wall, floor, sofa, accent }) {
  let planks = "";
  for (let x = 0; x < 800; x += 100) planks += `<line x1="${x}" y1="420" x2="${x - 40}" y2="600" stroke="#000" opacity=".06" stroke-width="3"/>`;
  return wrap(
    wall,
    `<rect y="420" width="800" height="180" fill="${floor}"/>${planks}
<rect x="470" y="90" width="230" height="230" rx="6" fill="#fff" opacity=".7"/><line x1="585" y1="90" x2="585" y2="320" stroke="${wall}" stroke-width="8"/>
<rect x="90" y="330" width="320" height="110" rx="26" fill="${sofa}"/><rect x="110" y="290" width="280" height="70" rx="22" fill="${sofa}" opacity=".85"/>
<circle cx="640" cy="440" r="34" fill="${accent}"/><rect x="636" y="440" width="8" height="70" fill="${accent}"/>`,
  );
}

function garden({ sky, grass, fence, path }) {
  let slats = "";
  for (let x = 20; x < 800; x += 46) slats += `<rect x="${x}" y="230" width="34" height="170" rx="4" fill="${fence}"/>`;
  return wrap(
    sky,
    `<rect y="380" width="800" height="220" fill="${grass}"/>${slats}<rect x="0" y="270" width="800" height="12" fill="${fence}" opacity=".7"/>
<polygon points="340,600 460,600 430,390 370,390" fill="${path}"/>
<circle cx="140" cy="380" r="60" fill="#5E8C61"/><circle cx="660" cy="370" r="72" fill="#6E9C70"/><circle cx="210" cy="400" r="40" fill="#7FAE80"/>`,
  );
}

function aircon({ wall, unit }) {
  return wrap(
    wall,
    `<rect x="170" y="150" width="460" height="150" rx="26" fill="${unit}"/><rect x="200" y="250" width="400" height="14" rx="7" fill="#000" opacity=".08"/>
<circle cx="580" cy="190" r="6" fill="#7BC6A4"/>
${[0, 1, 2].map((i) => `<path d="M${280 + i * 120} 330 q20 40 0 80 q-20 40 0 80" stroke="#9EC1F0" stroke-width="8" fill="none" opacity=".7"/>`).join("")}`,
  );
}

function cleaning({ wall, floor }) {
  const sparkle = (x, y, s) => `<path d="M${x} ${y - s} L${x + s / 4} ${y - s / 4} L${x + s} ${y} L${x + s / 4} ${y + s / 4} L${x} ${y + s} L${x - s / 4} ${y + s / 4} L${x - s} ${y} L${x - s / 4} ${y - s / 4} Z" fill="#fff"/>`;
  return wrap(
    wall,
    `<rect y="380" width="800" height="220" fill="${floor}"/><rect x="120" y="120" width="300" height="220" rx="6" fill="#fff" opacity=".8"/>
${sparkle(520, 200, 40)}${sparkle(600, 280, 24)}${sparkle(470, 470, 30)}${sparkle(680, 430, 20)}`,
  );
}

const files = {
  "exterior-1.svg": exterior({ sky: "#DCE7F5", wall: "#F4EFE6", roof: "#3E4A5C", trim: "#9DB4D3", ground: "#C9D6C3" }),
  "exterior-2.svg": exterior({ sky: "#E4EBF2", wall: "#E2E7EE", roof: "#5B4B44", trim: "#B7C7D9", ground: "#CFD8C6" }),
  "exterior-3.svg": exterior({ sky: "#E7EEF6", wall: "#D9CFC2", roof: "#2F3B4C", trim: "#AFC2D6", ground: "#C3D1BD", scaffold: true }),
  "exterior-4.svg": exterior({ sky: "#DFE9F3", wall: "#FAF8F4", roof: "#40566E", trim: "#C5D3E2", ground: "#D2DCCB", sun: false }),
  "exterior-5.svg": exterior({ sky: "#E9EEF3", wall: "#CBD5DF", roof: "#363C45", trim: "#EEF2F6", ground: "#C8D3C1" }),
  "wall-crack.svg": wrap("#E8E1D6", `<path d="M300 60 L330 180 L300 260 L360 380 L330 470 L370 560" stroke="#8A7F72" stroke-width="7" fill="none"/><path d="M330 180 L410 230" stroke="#8A7F72" stroke-width="5" fill="none"/><circle cx="560" cy="160" r="70" fill="#5E7F5E" opacity=".25"/><circle cx="610" cy="200" r="40" fill="#5E7F5E" opacity=".25"/>`),
  "roof-1.svg": roofTiles({ bg: "#3B4452", tile: "#4E5868", line: "#2E3540" }),
  "roof-2.svg": roofTiles({ bg: "#5A4A42", tile: "#6E5B51", line: "#463A33" }),
  "bath-1.svg": bath({ wall: "#DDE6EE", tub: "#F7F9FB", floor: "#B9C3CF" }),
  "bath-2.svg": bath({ wall: "#E9E4DC", tub: "#FFFFFF", floor: "#C8BFB2" }),
  "kitchen-1.svg": kitchen({ wall: "#EFF2F5", cabinet: "#55606E", top: "#D9DDE2" }),
  "kitchen-2.svg": kitchen({ wall: "#F4F1EC", cabinet: "#A88F75", top: "#EDE7DF" }),
  "interior-1.svg": interior({ wall: "#EEF1F4", floor: "#C8AE8E", sofa: "#6F7F95", accent: "#7FA27F" }),
  "interior-2.svg": interior({ wall: "#F3EFE9", floor: "#B79C7E", sofa: "#C5B8A6", accent: "#5F8A6B" }),
  "garden-1.svg": garden({ sky: "#E3ECF4", grass: "#A9C4A0", fence: "#8C735E", path: "#D8D1C4" }),
  "garden-2.svg": garden({ sky: "#E8EEF3", grass: "#B6CCAA", fence: "#5D6672", path: "#E2DCD0" }),
  "aircon-1.svg": aircon({ wall: "#EEF1F5", unit: "#FFFFFF" }),
  "clean-1.svg": cleaning({ wall: "#E6EEF6", floor: "#CBB59A" }),
};

for (const [name, svg] of Object.entries(files)) writeFileSync(new URL(name, out), svg);
console.log(`wrote ${Object.keys(files).length} images`);
