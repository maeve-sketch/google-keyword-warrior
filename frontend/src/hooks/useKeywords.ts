import { useCallback, useEffect, useState } from "react";
import { fetchKeywords, runKeywordFetch, updateKeywordStatus } from "../lib/api";
import { clearSelectedKeywordIds } from "../lib/workflowState";
import type { Keyword } from "../types";

type FetchFeedback = {
  kind: "loading" | "success" | "error";
  title: string;
  description: string;
};

export function useKeywords() {
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string>("");
  const [fetchFeedback, setFetchFeedback] = useState<FetchFeedback | null>(null);
  const [lastFetchedAt, setLastFetchedAt] = useState<string>("");
  const [lastInsertedCount, setLastInsertedCount] = useState(0);

  const [language, setLanguage] = useState("ja");
  const [dateRange, setDateRange] = useState("30d");
  const [minSearchVolume, setMinSearchVolume] = useState(10);
  const [searchConsoleMinImpressions, setSearchConsoleMinImpressions] = useState(100);
  const [adsMinClicks, setAdsMinClicks] = useState(10);
  const [adsMinSpend, setAdsMinSpend] = useState(0);
  const [plannerSeedText, setPlannerSeedText] = useState("");

  const load = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const data = await fetchKeywords({ lang: language });
      setKeywords(data.keywords);
    } catch (err) {
      setError(err instanceof Error ? err.message : "키워드 로드 실패");
    } finally {
      setIsLoading(false);
    }
  }, [language]);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setIsRefreshing(true);
    setError("");
      setFetchFeedback({
        kind: "loading",
        title: "키워드 수집을 시작했습니다",
        description: "Google Ads, Keyword Planner, Search Console 데이터를 차례로 불러오는 중입니다.",
      });
    try {
      const fetchResult = await runKeywordFetch({
        language,
        dateRange,
        minSearchVolume,
        searchConsoleMinImpressions,
        adsMinClicks,
        adsMinSpend,
        includeHighCompetition: true,
        plannerSeeds: plannerSeedText
          .split(/\n|,/)
          .map((item) => item.trim())
          .filter(Boolean),
      });
      setFetchFeedback({
        kind: "loading",
        title: "데이터를 정리하고 있습니다",
        description: "불러온 키워드를 목록 형식으로 정리해서 화면에 반영하는 중입니다.",
      });
      const data = await fetchKeywords({ lang: language });
      setKeywords(data.keywords);
      clearSelectedKeywordIds();
      setLastInsertedCount(fetchResult.inserted ?? data.total ?? 0);
      const now = new Date();
      setLastFetchedAt(now.toLocaleString("ko-KR"));
      setFetchFeedback({
        kind: "success",
        title: "키워드를 정상적으로 불러왔습니다",
        description: `${fetchResult.inserted ?? data.total ?? 0}건을 반영했고, 현재 화면에는 ${data.total}건이 보입니다. Google Ads ${fetchResult.breakdown?.google_ads ?? 0}건, Keyword Planner ${fetchResult.breakdown?.keyword_planner ?? 0}건, Search Console ${fetchResult.breakdown?.search_console ?? 0}건입니다.${fetchResult.warnings?.length ? ` 주의: ${fetchResult.warnings[0]}` : ""}`,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "키워드 수집 실패";
      setError(message);
      setFetchFeedback({
        kind: "error",
        title: "키워드 불러오기에 실패했습니다",
        description: message,
      });
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [adsMinClicks, adsMinSpend, dateRange, language, minSearchVolume, plannerSeedText, searchConsoleMinImpressions]);

  const changeStatus = useCallback(async (keywordId: string, status: string) => {
    await updateKeywordStatus(keywordId, status);
    await load();
  }, [load]);

  useEffect(() => {
    void load();
  }, [load]);

  return {
    keywords,
    isLoading,
    isRefreshing,
    error,
    refresh,
    changeStatus,
    language,
    setLanguage,
    dateRange,
    setDateRange,
    minSearchVolume,
    setMinSearchVolume,
    searchConsoleMinImpressions,
    setSearchConsoleMinImpressions,
    adsMinClicks,
    setAdsMinClicks,
    adsMinSpend,
    setAdsMinSpend,
    plannerSeedText,
    setPlannerSeedText,
    fetchFeedback,
    lastFetchedAt,
    lastInsertedCount,
  };
}
