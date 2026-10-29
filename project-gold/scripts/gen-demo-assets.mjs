// デモ用プロフィール画像を生成する（権利上安全な自作イラスト）。
// 実在人物の写真や人物シルエットは使わず、「写真の代わりのデモ画像」であることが分かる上品なイラストにする。
//   1枚目: モノグラム（頭文字）  2枚目: ラウンジの静物（グラス・キャンドル）  3枚目: 花のスケッチ
// 出力: supabase/seed-assets/demo/*.svg
// supabase/seed-assets/photos/<名前>.jpg がある場合は、その画像（実在人物ではない AI 生成のデモ写真）を
// 「DEMO・AI生成」表記付きで SVG に埋め込み、同名のイラストを置き換える。
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'supabase', 'seed-assets', 'demo');
mkdirSync(out, { recursive: true });

// [背景上, 背景下, 線の色, 名前]
const women = [
  ['#F6EFE3', '#E8D9BE', '#9A7638', 'MISAKI'],
  ['#F5ECEA', '#E6D2CD', '#8E6158', 'RENA'],
  ['#F0F1EA', '#DADFCF', '#66724F', 'SAKURA'],
  ['#EEF0F3', '#D6DCE5', '#56627A', 'HINANO'],
  ['#F7F0E6', '#EDDCC2', '#97733B', 'YUI'],
  ['#F2EEF3', '#DED4E3', '#6E5B7C', 'AKARI'],
];
const men = [['#F1F0EC', '#DCD9D1', '#5B564C', 'TARO'], ['#EFF0F2', '#D6D9DE', '#4C535E', 'KENICHI']];

const SERIF = "Cormorant Garamond, 'Times New Roman', Georgia, serif";
const SANS = 'Helvetica, Arial, sans-serif';

