// 参考相場の算出。AI診断ではなく「参考相場＋事前整理」として表示する。
// Pure function so it can run on both client (diagnosis result) and server.

export interface EstimateInput {
  priceMin: number;
  priceMax: number;
  houseType: string;
  buildingAge: number | null;
}

export interface EstimateResult {
  min: number;
  max: number;
  notes: string[];
}

const roundTo = (n: number, step = 10000) => Math.round(n / step) * step;

export function estimateRange(input: EstimateInput): EstimateResult {
  let lo = input.priceMin;
  let hi = input.priceMax;
  const notes: string[] = [];

  if (input.houseType === "マンション" || input.houseType === "アパート・集合住宅") {
    notes.push("集合住宅の場合、共用部の工事は管理組合の承認が必要になることがあります。");
  }
  if (input.houseType === "店舗・事務所") {
    hi = hi * 1.2;
    notes.push("店舗・事務所は営業時間に合わせた施工調整で費用が変わることがあります。");
  }
  if (input.buildingAge != null) {
    if (input.buildingAge >= 30) {
      hi = hi * 1.2;
      notes.push("築30年以上の場合、下地補修などで費用が上がる可能性があります。");
    } else if (input.buildingAge >= 20) {
      hi = hi * 1.1;
      notes.push("築20年前後は、下地の状態によって補修費が加わることがあります。");
    } else if (input.buildingAge < 10) {
      lo = lo * 0.95;
    }
  }
  notes.push("正式な金額は現地確認後に変動します。");
  return { min: roundTo(lo), max: roundTo(hi), notes };
}
