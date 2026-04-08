CREATE TABLE keywords (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  keyword TEXT NOT NULL,
  source TEXT NOT NULL,
  parent_keyword TEXT,
  search_volume INTEGER,
  competition_level TEXT,
  competition_index NUMERIC(3,2),
  avg_cpc NUMERIC(10,2),
  conversions INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  conversion_rate NUMERIC(5,2),
  impressions INTEGER,
  ctr NUMERIC(5,2),
  position NUMERIC(6,2),
  language_code TEXT DEFAULT 'ja',
  geo_target TEXT DEFAULT 'JP',
  status TEXT DEFAULT 'pending',
  weighted_score NUMERIC(10,2),
  weight_multiplier NUMERIC(4,2) DEFAULT 1.0,
  intent_segment TEXT,
  opportunity_flag TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  fetched_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE blog_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  keyword_id UUID REFERENCES keywords(id),
  keyword TEXT NOT NULL,
  title TEXT,
  content TEXT,
  meta_description TEXT,
  target_language TEXT DEFAULT 'ja',
  prompt_used TEXT,
  status TEXT DEFAULT 'draft',
  published_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE seed_expansion_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country TEXT NOT NULL,
  procedure_name TEXT NOT NULL,
  region TEXT,
  seed_keywords TEXT[],
  is_active BOOLEAN DEFAULT TRUE,
  last_run_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE content_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  url TEXT UNIQUE,
  keyword TEXT,
  title TEXT,
  intent_segment TEXT,
  published_at TIMESTAMPTZ,
  last_checked_at TIMESTAMPTZ,
  status TEXT DEFAULT 'active'
);

CREATE TABLE keyword_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  keyword_id UUID REFERENCES keywords(id),
  impressions INTEGER,
  position NUMERIC(6,2),
  snapshot_date DATE DEFAULT CURRENT_DATE
);