function frame(bg1, bg2, ink, body, seed) {
  let s = seed;
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const glow = Array.from({ length: 6 }, () =>
    `<circle cx="${(80 + r() * 640).toFixed(0)}" cy="${(80 + r() * 520).toFixed(0)}" r="${(40 + r() * 120).toFixed(0)}" fill="#FFFFFF" opacity="${(0.10 + r() * 0.18).toFixed(2)}"/>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 1000" width="800" height="1000">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0.35" y2="1"><stop offset="0" stop-color="${bg1}"/><stop offset="1" stop-color="${bg2}"/></linearGradient>
    <linearGradient id="gold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#E2CFA6"/><stop offset="1" stop-color="#B99755"/></linearGradient>
  </defs>
  <rect width="800" height="1000" fill="url(#bg)"/>
  ${glow}
  <rect x="36" y="36" width="728" height="928" fill="none" stroke="url(#gold)" stroke-width="1.5" opacity="0.8"/>
  <rect x="48" y="48" width="704" height="904" fill="none" stroke="url(#gold)" stroke-width="0.8" opacity="0.5"/>
  ${body(ink)}
  <text x="400" y="918" text-anchor="middle" font-family="${SANS}" font-size="20" letter-spacing="6" fill="${ink}" opacity="0.55">DEMO IMAGE</text>
</svg>`;
}

const monogram = (name) => (ink) => `
  <path d="M400 190 C 560 190 640 330 640 470 C 640 640 540 760 400 760 C 260 760 160 640 160 470 C 160 330 240 190 400 190 Z" fill="#FFFFFF" opacity="0.35"/>
  <text x="400" y="590" text-anchor="middle" font-family="${SERIF}" font-size="330" fill="${ink}" opacity="0.88">${name[0]}</text>
  <line x1="320" y1="660" x2="480" y2="660" stroke="url(#gold)" stroke-width="2"/>
  <text x="400" y="712" text-anchor="middle" font-family="${SERIF}" font-size="40" letter-spacing="14" fill="${ink}">${name}</text>`;

const lounge = () => (ink) => `
  <path d="M250 820 L250 330 A150 150 0 0 1 550 330 L550 820" fill="#FFFFFF" opacity="0.32" stroke="url(#gold)" stroke-width="1.5"/>
  <line x1="170" y1="820" x2="630" y2="820" stroke="${ink}" stroke-width="2" opacity="0.6"/>
  <g stroke="${ink}" stroke-width="3" fill="none" stroke-linecap="round" opacity="0.85">
    <path d="M330 560 Q 330 620 380 628 Q 430 620 430 560 Z"/>
    <line x1="380" y1="628" x2="380" y2="760"/><line x1="345" y1="764" x2="415" y2="764"/>
    <path d="M440 590 Q 440 640 478 646 Q 516 640 516 590 Z"/>
    <line x1="478" y1="646" x2="478" y2="764"/><line x1="450" y1="768" x2="506" y2="768"/>
    <rect x="252" y="660" width="40" height="160" rx="6"/>
    <path d="M272 650 Q 262 630 272 610 Q 282 630 272 650 Z" fill="#E2CFA6"/>
  </g>
  <circle cx="356" cy="586" r="5" fill="#E2CFA6"/><circle cx="372" cy="574" r="4" fill="#E2CFA6"/><circle cx="392" cy="590" r="3.5" fill="#E2CFA6"/>
  <text x="400" y="230" text-anchor="middle" font-family="${SERIF}" font-size="34" letter-spacing="10" fill="${ink}" opacity="0.7">LOUNGE</text>`;

const floral = () => (ink) => `
  <g stroke="${ink}" stroke-width="3" fill="none" stroke-linecap="round" opacity="0.85">
    <path d="M330 820 Q 320 700 360 640 L440 640 Q 480 700 470 820 Z" fill="#FFFFFF" fill-opacity="0.35"/>
    <path d="M400 640 Q 395 520 380 420"/><path d="M400 640 Q 430 520 480 450"/><path d="M400 640 Q 350 540 300 480"/>
    <path d="M380 420 m -34 0 a 34 34 0 1 0 68 0 a 34 34 0 1 0 -68 0"/>
    <path d="M480 450 m -28 0 a 28 28 0 1 0 56 0 a 28 28 0 1 0 -56 0"/>
    <path d="M300 480 m -24 0 a 24 24 0 1 0 48 0 a 24 24 0 1 0 -48 0"/>
    <path d="M420 540 Q 460 520 470 540 Q 450 560 420 540 Z"/><path d="M370 560 Q 330 540 320 560 Q 340 580 370 560 Z"/>
  </g>
  <circle cx="380" cy="420" r="9" fill="#E2CFA6"/><circle cx="480" cy="450" r="7" fill="#E2CFA6"/><circle cx="300" cy="480" r="6" fill="#E2CFA6"/>
  <text x="400" y="230" text-anchor="middle" font-family="${SERIF}" font-size="34" letter-spacing="10" fill="${ink}" opacity="0.7">FLEUR</text>`;

let n = 0;
women.forEach(([a, b, ink, name], i) => {
  const w = i + 1;
  writeFileSync(join(out, `w${w}-1.svg`), frame(a, b, ink, monogram(name), w * 97 + 13));
  writeFileSync(join(out, `w${w}-2.svg`), frame(a, b, ink, lounge(), w * 97 + 29));
  writeFileSync(join(out, `w${w}-3.svg`), frame(a, b, ink, floral(), w * 97 + 41));
  n += 3;
});
men.forEach(([a, b, ink, name], i) => {
  writeFileSync(join(out, `m${i + 1}-1.svg`), frame(a, b, ink, monogram(name), (i + 1) * 311));
  n++;
});

// AI 生成のデモ写真で置き換え（SVG に埋め込むので、配信・シードの仕組みはイラストと同じまま使える）
const photos = join(dirname(fileURLToPath(import.meta.url)), '..', 'supabase', 'seed-assets', 'photos');
let p = 0;
if (existsSync(photos)) {
  for (const f of readdirSync(photos).filter((x) => x.endsWith('.jpg'))) {
    const b64 = readFileSync(join(photos, f)).toString('base64');
    writeFileSync(join(out, f.replace(/\.jpg$/, '.svg')), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 1000" width="800" height="1000">
  <image width="800" height="1000" preserveAspectRatio="xMidYMid slice" href="data:image/jpeg;base64,${b64}"/>
  <rect x="608" y="944" width="172" height="36" rx="18" fill="#000000" opacity="0.38"/>
  <text x="694" y="968" text-anchor="middle" font-family="${SANS}" font-size="17" letter-spacing="2" fill="#FFFFFF">DEMO・AI生成</text>
</svg>`);
    p++;
  }
}
console.log(`generated ${n} demo images (${p} replaced with AI-generated demo photos) in ${out}`);
