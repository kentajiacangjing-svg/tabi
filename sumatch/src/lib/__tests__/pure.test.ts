import { describe, it, expect } from "vitest";
import { detectContactInfo } from "../contact-detect";
import { scoreCompany } from "../matching";
import { estimateRange } from "../estimate";
import { compareQuotes } from "../quote-compare";

describe("detectContactInfo", () => {
  it.each([
    ["090-1234-5678に電話ください", "phone"],
    ["０９０ー１２３４ー５６７８", "phone"],
    ["09012345678", "phone"],
    ["メールは taro@example.com です", "email"],
    ["LINEで連絡しましょう", "line"],
    ["ラインID教えます", "line"],
    ["QRコード送ります", "qr"],
    ["インスタのDMでどうぞ", "sns"],
  ])("flags %s", (text, flag) => {
    expect(detectContactInfo(text)).toContain(flag);
  });
  it.each([
    "外壁の見積もりは118万円です",
    "土曜日の10:00に伺います",
    "オンラインで打ち合わせも可能です",
    "2026年10月16日に着工予定です",
    "郵便番号は251-0047です",
    "ガイドラインに沿って施工します",
  ])("does not flag %s", (text) => {
    expect(detectContactInfo(text)).toEqual([]);
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
