const SELECTED_KEYWORDS_KEY = "gkw:selected-keyword-ids";

export function loadSelectedKeywordIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(SELECTED_KEYWORDS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

export function saveSelectedKeywordIds(ids: string[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SELECTED_KEYWORDS_KEY, JSON.stringify(ids));
}

export function clearSelectedKeywordIds() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(SELECTED_KEYWORDS_KEY);
}
