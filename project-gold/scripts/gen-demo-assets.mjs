// デモ用プロフィール画像（権利上安全な自作の抽象イラスト）を生成する。
// 実在人物の写真は使用しない。出力: supabase/seed-assets/demo/*.svg
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'supabase', 'seed-assets', 'demo');
mkdirSync(out, { recursive: true });

const palettes = [
  ['#F3EDE2', '#E4D6BC', '#C9B28A', '#8A6A35'],
  ['#F1ECEA', '#E2D3CF', '#BFA3A0', '#7D5F5B'],
  ['#EEF0EA', '#D9DDCF', '#AEB59D', '#66704F'],
  ['#ECEEF2', '#D5DAE3', '#A7B0C2', '#59637A'],
  ['#F4EFE6', '#EADBC2', '#D5B98C', '#9B7841'],
  ['#F0EDF2', '#DDD5E2', '#B5A6C0', '#6C5A7A'],
];

function rand(seed) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

function portrait(seed, [bg1, bg2, mid, deep], variant) {
  const r = rand(seed);
  const bokeh = Array.from({ length: 7 }, () =>
    `<circle cx="${(r() * 800).toFixed(0)}" cy="${(r() * 600).toFixed(0)}" r="${(30 + r() * 110).toFixed(0)}" fill="#FFFFFF" opacity="${(0.12 + r() * 0.25).toFixed(2)}"/>`
  ).join('');
  const tilt = (r() - 0.5) * 30;
  const headY = 380 + variant * 18;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 1000" width="800" height="1000">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0.4" y2="1"><stop offset="0" stop-color="${bg1}"/><stop offset="1" stop-color="${bg2}"/></linearGradient>
    <linearGradient id="fig" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${mid}"/><stop offset="1" stop-color="${deep}"/></linearGradient>
    <linearGradient id="gold" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#D7BE88"/><stop offset="1" stop-color="#B89B5E"/></linearGradient>
  </defs>
  <rect width="800" height="1000" fill="url(#bg)"/>
  ${bokeh}
  <g transform="rotate(${tilt.toFixed(1)} 400 ${headY})" opacity="0.92">
    <path d="M400 ${headY - 175} C ${470 + variant * 10} ${headY - 180}, 520 ${headY - 90}, 515 ${headY + 10} C 512 ${headY + 120}, 470 ${headY + 170}, 400 ${headY + 175} C 330 ${headY + 170}, 288 ${headY + 120}, 285 ${headY + 10} C 280 ${headY - 90}, ${330 - variant * 10} ${headY - 180}, 400 ${headY - 175} Z" fill="url(#fig)" opacity="0.55"/>
    <ellipse cx="400" cy="${headY}" rx="98" ry="122" fill="url(#fig)" opacity="0.85"/>
  </g>
  <path d="M150 1000 C 170 ${headY + 260}, 290 ${headY + 190}, 400 ${headY + 190} C 510 ${headY + 190}, 630 ${headY + 260}, 650 1000 Z" fill="url(#fig)" opacity="0.9"/>
  <path d="M90 ${180 + variant * 40} A 330 330 0 0 1 ${700 - variant * 30} ${120 + variant * 30}" stroke="url(#gold)" stroke-width="2" fill="none" opacity="0.8"/>
  <text x="760" y="960" text-anchor="end" font-family="Helvetica, Arial, sans-serif" font-size="22" letter-spacing="4" fill="#FFFFFF" opacity="0.75">DEMO</text>
</svg>`;
}

let n = 0;
for (let w = 1; w <= 6; w++) {
  for (let i = 1; i <= 3; i++) {
    writeFileSync(join(out, `w${w}-${i}.svg`), portrait(w * 97 + i * 13, palettes[w - 1], i - 1));
    n++;
  }
}
const menPalette = [['#EEEEEC', '#D8D6D0', '#A9A59B', '#4F4B44'], ['#ECEDEF', '#D3D6DB', '#9EA4AE', '#454B55']];
for (let m = 1; m <= 2; m++) {
  writeFileSync(join(out, `m${m}-1.svg`), portrait(m * 311, menPalette[m - 1], 1));
  n++;
}
console.log(`generated ${n} demo images in ${out}`);
