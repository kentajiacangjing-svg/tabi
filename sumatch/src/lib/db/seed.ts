// Demo data so the complete flow can be explored on first launch.
// All demo accounts share the password below. Disable one-click demo login with DEMO_MODE=false.
import fs from "node:fs";
import path from "node:path";
import { all, get, insert, newId, run, tx, update, STORAGE_DIR } from "./index";
import { hashPassword } from "../password";
import { calcQuote, generateCandidates, recalcCompanyRating } from "../services";
import { estimateRange } from "../estimate";
import type { Category, Match, Project } from "../types";

export const DEMO_PASSWORD = "sumatch123";

const DAY = 86400_000;
const ago = (days: number, hours = 0) => new Date(Date.now() - days * DAY - hours * 3600_000).toISOString();
const ahead = (days: number) => new Date(Date.now() + days * DAY).toISOString().slice(0, 10);

// Deterministic PRNG for repeatable demo KPIs.
function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

function seedFile(name: string, scope: "project" | "match" | "public", scopeId: string | null, owner: string | null) {
  const src = path.join(process.cwd(), "public", "seed", name);
  const id = newId("file");
  const dir = path.join(STORAGE_DIR, "uploads");
  fs.mkdirSync(dir, { recursive: true });
  const storage = `${id}.svg`;
  let size = 0;
  try {
    fs.copyFileSync(src, path.join(dir, storage));
    size = fs.statSync(src).size;
  } catch {
    fs.writeFileSync(path.join(dir, storage), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 4 3"><rect width="4" height="3" fill="#E5E9F0"/></svg>`);
  }
  insert("files", {
    id,
    owner_user_id: owner,
    scope,
    scope_id: scopeId,
    mime: "image/svg+xml",
    size,
    original_name: name.replace(".svg", ".jpg"),
    storage_path: storage,
    created_at: ago(30),
  });
  return id;
}

export function seed() {
  tx(() => {
    const pw = hashPassword(DEMO_PASSWORD);
    const user = (email: string, name: string, role: string, created = ago(60)) => {
      const id = newId("usr");
      insert("users", { id, email, name, role, password_hash: pw, created_at: created });
      return id;
    };

    /* ---------- settings ---------- */
    run("INSERT OR REPLACE INTO settings (key, value) VALUES ('default_trial_days', '60')");
    run("INSERT OR REPLACE INTO settings (key, value) VALUES ('success_fee_note', '成約時: 成功報酬 3〜5%（契約金額に対して）')");

    /* ---------- plans (editable in /admin) ---------- */
    const plans = [
      ["STARTER", "STARTER", 9800, 5, 0.05, "まずは小さく始めたい会社に"],
      ["GROWTH", "GROWTH", 19800, 15, 0.04, "安定して新規案件を増やしたい会社に"],
      ["PRO", "PRO", 39800, 40, 0.03, "複数の担当者で積極的に対応する会社に"],
    ] as const;
    const planId: Record<string, string> = {};
    plans.forEach(([code, name, price, limit, fee, desc], i) => {
      planId[code] = newId("plan");
      insert("plans", { id: planId[code], code, name, monthly_price: price, match_limit: limit, success_fee_rate: fee, description: desc, sort: i, created_at: ago(90) });
    });

    /* ---------- categories (add more from /admin) ---------- */
    // The first four are shown on the top page; the rest live under 「その他」.
    const cats: [string, string, string, string, string, number, number, string, string[], number][] = [
      ["exterior-paint", "外壁・屋根", "住まい", "roof", "塗り替え・補修・雨漏り", 400000, 1800000, "30坪前後の戸建て。部分補修〜外壁と屋根の同時塗装の目安", ["色あせ・汚れ", "ひび割れ", "雨漏り", "コケ・カビ", "前回の工事から10年以上"], 1],
      ["kitchen", "キッチン", "住まい", "water", "交換・レイアウト変更", 500000, 1500000, "システムキッチン交換の目安", ["古くなった", "使いにくい", "収納を増やしたい", "IHにしたい"], 1],
      ["bath", "お風呂", "住まい", "water", "ユニットバス交換・在来浴室から", 700000, 1600000, "ユニットバス交換の目安", ["冬が寒い", "カビ・汚れ", "段差をなくしたい", "給湯器の不調"], 1],
      ["interior", "内装", "住まい", "interior", "クロス・床・間取り", 100000, 800000, "6〜8畳×数部屋のクロス・床張替えの目安", ["クロスの汚れ・はがれ", "床のきしみ", "和室を洋室に", "間取りを変えたい"], 1],
      ["toilet", "トイレ・洗面", "住まい", "water", "便器・洗面台の交換", 150000, 500000, "本体交換と内装の目安", ["水漏れ", "古くなった", "掃除しやすくしたい"], 1],
      ["exterior", "外構・庭", "住まい", "fence", "フェンス・駐車場・庭", 300000, 2000000, "フェンス・カーポート・土間コンクリートの目安", ["駐車場を広げたい", "フェンスの交換", "カーポート設置", "庭の手入れが大変"], 1],
      ["aircon", "エアコン", "住まい", "aircon", "取付・交換", 30000, 250000, "1台あたり・本体代込みの目安", ["効きが悪い", "新しく取り付けたい", "古いエアコンの交換"], 1],
      ["house-cleaning", "ハウスクリーニング", "暮らし", "sparkle", "水回り・エアコン・空室", 15000, 120000, "箇所ごと〜空室まるごとの目安", ["キッチンの油汚れ", "浴室のカビ", "引越し前後の清掃"], 1],
      ["moving", "引越し", "暮らし", "truck", "近距離・単身・家族", 30000, 300000, "", [], 0],
      ["junk", "不用品回収", "暮らし", "box", "家具・家電の回収", 10000, 200000, "", [], 0],
    ];
    // Old category keys used below map onto the new set.
    const remap: Record<string, string[]> = { roof: ["exterior-paint"], water: ["kitchen", "bath", "toilet"] };
    const expandCats = (list: [string, number][]) => {
      const out = new Map<string, number>();
      for (const [slug, n] of list) for (const s of remap[slug] ?? [slug]) out.set(s, (out.get(s) ?? 0) + n);
      return [...out.entries()];
    };
    const workCat = (img: string, slug: string) => (slug === "water" ? (img.startsWith("kitchen") ? "kitchen" : "bath") : (remap[slug]?.[0] ?? slug));
    const catId: Record<string, string> = {};
    cats.forEach(([slug, name, group, icon, desc, min, max, note, concerns, active], i) => {
      catId[slug] = newId("cat");
      insert("categories", { id: catId[slug], slug, name, group_name: group, icon, description: desc, price_min: min, price_max: max, price_note: note, concerns: JSON.stringify(concerns), active, sort: i, created_at: ago(90) });
    });

    /* ---------- areas (add more from /admin) ---------- */
    const areas: [string, string, string, string, number][] = [
      ["神奈川県", "藤沢市", "湘南", "251,252", 1],
      ["神奈川県", "茅ヶ崎市", "湘南", "253", 1],
      ["神奈川県", "平塚市", "湘南", "254,259", 1],
      ["神奈川県", "鎌倉市", "湘南", "247,248", 0],
      ["神奈川県", "寒川町", "湘南", "253", 0],
    ];
    const areaId: Record<string, string> = {};
    areas.forEach(([pref, city, region, postal, active], i) => {
      areaId[city] = newId("area");
      insert("service_areas", { id: areaId[city], prefecture: pref, city, region, postal_prefixes: postal, active, sort: i, created_at: ago(90) });
    });

    /* ---------- admin ---------- */
    user("admin@demo.sumatch.jp", "SUMATCH運営", "admin", ago(120));

    /* ---------- companies ---------- */
    interface Seed {
      key: string; name: string; kana: string; owner: [string, string]; staff?: [string, string]; status?: string;
      cats: [string, number][]; areas: string[]; band: [number, number]; lead: number; resp: number; self: number;
      tagline: string; desc: string; specialties: string; warranty: string; color: string; founded: number; employees: number; total: number;
      address: string; hours: string; license?: string; quals?: string; plan: string; works: [string, string, string, string, string][]; site?: string;
    }
    const companies: Seed[] = [
      {
        key: "shonan-paint", name: "湘南ペイント", kana: "しょうなんぺいんと", owner: ["owner@shonan-paint.demo", "佐藤 健一"], staff: ["staff@shonan-paint.demo", "田中 美咲"],
        cats: [["exterior-paint", 180], ["roof", 64]], areas: ["藤沢市", "茅ヶ崎市", "平塚市"], band: [700000, 1800000], lead: 3, resp: 25, self: 1,
        tagline: "塗装職人が直接伺う、湘南の外壁塗装専門店", desc: "藤沢市を拠点に外壁・屋根塗装を専門に行っています。現地調査から施工・アフター点検まで自社の職人が担当します。潮風の影響を受けやすい湘南エリアの住宅に合わせた塗料選びが得意です。", specialties: "外壁塗装, 屋根塗装, 防水, 遮熱塗料",
        warranty: "外壁10年・屋根7年の自社保証 / 1・3・5年目の無料点検", color: "#2557D6", founded: 2009, employees: 14, total: 1240, address: "神奈川県藤沢市辻堂", hours: "9:00〜18:00（日曜定休）", license: "神奈川県知事許可（般-1）第12345号", quals: "一級塗装技能士, 外装劣化診断士", plan: "GROWTH",
        works: [["exterior-1.jpg", "exterior-paint", "藤沢市 築20年 戸建て 外壁塗装", "藤沢市", "約120万円"], ["exterior-3.jpg", "exterior-paint", "茅ヶ崎市 外壁・付帯部塗装", "茅ヶ崎市", "約98万円"], ["roof-1.jpg", "roof", "平塚市 屋根遮熱塗装", "平塚市", "約45万円"]], site: "https://example.com/shonan-paint",
      },
      {
        key: "fujisawa-reform", name: "藤沢リフォーム", kana: "ふじさわりふぉーむ", owner: ["owner@fujisawa-reform.demo", "中村 浩二"],
        cats: [["exterior-paint", 85], ["roof", 40], ["water", 120], ["interior", 150]], areas: ["藤沢市", "茅ヶ崎市"], band: [800000, 2500000], lead: 4, resp: 50, self: 1,
        tagline: "地元で30年。住まいまるごと相談できるリフォーム会社", desc: "外装から水回り・内装まで、住まい全体のリフォームを手がけています。一級建築士が在籍し、長期保証にも対応。地元密着でアフターフォローを大切にしています。", specialties: "外装リフォーム, 浴室・キッチン, 内装全般",
        warranty: "工事内容に応じて最長15年保証 / 定期点検あり", color: "#2F6F5E", founded: 1994, employees: 22, total: 3100, address: "神奈川県藤沢市藤沢", hours: "9:00〜18:30（水曜定休）", license: "神奈川県知事許可（般-3）第23456号", quals: "一級建築士, 二級建築施工管理技士", plan: "PRO",
        works: [["exterior-2.jpg", "exterior-paint", "藤沢市 外壁塗装＋シーリング打ち替え", "藤沢市", "約140万円"], ["bath-1.jpg", "water", "茅ヶ崎市 ユニットバス交換", "茅ヶ崎市", "約110万円"], ["kitchen-1.jpg", "water", "藤沢市 システムキッチン交換", "藤沢市", "約95万円"]], site: "https://example.com/fujisawa-reform",
      },
      {
        key: "home-works", name: "HOME WORKS", kana: "ほーむわーくす", owner: ["owner@homeworks.demo", "小林 大輔"],
        cats: [["exterior-paint", 40], ["interior", 90], ["water", 60], ["exterior", 35]], areas: ["藤沢市", "茅ヶ崎市", "平塚市"], band: [900000, 3000000], lead: 5, resp: 90, self: 0,
        tagline: "デザインから考える、暮らしのリノベーション", desc: "設計担当がご要望を丁寧にヒアリングし、仕上がりのイメージを共有してから工事に入ります。施工は提携する専門職人と連携し、品質管理を自社で行います。", specialties: "デザインリフォーム, 内装, 外壁の色彩提案",
        warranty: "外壁12年保証 / 内装2年保証", color: "#3B3F46", founded: 2015, employees: 9, total: 460, address: "神奈川県茅ヶ崎市東海岸", hours: "10:00〜19:00（火曜定休）", quals: "インテリアコーディネーター, 二級建築士", plan: "GROWTH",
        works: [["exterior-5.jpg", "exterior-paint", "茅ヶ崎市 モノトーン外壁塗装", "茅ヶ崎市", "約150万円"], ["interior-1.jpg", "interior", "藤沢市 リビング内装リノベーション", "藤沢市", "約180万円"], ["garden-2.jpg", "exterior", "平塚市 ウッドフェンス", "平塚市", "約60万円"]], site: "https://example.com/homeworks",
      },
      {
        key: "chigasaki-roof", name: "茅ヶ崎ルーフ工業", kana: "ちがさきるーふこうぎょう", owner: ["owner@chigasaki-roof.demo", "加藤 誠"],
        cats: [["roof", 210], ["exterior-paint", 12]], areas: ["茅ヶ崎市", "藤沢市", "平塚市"], band: [300000, 1600000], lead: 2, resp: 40, self: 1,
        tagline: "屋根一筋。雨漏り調査から葺き替えまで", desc: "屋根工事を専門に、点検・補修・カバー工法・葺き替えまで対応します。ドローンでの屋根点検写真をお渡しし、状態を分かりやすくご説明します。", specialties: "屋根修理, 雨漏り調査, カバー工法",
        warranty: "葺き替え10年 / 補修1年", color: "#6B4E3D", founded: 2003, employees: 11, total: 2200, address: "神奈川県茅ヶ崎市本村", hours: "8:30〜17:30（日曜定休）", license: "神奈川県知事許可（般-2）第34567号", quals: "かわらぶき技能士, 雨漏り診断士", plan: "STARTER",
        works: [["roof-2.jpg", "roof", "茅ヶ崎市 瓦屋根の葺き替え", "茅ヶ崎市", "約160万円"], ["roof-1.jpg", "roof", "藤沢市 棟板金交換", "藤沢市", "約18万円"], ["exterior-4.jpg", "exterior-paint", "平塚市 外壁部分補修", "平塚市", "約30万円"]],
      },
      {
        key: "hiratsuka-water", name: "平塚みずまわりサービス", kana: "ひらつかみずまわりさーびす", owner: ["owner@hiratsuka-water.demo", "吉田 直樹"],
        cats: [["water", 340]], areas: ["平塚市", "茅ヶ崎市"], band: [150000, 1500000], lead: 1, resp: 20, self: 1,
        tagline: "水まわりのトラブルと交換工事、最短翌日対応", desc: "キッチン・浴室・トイレ・給湯器の交換を中心に、水まわり専門で対応しています。メーカー各社の商品から予算に合わせてご提案します。", specialties: "トイレ交換, ユニットバス, 給湯器",
        warranty: "工事保証5年 / メーカー保証あり", color: "#1F7A8C", founded: 2011, employees: 8, total: 1800, address: "神奈川県平塚市紅谷町", hours: "8:00〜20:00（年中無休）", quals: "給水装置工事主任技術者", plan: "STARTER",
        works: [["bath-2.jpg", "water", "平塚市 浴室リフォーム", "平塚市", "約98万円"], ["kitchen-2.jpg", "water", "茅ヶ崎市 キッチン交換", "茅ヶ崎市", "約85万円"]],
      },
      {
        key: "shonan-interior", name: "湘南インテリア工房", kana: "しょうなんいんてりあこうぼう", owner: ["owner@shonan-interior.demo", "山本 彩"],
        cats: [["interior", 260]], areas: ["藤沢市", "茅ヶ崎市", "平塚市"], band: [100000, 900000], lead: 2, resp: 35, self: 1,
        tagline: "クロス・床の張替えを、丁寧に早く", desc: "壁紙・床材の張替えを中心とした内装専門店です。家具の移動からお任せいただけます。サンプルをお持ちしてご自宅でお選びいただけます。", specialties: "クロス張替え, フローリング, 和室→洋室",
        warranty: "施工保証2年", color: "#8A6D3B", founded: 2013, employees: 6, total: 2600, address: "神奈川県藤沢市湘南台", hours: "9:00〜18:00（日曜定休）", quals: "内装仕上げ施工技能士", plan: "STARTER",
        works: [["interior-2.jpg", "interior", "藤沢市 マンション全室クロス張替え", "藤沢市", "約42万円"], ["interior-1.jpg", "interior", "茅ヶ崎市 フローリング張替え", "茅ヶ崎市", "約35万円"]],
      },
      {
        key: "green-exterior", name: "グリーンエクステリア湘南", kana: "ぐりーんえくすてりあしょうなん", owner: ["owner@green-exterior.demo", "井上 拓也"],
        cats: [["exterior", 190]], areas: ["藤沢市", "茅ヶ崎市", "平塚市"], band: [300000, 2500000], lead: 4, resp: 120, self: 1,
        tagline: "家の顔をつくる、外構とお庭の専門店", desc: "駐車場・フェンス・門まわり・お庭づくりまで、外構全般を自社施工しています。3Dパースで完成イメージを確認できます。", specialties: "駐車場, フェンス, 植栽, カーポート",
        warranty: "施工保証3年", color: "#4F7A4F", founded: 2008, employees: 10, total: 950, address: "神奈川県平塚市田村", hours: "9:00〜18:00（日曜定休）", license: "神奈川県知事許可（般-4）第45678号", quals: "エクステリアプランナー", plan: "GROWTH",
        works: [["garden-1.jpg", "exterior", "藤沢市 ウッドフェンスと植栽", "藤沢市", "約75万円"], ["garden-2.jpg", "exterior", "茅ヶ崎市 駐車場拡張", "茅ヶ崎市", "約110万円"]],
      },
      {
        key: "shonan-aircon", name: "湘南エアコンサービス", kana: "しょうなんえあこんさーびす", owner: ["owner@shonan-aircon.demo", "松本 亮"],
        cats: [["aircon", 900]], areas: ["藤沢市", "茅ヶ崎市", "平塚市"], band: [30000, 300000], lead: 1, resp: 30, self: 1,
        tagline: "エアコンの取付・交換・移設を最短当日", desc: "エアコンの新規取付・交換・移設・撤去を専門に行っています。配管の美しさにこだわった施工が強みです。", specialties: "エアコン取付, 交換, 移設",
        warranty: "取付工事保証5年", color: "#3A6EA5", founded: 2016, employees: 5, total: 5200, address: "神奈川県藤沢市大庭", hours: "8:00〜19:00（年中無休）", quals: "第二種電気工事士", plan: "STARTER",
        works: [["aircon-1.jpg", "aircon", "藤沢市 リビングエアコン交換", "藤沢市", "約16万円"]],
      },
      {
        key: "clean-life", name: "クリーンライフ湘南", kana: "くりーんらいふしょうなん", owner: ["owner@clean-life.demo", "林 恵"],
        cats: [["house-cleaning", 1400], ["aircon", 300]], areas: ["藤沢市", "茅ヶ崎市", "平塚市"], band: [10000, 150000], lead: 1, resp: 45, self: 1,
        tagline: "暮らしを整える、プロのハウスクリーニング", desc: "キッチン・浴室・エアコンなどの分解洗浄、引越し前後のまるごと清掃に対応します。環境にやさしい洗剤を使用しています。", specialties: "水回り清掃, エアコン分解洗浄, 空室清掃",
        warranty: "仕上がり保証（1週間以内の再清掃無料）", color: "#2E8B83", founded: 2018, employees: 7, total: 3900, address: "神奈川県茅ヶ崎市新栄町", hours: "9:00〜18:00（年中無休）", quals: "ハウスクリーニング技能士", plan: "STARTER",
        works: [["clean-1.jpg", "house-cleaning", "茅ヶ崎市 空室まるごとクリーニング", "茅ヶ崎市", "約6万円"]],
      },
      {
        key: "umibe-koumuten", name: "海辺の住まい工務店", kana: "うみべのすまいこうむてん", owner: ["owner@umibe.demo", "斎藤 学"], status: "pending",
        cats: [["exterior-paint", 25], ["interior", 30]], areas: ["藤沢市", "茅ヶ崎市"], band: [500000, 2000000], lead: 6, resp: 240, self: 1,
        tagline: "木の家と暮らしの小さな工務店", desc: "木造住宅の修繕・リフォームを中心に、少人数で丁寧に対応しています。", specialties: "木部塗装, 内装, 小規模修繕",
        warranty: "施工保証5年", color: "#5C6B7A", founded: 2020, employees: 3, total: 120, address: "神奈川県藤沢市鵠沼海岸", hours: "9:00〜17:00（土日定休）", plan: "STARTER",
        works: [],
      },
    ];

    const companyId: Record<string, string> = {};
    const ownerId: Record<string, string> = {};
    for (const c of companies) {
      const id = newId("co");
      companyId[c.key] = id;
      const status = c.status ?? "approved";
      insert("companies", {
        id, name: c.name, name_kana: c.kana, status, address: c.address, phone: "0466-00-0000", email: c.owner[0], contact_person: c.owner[1],
        tagline: c.tagline, description: c.desc, specialties: c.specialties, warranty: c.warranty, self_construction: c.self,
        price_band_min: c.band[0], price_band_max: c.band[1], lead_time_weeks: c.lead, website_url: c.site ?? "", business_hours: c.hours,
        license_number: c.license ?? "", qualifications: c.quals ?? "", founded_year: c.founded, employees: c.employees, works_total: c.total,
        avg_response_minutes: c.resp, brand_color: c.color, plan_id: planId[c.plan], trial_ends_at: ahead(45),
        created_at: ago(status === "pending" ? 2 : 80), approved_at: status === "approved" ? ago(78) : null,
      });
      const oid = user(c.owner[0], c.owner[1], "business", ago(80));
      ownerId[c.key] = oid;
      insert("company_members", { company_id: id, user_id: oid, member_role: "owner", created_at: ago(80) });
      if (c.staff) {
        const sid = user(c.staff[0], c.staff[1], "business", ago(60));
        insert("company_members", { company_id: id, user_id: sid, member_role: "staff", created_at: ago(60) });
      }
      for (const [slug, n] of expandCats(c.cats)) insert("company_categories", { company_id: id, category_id: catId[slug], works_count: n });
      for (const a of c.areas) insert("company_areas", { company_id: id, area_id: areaId[a] });
      for (const [img, slug, title, city, cost] of c.works) {
        insert("company_works", { id: newId("wk"), company_id: id, category_id: catId[workCat(img, slug)], title, city, cost_label: cost, image_url: `/seed/${img}`, created_at: ago(40) });
      }
    }

    /* ---------- reviews (historical, posted after SUMATCH-managed jobs) ---------- */
    const reviewPool: [number, string, string, string][] = [
      [5, "説明が丁寧で安心できました", "見積の内訳を一つずつ説明してくれて、追加費用が出る可能性も最初に教えてもらえました。", "藤沢市 40代"],
      [5, "職人さんの対応が気持ちよかった", "毎日の作業報告がSUMATCHのチャットに届くので、仕事中でも進み具合が分かりました。", "茅ヶ崎市 50代"],
      [4, "仕上がりに満足", "工期が1日延びましたが、事前に連絡があり問題ありませんでした。", "平塚市 60代"],
      [5, "比較して選んでよかった", "3社比較して、保証内容と説明の分かりやすさで決めました。", "藤沢市 30代"],
      [4, "返信が早くて助かりました", "質問への返信がとても早く、やり取りがスムーズでした。", "茅ヶ崎市 40代"],
      [5, "また頼みたい", "近所の方からも褒められました。点検にも来てくれるそうで安心です。", "藤沢市 70代"],
    ];
    const reviewCounts: Record<string, number> = {
      "shonan-paint": 6, "fujisawa-reform": 5, "home-works": 4, "chigasaki-roof": 5, "hiratsuka-water": 4,
      "shonan-interior": 3, "green-exterior": 3, "shonan-aircon": 4, "clean-life": 3,
    };
    for (const [key, n] of Object.entries(reviewCounts)) {
      for (let i = 0; i < n; i++) {
        const [rating, title, body, label] = reviewPool[(i + key.length) % reviewPool.length];
        const r = key === "home-works" && i === 0 ? 4 : rating;
        insert("reviews", { id: newId("rv"), company_id: companyId[key], rating: r, title, body, author_label: label, created_at: ago(10 + i * 9) });
      }
      recalcCompanyRating(companyId[key]);
    }

    /* ---------- customers & projects ---------- */
    const yamada = user("yamada@demo.sumatch.jp", "山田 太郎", "customer", ago(9));
    const suzuki = user("suzuki@demo.sumatch.jp", "鈴木 花子", "customer", ago(40));
    const takahashi = user("takahashi@demo.sumatch.jp", "高橋 誠", "customer", ago(70));
    const ito = user("ito@demo.sumatch.jp", "伊藤 由美", "customer", ago(1));
    const watanabe = user("watanabe@demo.sumatch.jp", "渡辺 健", "customer", ago(1));

    const cat = (slug: string) => get<Category>("SELECT * FROM categories WHERE id = ?", catId[slug])!;
    const mkProject = (p: {
      customer: string; slug: string; city: string; postal: string; house: string; age: number; title: string; concerns: string[]; details: string;
      timing: string; budget: [number | null, number | null]; contact: string; status: string; created: string; photos: string[];
    }) => {
      const c = cat(p.slug);
      const est = estimateRange({ priceMin: c.price_min, priceMax: c.price_max, houseType: p.house, buildingAge: p.age });
      const id = newId("pj");
      insert("projects", {
        id, customer_id: p.customer, category_id: c.id, area_id: areaId[p.city], title: p.title, postal_code: p.postal, prefecture: "神奈川県", city: p.city,
        house_type: p.house, building_age: p.age, concerns: p.concerns.join("、"), details: p.details, desired_timing: p.timing,
        budget_min: p.budget[0], budget_max: p.budget[1], contact_time: p.contact, estimate_min: est.min, estimate_max: est.max,
        status: p.status, created_at: p.created, updated_at: p.created,
      });
      p.photos.forEach((ph, i) => {
        const fid = seedFile(ph, "project", id, p.customer);
        insert("project_images", { id: newId("pi"), project_id: id, file_id: fid, sort: i, created_at: p.created });
      });
      const project = get<Project>("SELECT * FROM projects WHERE id = ?", id)!;
      generateCandidates(project);
      return project;
    };
    const matchOf = (projectId: string, key: string) => get<Match>("SELECT * FROM matches WHERE project_id = ? AND company_id = ?", projectId, companyId[key])!;
    const setMatched = (m: Match, at: string, extra: Record<string, string | number> = {}) =>
      update("matches", m.id, { customer_interest: 1, customer_interest_at: at, company_response: "yes", company_response_at: at, status: "matched", matched_at: at, customer_match_seen_at: at, company_match_seen_at: at, ...extra });

    const msg = (matchId: string, side: "customer" | "company" | "system", sender: string | null, body: string, at: string, extra: Record<string, string | null> = {}) => {
      insert("messages", { id: newId("msg"), match_id: matchId, sender_user_id: sender, sender_side: side, kind: side === "system" ? "system" : "text", body, created_at: at, ...extra });
      run("UPDATE matches SET last_message_at = ? WHERE id = ?", at, matchId);
    };

    const quote = (
      m: Match, projectId: string, key: string, at: string, total: number,
      q: { title: string; items: [string, number, string, number][]; overhead: number; warranty: string; years: number; duration: string; days: number; materials: string; payment: string; extra: string; notes: string },
      status = "submitted",
    ) => {
      const items = q.items.map(([name, quantity, unit, unit_price]) => ({ name, quantity, unit, unit_price }));
      const raw = calcQuote(items, q.overhead, 0);
      const taxable = Math.round(total / 1.1);
      const discount = raw.subtotal + q.overhead - taxable;
      const { lines, subtotal, tax, total: finalTotal } = calcQuote(items, q.overhead, discount);
      const id = newId("qt");
      insert("quotes", {
        id, match_id: m.id, project_id: projectId, company_id: companyId[key], created_by: ownerId[key], version: 1, status, title: q.title,
        subtotal, overhead: q.overhead, discount, tax, total: finalTotal, warranty: q.warranty, warranty_years: q.years, duration: q.duration, duration_days: q.days,
        materials: q.materials, payment_terms: q.payment, extra_costs: q.extra, notes: q.notes, valid_until: ahead(30), created_at: at,
      });
      lines.forEach((l, i) => insert("quote_items", { id: newId("qi"), quote_id: id, name: l.name, quantity: l.quantity, unit: l.unit, unit_price: l.unit_price, amount: l.amount, sort: i }));
      msg(m.id, "company", ownerId[key], "見積書を提出しました", at, { kind: "quote", quote_id: id });
      return id;
    };

    // 1) 山田 太郎 — 比較中（3社から見積）
    const pY = mkProject({
      customer: yamada, slug: "exterior-paint", city: "藤沢市", postal: "251-0047", house: "戸建て", age: 18, title: "外壁塗装の相談",
      concerns: ["色あせ", "チョーキング（白い粉）", "コケ・カビ"], details: "南面の色あせと、北面にコケが目立ってきました。前回の塗装から15年ほど経っています。できれば屋根も一緒に見てほしいです。",
      timing: "3m", budget: [1000000, 1500000], contact: "平日 夕方以降", status: "comparing", created: ago(8), photos: ["exterior-2.svg", "wall-crack.svg", "exterior-4.svg"],
    });
    const yScores: Record<string, [number, string[]]> = {
      "shonan-paint": [94, ["対応地域（藤沢市）", "希望予算帯", "外壁・屋根の実績多数", "希望時期対応可能", "返信が早い"]],
      "fujisawa-reform": [89, ["対応地域（藤沢市）", "希望予算帯", "外壁・屋根の実績多数", "希望時期対応可能"]],
      "home-works": [85, ["対応地域（藤沢市）", "希望予算帯", "外壁・屋根の実績多数", "希望時期対応可能"]],
    };
    for (const [key, [score, reasons]] of Object.entries(yScores)) update("matches", matchOf(pY.id, key).id, { score, reasons: JSON.stringify(reasons) });
    const ySP = matchOf(pY.id, "shonan-paint"), yFR = matchOf(pY.id, "fujisawa-reform"), yHW = matchOf(pY.id, "home-works");
    setMatched(ySP, ago(7, 20), { customer_last_read_at: ago(0, 1), company_last_read_at: ago(0, 2) });
    setMatched(yFR, ago(7, 18), { customer_last_read_at: ago(1), company_last_read_at: ago(1) });
    setMatched(yHW, ago(7, 10), { customer_last_read_at: ago(2), company_last_read_at: ago(0, 5) });
    const sys = "マッチが成立しました。ここから先のご相談・現地調査の日程調整・見積のやり取りは、すべてSUMATCH内で行えます。";
    // 湘南ペイント
    msg(ySP.id, "system", null, sys, ago(7, 20));
    msg(ySP.id, "company", ownerId["shonan-paint"], "はじめまして、湘南ペイントの佐藤です。お写真ありがとうございます。北面のコケは高圧洗浄と防カビ下塗りでしっかり対応できます。現地調査のご希望日を2〜3候補いただけますか？", ago(7, 19));
    msg(ySP.id, "customer", yamada, "ありがとうございます。今週の土曜日の午前か、来週水曜の18時以降はいかがでしょうか。", ago(7, 12));
    msg(ySP.id, "company", ownerId["shonan-paint"], "土曜日10時に伺います。屋根も合わせて点検し、写真付きでご報告しますね。", ago(7, 11));
    msg(ySP.id, "company", ownerId["shonan-paint"], "本日はありがとうございました。点検時の写真を共有します。北面のコケと、ベランダ下のひび割れ（幅0.3mm程度）を確認しました。", ago(4, 3), { kind: "image", file_id: seedFile("wall-crack.svg", "match", ySP.id, ownerId["shonan-paint"]) });
    quote(ySP, pY.id, "shonan-paint", ago(3, 6), 1180000, {
      title: "外壁塗装工事（シリコン塗料）",
      items: [["足場架設・解体", 180, "㎡", 900], ["高圧洗浄・バイオ洗浄", 150, "㎡", 300], ["下地補修（ひび割れ）", 1, "式", 45000], ["シーリング打ち替え", 120, "m", 1100], ["外壁塗装（下塗り+中塗り+上塗り）シリコン", 150, "㎡", 3200], ["付帯部塗装（雨樋・破風・軒天）", 1, "式", 98000], ["養生・清掃", 1, "式", 40000]],
      overhead: 80000, warranty: "外壁10年保証（自社）/ 1・3・5年目点検", years: 10, duration: "約14日（天候により前後）", days: 14, materials: "日本ペイント パーフェクトトップ（ラジカル制御形シリコン）",
      payment: "着工時30%・完工時70%（銀行振込）", extra: "下地の腐食が見つかった場合のみ、事前にご相談のうえ別途お見積", notes: "屋根は大きな劣化がないため今回は含めていません。ご希望があれば屋根塗装（約38万円）も追加できます。",
    });
    msg(ySP.id, "customer", yamada, "ありがとうございます。屋根は今回は見送ろうと思います。保証は塗膜のはがれも対象になりますか？", ago(0, 3));
    // 藤沢リフォーム
    msg(yFR.id, "system", null, sys, ago(7, 18));
    msg(yFR.id, "company", ownerId["fujisawa-reform"], "藤沢リフォームの中村です。外壁と合わせてシーリングの状態も確認させてください。来週月曜の午後はいかがでしょうか。", ago(7, 16));
    msg(yFR.id, "customer", yamada, "月曜の15時でお願いします。", ago(7, 8));
    quote(yFR, pY.id, "fujisawa-reform", ago(2, 4), 1320000, {
      title: "外壁塗装工事（フッ素塗料・長期保証プラン）",
      items: [["仮設足場", 1, "式", 190000], ["洗浄", 1, "式", 45000], ["シーリング打ち替え", 1, "式", 140000], ["外壁塗装 フッ素", 150, "㎡", 4300], ["付帯部塗装", 1, "式", 110000], ["諸経費・廃材処分", 1, "式", 35000]],
      overhead: 60000, warranty: "外壁15年保証 / 2年ごとの定期点検", years: 15, duration: "約16日", days: 16, materials: "関西ペイント セラMフッ素",
      payment: "契約時10%・着工時40%・完工時50%", extra: "下地補修が想定以上の場合は1㎡あたり3,500円", notes: "フッ素塗料のため次回の塗り替えまで15〜18年が目安です。",
    });
    // HOME WORKS
    msg(yHW.id, "system", null, sys, ago(7, 10));
    msg(yHW.id, "company", ownerId["home-works"], "HOME WORKSの小林です。色選びからご一緒できます。カラーシミュレーションもお作りしますね。", ago(7, 6));
    msg(yHW.id, "customer", yamada, "色に迷っているので助かります。グレー系で考えています。", ago(6, 20));
    quote(yHW, pY.id, "home-works", ago(1, 5), 1450000, {
      title: "外壁塗装工事（無機塗料・カラーシミュレーション付き）",
      items: [["足場", 1, "式", 200000], ["洗浄・下地処理", 1, "式", 120000], ["シーリング", 1, "式", 150000], ["外壁塗装 無機ハイブリッド", 150, "㎡", 4100], ["付帯部", 1, "式", 120000], ["カラーシミュレーション", 1, "式", 30000]],
      overhead: 90000, warranty: "外壁12年保証", years: 12, duration: "約18日", days: 18, materials: "アステックペイント 超低汚染リファイン（無機）",
      payment: "着工時50%・完工時50%", extra: "", notes: "施工は提携職人が担当し、品質管理は当社が行います。",
    });
    run("UPDATE projects SET updated_at = ? WHERE id = ?", ago(1, 5), pY.id);

    // 2) 鈴木 花子 — 工事中（藤沢リフォームに決定）
    const pS = mkProject({
      customer: suzuki, slug: "bath", city: "茅ヶ崎市", postal: "253-0041", house: "マンション", age: 24, title: "浴室リフォームの相談",
      concerns: ["浴室が古い", "給湯器の不調"], details: "在来工法の浴室で冬が寒いです。ユニットバスへの交換を考えています。", timing: "asap", budget: [1000000, 1500000],
      contact: "土日祝", status: "in_progress", created: ago(35), photos: ["bath-2.svg"],
    });
    const sFR = matchOf(pS.id, "fujisawa-reform"), sHW = matchOf(pS.id, "hiratsuka-water");
    setMatched(sFR, ago(34), { customer_last_read_at: ago(1), company_last_read_at: ago(1) });
    setMatched(sHW, ago(34), { customer_last_read_at: ago(20), company_last_read_at: ago(20) });
    msg(sFR.id, "system", null, sys, ago(34));
    msg(sFR.id, "company", ownerId["fujisawa-reform"], "マンションの管理規約を確認のうえ、工事申請もこちらでサポートします。", ago(33));
    const qS = quote(sFR, pS.id, "fujisawa-reform", ago(28), 1280000, {
      title: "ユニットバス交換工事", items: [["既存浴室解体・撤去", 1, "式", 180000], ["ユニットバス本体（TOTO サザナ 1216）", 1, "台", 690000], ["組立・設備工事", 1, "式", 190000], ["電気・内装復旧", 1, "式", 60000]],
      overhead: 40000, warranty: "工事保証10年", years: 10, duration: "約5日", days: 5, materials: "TOTO サザナ", payment: "完工時一括", extra: "床下配管の腐食がある場合のみ別途", notes: "",
    }, "accepted");
    msg(sHW.id, "system", null, sys, ago(34));
    quote(sHW, pS.id, "hiratsuka-water", ago(29), 1350000, {
      title: "浴室リフォーム", items: [["ユニットバス交換一式", 1, "式", 1180000], ["給湯器点検", 1, "式", 15000]],
      overhead: 30000, warranty: "工事保証5年", years: 5, duration: "約4日", days: 4, materials: "LIXIL リデア", payment: "完工時一括", extra: "", notes: "",
    }, "declined");
    const ctS = newId("ct");
    insert("contracts", { id: ctS, project_id: pS.id, company_id: companyId["fujisawa-reform"], match_id: sFR.id, quote_id: qS, amount: 1280000, contract_date: ago(25).slice(0, 10), start_date: ago(2).slice(0, 10), status: "in_progress", success_fee_rate: 0.03, created_at: ago(25), updated_at: ago(2) });
    msg(sFR.id, "system", null, "お客様が藤沢リフォームに決定しました。契約予定金額: 1,280,000円", ago(25));
    msg(sFR.id, "system", null, "藤沢リフォームがステータスを「工事中」に更新しました。", ago(2));
    msg(sFR.id, "company", ownerId["fujisawa-reform"], "本日、既存浴室の解体が完了しました。明日ユニットバスの組立に入ります。", ago(1));
    update("matches", sHW.id, { status: "matched" });
    msg(sHW.id, "system", null, "お客様は今回、別の会社に依頼することを決定しました。ご対応ありがとうございました。", ago(25));

    // 3) 高橋 誠 — 完了（茅ヶ崎ルーフ工業）
    const pT = mkProject({
      customer: takahashi, slug: "exterior-paint", city: "平塚市", postal: "254-0034", house: "戸建て", age: 32, title: "雨漏りと屋根の修理",
      concerns: ["雨漏り", "瓦のズレ・割れ"], details: "台風のあと2階の天井にシミが出ました。", timing: "asap", budget: [500000, 1000000],
      contact: "いつでも可", status: "completed", created: ago(65), photos: ["roof-2.svg"],
    });
    const tCR = matchOf(pT.id, "chigasaki-roof");
    setMatched(tCR, ago(64), { customer_last_read_at: ago(20), company_last_read_at: ago(20) });
    msg(tCR.id, "system", null, sys, ago(64));
    msg(tCR.id, "company", ownerId["chigasaki-roof"], "明日の午前中にドローンで屋根を点検します。", ago(64));
    const qT = quote(tCR, pT.id, "chigasaki-roof", ago(60), 860000, {
      title: "屋根部分葺き替え・棟取り直し", items: [["瓦部分葺き替え", 20, "㎡", 18000], ["棟取り直し", 14, "m", 12000], ["防水シート", 20, "㎡", 2500], ["足場", 1, "式", 120000]],
      overhead: 50000, warranty: "葺き替え部10年保証", years: 10, duration: "約6日", days: 6, materials: "防災瓦", payment: "完工時一括", extra: "野地板の腐食が見つかった場合は別途", notes: "",
    }, "accepted");
    insert("contracts", { id: newId("ct"), project_id: pT.id, company_id: companyId["chigasaki-roof"], match_id: tCR.id, quote_id: qT, amount: 860000, contract_date: ago(58).slice(0, 10), start_date: ago(45).slice(0, 10), end_date: ago(38).slice(0, 10), status: "completed", success_fee_rate: 0.05, created_at: ago(58), updated_at: ago(38) });
    msg(tCR.id, "system", null, "茅ヶ崎ルーフ工業がステータスを「完了」に更新しました。", ago(38));
    insert("reviews", { id: newId("rv"), company_id: companyId["chigasaki-roof"], project_id: pT.id, customer_id: takahashi, rating: 5, title: "雨漏りがぴたりと止まりました", body: "ドローンの写真で状態を説明してもらえて納得して依頼できました。", author_label: "平塚市 60代", created_at: ago(36) });
    recalcCompanyRating(companyId["chigasaki-roof"]);

    // 4) 伊藤 由美 — 新着（まだ誰にも依頼していない）
    mkProject({
      customer: ito, slug: "interior", city: "藤沢市", postal: "251-0025", house: "マンション", age: 12, title: "リビングと寝室のクロス張替え",
      concerns: ["クロスの汚れ・はがれ"], details: "リビング（12畳）と寝室（6畳）の壁紙を張り替えたいです。", timing: "asap", budget: [100000, 300000],
      contact: "平日 日中", status: "consulting", created: ago(0, 6), photos: ["interior-2.svg", "interior-1.svg"],
    });

    // 5) 渡辺 健 — 新着（湘南ペイントと茅ヶ崎ルーフに話したい）
    const pW = mkProject({
      customer: watanabe, slug: "exterior-paint", city: "藤沢市", postal: "251-0052", house: "戸建て", age: 18, title: "外壁＋屋根の塗り替え",
      concerns: ["色あせ", "前回の塗装から10年以上", "塗装のはがれ"], details: "外壁と屋根をまとめて塗り替えたいです。", timing: "3m", budget: [1000000, 1500000],
      contact: "土日祝", status: "consulting", created: ago(0, 3), photos: ["exterior-1.svg", "exterior-5.svg", "roof-1.svg", "wall-crack.svg", "exterior-3.svg", "exterior-4.svg"],
    });
    update("matches", matchOf(pW.id, "shonan-paint").id, { customer_interest: 1, customer_interest_at: ago(0, 2) });
    update("matches", matchOf(pW.id, "chigasaki-roof").id, { customer_interest: 1, customer_interest_at: ago(0, 2) });

    /* ---------- notifications ---------- */
    const n = (uid: string, kind: string, title: string, body: string, link: string, at: string, read = false) =>
      insert("notifications", { id: newId("ntf"), user_id: uid, kind, title, body, link, created_at: at, read_at: read ? at : null });
    n(yamada, "quote", "見積が届きました", "HOME WORKSから見積（税込145万円）が届きました。", `/quotes?project=${pY.id}`, ago(1, 5));
    n(yamada, "quote", "見積が届きました", "藤沢リフォームから見積（税込132万円）が届きました。", `/quotes?project=${pY.id}`, ago(2, 4), true);
    n(ownerId["shonan-paint"], "new_lead", "お客様があなたの会社と話したいと希望しています", "藤沢市・外壁＋屋根の塗り替え", `/business/leads/${pW.id}`, ago(0, 2));
    n(ownerId["shonan-paint"], "message", "お客様からメッセージがあります", "ありがとうございます。屋根は今回は見送ろうと…", `/business/messages/${ySP.id}`, ago(0, 3));

    /* ---------- KPI events (last 30 days) ---------- */
    const r = rng(42);
    for (let d = 29; d >= 0; d--) {
      const visits = 12 + Math.floor(r() * 18) + (29 - d) / 2;
      for (let i = 0; i < visits; i++) {
        const at = ago(d, r() * 20);
        insert("events", { kind: "visit", session_key: `s${d}-${i}`, created_at: at, meta: "" });
        if (r() < 0.32) {
          insert("events", { kind: "diagnosis_start", session_key: `s${d}-${i}`, created_at: at, meta: "" });
          if (r() < 0.55) {
            insert("events", { kind: "diagnosis_complete", session_key: `s${d}-${i}`, created_at: at, meta: "" });
            if (r() < 0.8) insert("events", { kind: "company_view", session_key: `s${d}-${i}`, created_at: at, meta: `seed-${d}-${i}` });
          }
        }
      }
    }

    // Sanity: make sure every approved company has at least one area & category.
    const orphans = all<{ id: string }>("SELECT id FROM companies c WHERE NOT EXISTS (SELECT 1 FROM company_areas a WHERE a.company_id = c.id)");
    if (orphans.length > 1) throw new Error("seed: companies without areas");
  });
}
