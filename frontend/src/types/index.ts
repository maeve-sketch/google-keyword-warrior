export type Keyword = {
  id: string;
  keyword: string;
  source: "google_ads" | "keyword_planner" | "search_console";
  parent_keyword?: string | null;
  search_volume?: number | null;
  competition_level?: string | null;
  competition_index?: number | null;
  avg_cpc?: number | null;
  conversions?: number;
  clicks?: number;
  conversion_rate?: number;
  impressions?: number;
  previous_impressions?: number;
  impression_delta_pct?: number;
  ctr?: number;
  position?: number;
  spend?: number;
  language_code?: string;
  geo_target?: string;
  status?: string;
  weighted_score?: number | null;
  weight_multiplier?: number | null;
  intent_segment?: "hero" | "hub" | "hygiene" | null;
  opportunity_flag?: "new_opportunity" | "rewrite_candidate" | "hero_locked" | null;
};

export type BlogPost = {
  id: string;
  keyword_id?: string;
  keyword: string;
  title?: string;
  content?: string;
  meta_description?: string;
  prompt_used?: string;
  status?: string;
  created_at?: string;
  updated_at?: string;
};

export type SeedExpansionConfig = {
  id: string;
  country: string;
  procedure_name: string;
  region?: string;
  seed_keywords?: string[];
  is_active: boolean;
  last_run_at?: string;
  created_at?: string;
};

export type ContentInventoryItem = {
  id: string;
  url?: string;
  keyword?: string;
  title?: string;
  intent_segment?: "hero" | "hub" | "hygiene";
  published_at?: string;
  last_checked_at?: string;
  status?: string;
};
