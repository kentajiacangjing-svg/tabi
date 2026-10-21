import { describe, it, expect } from "vitest";
import { blockedFlags, detectContactInfo } from "../contact-detect";
import { scoreCompany } from "../matching";
import { estimateRange } from "../estimate";
import { compareQuotes } from "../quote-compare";

describe("detectContactInfo", () => {
  it.each([
    ["090-1234-5678に電話ください", "phone"],
    ["０９０ー１２３４ー５６７８", "phone"],
    ["09012345678", "phone"],
    ["0 9 0 1 2 3 4 5 6 7 8 に", "phone"],
    ["〇九〇一二三四五六七八へ", "phone"],
    ["+81 90-1234-5678", "phone"],
    ["0120-123-456 までどうぞ", "phone"],
    ["メールは taro@example.com です", "email"],
    ["taro アット example ドット com", "email"],
    ["ｔａｒｏ＠ｅｘａｍｐｌｅ．ｃｏｍ", "email"],
    ["LINEで連絡しましょう", "line"],
    ["line交換しませんか", "line"],
    ["ラインID教えます", "line"],
    ["らいんで連絡ください", "line"],
    ["https://line.me/ti/p/abcdef", "contact_url"],
    ["lin.ee/abc で追加してください", "contact_url"],
    ["QRコード送ります", "qr"],
    ["インスタのDMでどうぞ", "sns"],
    ["@shonan_paint をフォローしてください", "sns"],
    ["https://www.instagram.com/someone", "contact_url"],
    ["wa.me/819012345678", "contact_url"],
    ["カタログはこちら https://www.example-maker.co.jp/products/123", "url"],
  ])("flags %s", (text, flag) => {
    expect(detectContactInfo(text)).toContain(flag);
  });
  it.each([
    "外壁の見積は118万円です",
    "見積総額は¥1,100,000（税込）です",
    "1,180,000円から値引きして1,100,000円にできます",
    "土曜日の10:00に伺います",
    "09:30〜17:00の間で作業します",
    "オンラインで打ち合わせも可能です",
    "2026年10月16日に着工予定です",
    "2026/10/21 と 2026-11-04 の2日間です",
    "郵便番号は251-0047です",
    "ガイドラインに沿って施工します",
    "屋根のラインがきれいに揃いました",
    "最新のラインナップから選べます",
    "インスタで施工事例を見て連絡しました",
    "寸法は W1820×D910×H2400mm です",
    "ひび割れ幅は0.3mm程度でした",
    "便器は TOTO CES9898 を予定しています",
    "保証は10年、工期は約14日です",
    "第2期は 3-5 番の部屋を施工します",
  ])("does not flag %s", (text) => {
    expect(detectContactInfo(text)).toEqual([]);
  });
  it("blocks only contact channels; plain links and QR mentions are warnings", () => {
    expect(blockedFlags(detectContactInfo("詳しくは https://www.example-maker.co.jp/catalog を見てください"))).toEqual([]);
    expect(blockedFlags(detectContactInfo("QRコード決済も使えます"))).toEqual([]);
    expect(blockedFlags(detectContactInfo("090-1234-5678"))).toEqual(["phone"]);
  });
});

describe("scoreCompany", () => {
  const project = { budget_min: 1000000, budget_max: 1500000, estimate_min: 800000, estimate_max: 1300000, desired_timing: "3m", city: "藤沢市", categoryName: "外壁塗装" };
  it("rewards fit and explains why", () => {
    const r = scoreCompany(project, { price_band_min: 700000, price_band_max: 1800000, lead_time_weeks: 3, rating_avg: 4.8, review_count: 10, avg_response_minutes: 20, self_construction: 1, worksInCategory: 180 });
    expect(r.score).toBeGreaterThanOrEqual(90);
    expect(r.reasons).toContain("希望予算帯");
    expect(r.reasons).toContain("希望時期対応可能");
  });
  it("is lower for poor fit", () => {
    const r = scoreCompany(project, { price_band_min: 3000000, price_band_max: 5000000, lead_time_weeks: 20, rating_avg: 3, review_count: 3, avg_response_minutes: 600, self_construction: 0, worksInCategory: 1 });
    expect(r.score).toBeLessThan(70);
  });
});

describe("estimateRange", () => {
  it("widens upper bound for older buildings and always adds the disclaimer", () => {
    const r = estimateRange({ priceMin: 800000, priceMax: 1300000, houseType: "戸建て", buildingAge: 18 });
    expect(r.min).toBe(800000);
    expect(r.max).toBe(1300000);
    expect(r.notes.at(-1)).toContain("現地確認後");
    const old = estimateRange({ priceMin: 800000, priceMax: 1300000, houseType: "戸建て", buildingAge: 35 });
    expect(old.max).toBe(1560000);
  });
});

describe("compareQuotes", () => {
  it("highlights cheapest, longest warranty and missing extra-cost notes", () => {
    const c = compareQuotes([
      { companyId: "a", companyName: "A社", total: 1180000, warrantyYears: 10, durationDays: 14, extraCosts: "あり", itemCount: 7, materials: "" },
      { companyId: "b", companyName: "B社", total: 1430000, warrantyYears: 15, durationDays: 16, extraCosts: "あり", itemCount: 6, materials: "" },
      { companyId: "c", companyName: "C社", total: 1050000, warrantyYears: 8, durationDays: 18, extraCosts: "", itemCount: 1, materials: "" },
    ]);
    expect(c.find((x) => x.companyId === "b" && x.text.includes("保証"))).toBeTruthy();
    expect(c.find((x) => x.companyId === "c" && x.text.includes("最も金額が低い"))).toBeTruthy();
    expect(c.find((x) => x.companyId === "c" && x.text.includes("追加費用"))).toBeTruthy();
  });
});
