// マッチ度の算出（純粋関数）。
// 重要: 料金プラン・広告・SUMATCH Web の購入有無はスコアの入力に含めない。
// 順位を金銭で操作していると見える要素は一切使わない。

import { TIMINGS } from "./constants";

export interface ScoreProject {
  budget_min: number | null;
  budget_max: number | null;
  estimate_min: number | null;
  estimate_max: number | null;
  desired_timing: string;
  city: string;
  categoryName: string;
}

export interface ScoreCompany {
  price_band_min: number;
  price_band_max: number;
  lead_time_weeks: number;
  rating_avg: number;
  review_count: number;
  avg_response_minutes: number;
  self_construction: number;
  worksInCategory: number;
}

export interface ScoreResult {
  score: number;
  reasons: string[];
}

function overlapRatio(aMin: number, aMax: number, bMin: number, bMax: number) {
  const lo = Math.max(aMin, bMin);
  const hi = Math.min(aMax, bMax);
  if (hi < lo) return 0;
  const span = Math.max(1, Math.min(aMax - aMin, bMax - bMin));
  return Math.min(1, (hi - lo) / span);
}

export function scoreCompany(p: ScoreProject, c: ScoreCompany): ScoreResult {
  const reasons: string[] = [`対応地域（${p.city}）`];
  let score = 50;

  // Budget fit (uses customer's budget, or the reference estimate if they don't know)
  const bMin = p.budget_min ?? p.estimate_min;
  const bMax = p.budget_max ?? p.estimate_max ?? (bMin != null ? bMin * 2 : null);
  if (bMin != null && bMax != null && c.price_band_max > 0) {
    const r = overlapRatio(bMin, bMax, c.price_band_min, c.price_band_max);
    score += Math.round(15 * r);
    if (r >= 0.5) reasons.push(p.budget_min != null ? "希望予算帯" : "相場に合った価格帯");
  } else {
    score += 8;
  }

  // Track record in this category
  const w = c.worksInCategory;
  score += w >= 50 ? 12 : w >= 20 ? 9 : w >= 5 ? 6 : 2;
  if (w >= 20) reasons.push(`${p.categoryName}の実績多数`);
  else if (w >= 5) reasons.push(`${p.categoryName}の実績あり`);

  // Timing
  const t = TIMINGS.find((x) => x.value === p.desired_timing);
  const weeks = t?.weeks ?? 52;
  if (c.lead_time_weeks <= weeks) {
    score += 8;
    reasons.push("希望時期対応可能");
  } else {
    score += 2;
  }

  // Reviews
  if (c.review_count === 0) score += 3;
  else if (c.rating_avg >= 4.5) {
    score += 8;
    reasons.push(`口コミ評価 ${c.rating_avg.toFixed(1)}`);
  } else if (c.rating_avg >= 4) score += 6;
  else if (c.rating_avg >= 3.5) score += 4;

  // Responsiveness
  if (c.avg_response_minutes <= 60) {
    score += 5;
    reasons.push("返信が早い");
  } else if (c.avg_response_minutes <= 180) score += 3;
  else score += 1;

  if (c.self_construction) {
    score += 2;
    reasons.push("自社施工");
  }

  return { score: Math.max(1, Math.min(99, score)), reasons };
}
