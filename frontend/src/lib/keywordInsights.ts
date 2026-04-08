import type { Keyword } from "../types";

export type KeywordSegment = "Hero" | "Hub" | "Hygiene";
export type KeywordScoreContext = {
  plannerTopCpcCutoff: number;
  adsAverageCtr: number;
  adsHighSpendCutoff: number;
  searchConsoleHighImpressionsCutoff: number;
};

const CLINIC_TERMS = /(クリニック|医院|의원|클리닉|clinic|皮膚科)/i;
const OWN_BRAND_TERMS = /(セイェ|セイエ|seye|세예)/i;
const GENERIC_TOKENS = new Set([
  "韓国",
  "江南",
  "明洞",
  "美容",
  "皮膚科",
  "クリニック",
  "医院",
  "店",
  "clinic",
  "seoul",
  "gangnam",
  "myeongdong",
  "beauty",
  "skin",
  "dermatology",
  "한국",
  "강남",
  "명동",
  "미용",
  "피부과",
  "의원",
  "클리닉",
]);

export function translateKeywordToKorean(keyword: string): string {
  const replacements: Array<[RegExp, string]> = [
    [/セイェクリニック/gi, "세예클리닉"],
    [/セイエクリニック/gi, "세예클리닉"],
    [/seye clinic/gi, "세예클리닉"],
    [/クリニック/gi, "클리닉"],
    [/医院/gi, "의원"],
    [/明 洞 店/gi, "명동점"],
    [/明洞/gi, "명동"],
    [/江南/gi, "강남"],
    [/韓国/gi, "한국"],
    [/人気/gi, "인기"],
    [/糸 リフト/gi, "실리프팅"],
    [/リフト/gi, "리프팅"],
    [/無痛/gi, "무통"],
    [/リジュラン/gi, "리쥬란"],
    [/ウルセラ/gi, "울쎄라"],
    [/セルディエム/gi, "셀디엠"],
    [/リトゥオ/gi, "리투오"],
    [/セカジソウォン/gi, "세가지소원"],
    [/フォルテ/gi, "포르테"],
    [/値段|料金/gi, "가격"],
    [/効果/gi, "효과"],
    [/持続期間/gi, "유지기간"],
    [/痛み/gi, "통증"],
    [/ダウンタイム/gi, "다운타임"],
    [/比較|違い|vs/gi, "비교"],
    [/人気/gi, "인기"],
    [/おすすめ/gi, "추천"],
    [/口コミ/gi, "후기"],
    [/副作用/gi, "부작용"],
    [/予約/gi, "예약"],
    [/何ショット/gi, "몇 샷"],
    [/目の下/gi, "눈밑"],
  ];

  let translated = keyword;
  replacements.forEach(([pattern, replacement]) => {
    translated = translated.replace(pattern, replacement);
  });

  translated = translated
    .replace(/\s+/g, " ")
    .replace(/\s+점/g, "점")
    .trim();

  if (translated === keyword) {
    return "한국어 해석 준비 중";
  }

  const hasJapaneseLeftover = /[\u3040-\u30ff\u4e00-\u9faf]/.test(translated);
  if (hasJapaneseLeftover) {
    const normalized = translated
      .replace(/クリニック/gi, "클리닉")
      .replace(/医院/gi, "의원")
      .replace(/店/gi, "점")
      .replace(/\s+/g, " ")
      .trim();
    return normalized;
  }

  return translated;
}

export function getKeywordSegment(keyword: Keyword): KeywordSegment {
  // Prefer server-computed intent if available
  if (keyword.intent_segment) {
    const map: Record<string, KeywordSegment> = { hero: "Hero", hub: "Hub", hygiene: "Hygiene" };
    return map[keyword.intent_segment] ?? "Hygiene";
  }
  const text = keyword.keyword.toLowerCase();
  if (/(비용|가격|料金|値段|予約|상담|package|패키지|event|이벤트)/i.test(text)) {
    return "Hero";
  }
  if (/(비교|比較|違い|vs|추천|おすすめ)/i.test(text)) {
    return "Hub";
  }
  if (/(원인|原因|관리|ケア|후기|口コミ|부작용|副作用|faq|faq|주의|注意)/i.test(text)) {
    return "Hygiene";
  }
  if (
    keyword.source === "google_ads" &&
    ((keyword.conversions ?? 0) > 0 || (keyword.avg_cpc ?? 0) >= 500)
  ) {
    return "Hero";
  }

  if (
    /(vs|比較|違い|効果|持続|痛み|ダウンタイム|値段|料金|何ショット)/i.test(text)
  ) {
    return "Hub";
  }

  return "Hygiene";
}

export function getKeywordRecommendation(keyword: Keyword): string {
  const segment = getKeywordSegment(keyword);
  if (keyword.source === "search_console" && (keyword.position ?? 999) >= 11 && (keyword.position ?? 999) <= 30) {
    return "이미 노출은 잡히지만 상위권 직전이라 신규 발행보다 리라이팅 우선 후보로 보는 편이 좋습니다.";
  }
  if (keyword.source === "google_ads" && (keyword.conversions ?? 0) > 0) {
    return "광고 전환이 확인된 키워드라 Hero 주제 또는 랜딩 최적화 우선 후보로 다루기 좋습니다.";
  }
  if (segment === "Hero") {
    return "고전환 가능성이 보여 예약·상담 CTA를 강하게 넣는 랜딩형 주제로 우선 검토합니다.";
  }
  if (segment === "Hub") {
    return "비교·가격·효과 판단을 돕는 중간 의사결정형 콘텐츠로 적합합니다.";
  }
  return "정보형·FAQ형으로 신뢰를 쌓고 상위 비교/전환 글로 내부 링크를 보내기 좋습니다.";
}

function percentile(values: number[], fraction: number): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.max(0, Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * fraction)));
  return sorted[index];
}

export function buildKeywordScoreContext(keywords: Keyword[]): KeywordScoreContext {
  const plannerCpcs = keywords
    .filter((item) => item.source === "keyword_planner")
    .map((item) => Number(item.avg_cpc ?? 0))
    .filter((value) => value > 0);
  const adsCtrValues = keywords
    .filter((item) => item.source === "google_ads")
    .map((item) => Number(item.ctr ?? 0))
    .filter((value) => value >= 0);
  const adsSpendValues = keywords
    .filter((item) => item.source === "google_ads")
    .map((item) => Number(item.spend ?? 0))
    .filter((value) => value > 0);
  const gscImpressions = keywords
    .filter((item) => item.source === "search_console")
    .map((item) => Number(item.impressions ?? 0))
    .filter((value) => value > 0);

  return {
    plannerTopCpcCutoff: percentile(plannerCpcs, 0.8),
    adsAverageCtr: adsCtrValues.length ? adsCtrValues.reduce((sum, value) => sum + value, 0) / adsCtrValues.length : 0,
    adsHighSpendCutoff: percentile(adsSpendValues, 0.7),
    searchConsoleHighImpressionsCutoff: percentile(gscImpressions, 0.7),
  };
}

export function getKeywordPriorityScore(keyword: Keyword, context?: KeywordScoreContext): number {
  // Prefer server-computed score if available
  if (keyword.weighted_score != null) return keyword.weighted_score;
  const segment = getKeywordSegment(keyword);
  let score = segment === "Hero" ? 10 : segment === "Hub" ? 6 : 4;

  if (keyword.source === "keyword_planner") {
    score += 50;
    const volume = Number(keyword.search_volume ?? 0);
    const cpc = Number(keyword.avg_cpc ?? 0);
    if (volume >= 10 && volume <= 500) score += 12;
    else if (volume > 500) score += 6;
    if ((keyword.competition_level ?? "").toUpperCase() === "HIGH") score += 6;
    else if ((keyword.competition_level ?? "").toUpperCase() === "MEDIUM") score += 3;
    if (context && cpc >= context.plannerTopCpcCutoff && cpc > 0) score += 18;
  }

  if (keyword.source === "search_console") {
    score += 30;
    const impressions = Number(keyword.impressions ?? 0);
    const delta = Number(keyword.impression_delta_pct ?? 0);
    const position = Number(keyword.position ?? 999);
    if (delta >= 20) score += 16;
    if (position >= 11 && position <= 30) score += 16;
    else if (position <= 10) score += 7;
    if (context && impressions >= context.searchConsoleHighImpressionsCutoff) score += 8;
  }

  if (keyword.source === "google_ads") {
    score += 20;
    const conversions = Number(keyword.conversions ?? 0);
    const ctr = Number(keyword.ctr ?? 0);
    const spend = Number(keyword.spend ?? 0);
    if (conversions > 0) score += 20;
    if (context && ctr >= context.adsAverageCtr && ctr > 0) score += 10;
    if (context && spend >= context.adsHighSpendCutoff && spend > 0) score += 8;
  }

  return score;
}

export function isCompetitorClinicKeyword(keyword: string): boolean {
  if (!CLINIC_TERMS.test(keyword) || OWN_BRAND_TERMS.test(keyword)) {
    return false;
  }

  const normalized = keyword
    .replace(/[+/:,()\-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const tokens = normalized.split(" ").filter(Boolean);
  const meaningfulTokens = tokens.filter((token) => {
    if (GENERIC_TOKENS.has(token)) {
      return false;
    }
    if (/^\d+$/.test(token)) {
      return false;
    }
    if (/(効果|値段|料金|比較|違い|痛み|ダウンタイム|口コミ|副作用|おすすめ|人気|予約|何ショット|リフト|リジュラン|ウルセラ|셀디엠|리투오|리쥬란|울쎄라)/i.test(token)) {
      return false;
    }
    return true;
  });

  return meaningfulTokens.length > 0;
}
