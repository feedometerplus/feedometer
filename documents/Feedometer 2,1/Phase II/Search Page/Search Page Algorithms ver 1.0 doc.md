# FeedOmeter 2.1 — Search Page & News Discovery Intelligence
**Architectural Design Document • Version 1.0 • September 2026**
*Target System: Cloudflare Edge (Workers, D1 SQLite FTS5, KV, Vectorize, Workers AI)*

---

## 1. Executive Overview & Paradigm Shift

Traditional RSS readers (such as Feedly, Inoreader, and NewsBlur) treat search as a simple keyword lookup utility over static feed subscription lists:
$$\text{Feeds} \longrightarrow \text{Articles} \longrightarrow \text{Keyword Filter} \longrightarrow \text{Read}$$

FeedOmeter 2.1 shifts this architecture into a **Real-Time News Discovery & Content Intelligence Platform**:
$$\text{Topics \& Companies} \longrightarrow \text{Semantic Discovery} \longrightarrow \text{Smart Tracking} \longrightarrow \text{Intelligence Hubs}$$

Users are provided with high-precision BM25 relevance scoring, contextual match explanations, deduplicated multi-source story clustering, real-time company monitoring, and sub-20ms autocomplete.

---

## 2. Database Architecture & Schema Additions (Cloudflare D1)

To deliver this engine without inflating infrastructure costs, we introduce targeted, lean schema additions to our Cloudflare D1 SQLite database:

```sql
-- ==============================================================================
-- FEEDOMETER 2.1 — COMPLETE SEARCH & INTELLIGENCE DOMAIN
-- Database: feedometer-db (Cloudflare D1 SQLite Engine)
-- ==============================================================================

-- 1. Explicit Authority Score Enhancement for Publishers
ALTER TABLE publishers ADD COLUMN authority_score INTEGER DEFAULT 50;

-- 2. High-Performance FTS5 Search Virtual Table
-- (Title, author, snippet, source_name are full-text indexed; metadata is UNINDEXED)
CREATE VIRTUAL TABLE IF NOT EXISTS article_search USING fts5(
  article_id UNINDEXED,
  published_at UNINDEXED,
  language UNINDEXED,
  title,
  author,
  snippet,
  source_name,
  category,
  tokenize = 'porter unicode61'
);

-- 3. Dedicated Sub-20ms Search Suggestions (Autocomplete Engine)
CREATE TABLE IF NOT EXISTS search_suggestions (
  term TEXT PRIMARY KEY,
  search_count INTEGER DEFAULT 0,
  click_count INTEGER DEFAULT 0,
  updated_at INTEGER NOT NULL
);

-- 4. Saved Searches (High-Retention Custom Workspaces & Power Filters)
CREATE TABLE IF NOT EXISTS saved_searches (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT,
  search_query TEXT NOT NULL,
  filters_json TEXT, -- e.g. {"category":"Tech","source_id":"src_theverge","language":"en"}
  created_at INTEGER NOT NULL,
  last_used_at INTEGER,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 5. Keyword Alerts & Continuous Feed Monitoring
CREATE TABLE IF NOT EXISTS keyword_alerts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  keyword TEXT NOT NULL,
  is_active INTEGER DEFAULT 1 CHECK(is_active IN (0, 1)),
  notification_channel TEXT DEFAULT 'in_app' CHECK(notification_channel IN ('in_app', 'email', 'both')),
  last_notified_at INTEGER,
  match_count INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 6. Raw Search Query Logging (Volume, Latency & Zero-Result Discovery)
CREATE TABLE IF NOT EXISTS search_queries (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  query TEXT NOT NULL,
  normalized_query TEXT NOT NULL,
  result_count INTEGER DEFAULT 0,
  execution_ms INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- 7. Search Click Tracking (CTR & Relevance Feedback Loop)
CREATE TABLE IF NOT EXISTS search_clicks (
  id TEXT PRIMARY KEY,
  query_id TEXT,
  user_id TEXT,
  article_id TEXT NOT NULL,
  rank_position INTEGER NOT NULL,
  clicked_at INTEGER NOT NULL,
  FOREIGN KEY (query_id) REFERENCES search_queries(id) ON DELETE SET NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE CASCADE
);

-- ==============================================================================
-- COVERING B-TREE INDEXES FOR SEARCH
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_search_suggestions_count ON search_suggestions(search_count DESC);
CREATE INDEX IF NOT EXISTS idx_saved_searches_user ON saved_searches(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_keyword_alerts_user ON keyword_alerts(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_keyword_alerts_keyword ON keyword_alerts(keyword);
CREATE INDEX IF NOT EXISTS idx_search_queries_normalized ON search_queries(normalized_query, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_search_queries_created ON search_queries(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_search_clicks_query ON search_clicks(query_id);
CREATE INDEX IF NOT EXISTS idx_search_clicks_article ON search_clicks(article_id);
```

---

## 3. End-to-End Query Execution Pipeline

```
  1. USER INPUT: '("AI" OR "LLM") source:theverge -crypto'
         │
         ▼
  2. PARSE & VALIDATE (boolean-parser.js in Cloudflare Worker)
     ├── Match Term: ("AI" OR "LLM") NOT "crypto"
     └── Filter Clauses: source = "theverge", lang = "en"
         │
         ▼
  3. FTS5 FILTER & CANDIDATE SCORING (Zero Content Join)
     SELECT article_id, published_at, bm25(article_search, 10.0, 1.0, 5.0, 2.0) AS rank
     FROM article_search
     WHERE article_search MATCH 'title:"AI" OR title:"LLM" NOT "crypto"'
       AND language = 'en'
     ORDER BY rank
     LIMIT 50;
         │
         ▼
  4. HYBRID RE-RANKING IN WORKER MEMORY (Top 50 Slice)
     Final Score = (0.50 * BM25) + (0.20 * Freshness) + (0.15 * Authority) + (0.15 * CTR)
         │
         ▼
  5. HYDRATION JOIN (Only Top 20 Paginated Items)
     JOIN articles a ON a.id = candidate.article_id
     JOIN sources s ON s.id = a.source_id
     LEFT JOIN publishers p ON p.domain = s.publisher_domain
         │
         ▼
  6. STORY CLUSTERING & EXPLANATION BADGING
     ├── Attach "Why This Result?" badges
     └── Group syndications (Cosine > 0.92) into single cluster card
         │
         ▼
  7. CLIENT RESPONSE (< 65ms JSON)
```

---

## 4. Precision-First Hybrid Ranking Formula

$$\text{Final Score} = 0.50 \cdot S_{\text{BM25}} + 0.20 \cdot S_{\text{Freshness}} + 0.15 \cdot S_{\text{Authority}} + 0.15 \cdot S_{\text{Engagement}}$$

### Sub-Score Formulas:
1. **$S_{\text{BM25}}$ (50%)**: SQLite FTS5 BM25 with column weights: `title (10.0)`, `snippet (5.0)`, `author (2.0)`, `source_name (1.0)`.
2. **$S_{\text{Freshness}}$ (20%)**: Exponential decay $e^{-\lambda \Delta t}$:
   * $< 6\text{h} \to 1.0$ | $< 24\text{h} \to 0.85$ | $< 3\text{d} \to 0.60$ | $< 30\text{d} \to 0.25$
3. **$S_{\text{Authority}}$ (15%)**: Normalized publisher trust:
   $$S_{\text{Authority}} = \frac{\text{publishers.authority\_score}}{100}$$
4. **$S_{\text{Engagement}}$ (15%)**: CTR and interaction history:
   $$S_{\text{Engagement}} = \min\left(1.0, \frac{\text{Clicks} \times 2 + \text{Stars} \times 5 + \text{Saves} \times 3}{100}\right)$$

---

## 5. Key Differentiating Features

### A. "Why This Result?" Transparency Badges
Every result card explains its rank position clearly:
```
┌────────────────────────────────────────────────────────────────────────┐
│ 📰 Anthropic Releases Claude 3.7 Sonnet with Hybrid Reasoning          │
│ TechCrunch • 2h ago • by Frederic Lardinois                            │
│                                                                        │
│ 🏷️ Why this result:                                                   │
│ [✓ Exact match in title] [✓ Verified Source: 95 Authority] [🔥 +82% CTR]│
└────────────────────────────────────────────────────────────────────────┘
```

### B. Accurate Multi-Source Story Clustering
Using Title MinHash fingerprinting and Cloudflare Vectorize embedding cosine similarity ($>0.92$), syndicated wire news stories are consolidated into a single card with publisher source pills: `[The Verge]` `[TechCrunch]` `[Wired]` `[Ars Technica]`.

### C. Advanced Power Search Operators
* `term1 term2` $\to$ Implicit AND
* `"machine learning"` $\to$ Exact phrase match
* `AI -crypto` or `AI NOT crypto` $\to$ Exclusion
* `source:theverge` $\to$ Filter by feed source
* `author:"mark gurman"` $\to$ Filter by writer
* `category:tech` $\to$ Filter by taxonomy desk
* `lang:en` $\to$ Filter by ISO language
* `after:2026-01-01` $\to$ Date range filter

### D. Sub-20ms Autocomplete Engine
Instant prefix matching from the `search_suggestions` table as the user types, ranking terms by historical search and click frequency.

### E. Company & Topic Intelligence Hubs (Phase 4)
Dynamic routes like `/companies/openai` or `/topics/cybersecurity` render real-time volume velocity (today vs. 7-day average), top voices, deduplicated timelines, and 1-click watchlist monitoring.

---

## 6. Phased Implementation Roadmap

| Phase | Deliverables & Scope | Tech Stack & Latency Target |
| :--- | :--- | :--- |
| **Phase 1: High-Precision Core Search** | • D1 FTS5 virtual table (`article_search`) with UNINDEXED metadata<br>• Ingestion indexer in `services/article-repository.js`<br>• Search API Worker (`/api/search`) with 50% BM25 hybrid ranking<br>• AST boolean parser translation to FTS5 MATCH queries<br>• `search_queries` & `search_clicks` telemetry logging | Cloudflare D1 + Workers (< 65ms) |
| **Phase 2: Saved Workspaces & Alerts** | • `saved_searches` CRUD endpoints & UI sidebar integration<br>• `search_suggestions` table with sub-20ms prefix autocomplete<br>• `keyword_alerts` continuous feed background cron worker<br>• "Why This Result?" explainability badge generation | D1 + KV + Cron Triggers (< 20ms Autocomplete) |
| **Phase 3: Semantic Intent Discovery** | • Workers AI embeddings (`@cf/baai/bge-base-en-v1.5`) for title/snippet<br>• Cloudflare Vectorize integration<br>• 70/30 hybrid lexical-semantic blending<br>• Synonyms & intent expansion | Workers AI + Vectorize (< 120ms) |
| **Phase 4: Content Intelligence Hubs** | • Multi-source story clustering (Cosine $> 0.92$)<br>• Dedicated Company & Topic Hub pages (`/companies/:slug`, `/topics/:slug`)<br>• Mention velocity charts & trending alerts | Workers AI + D1 + Edge Cache |

---

## 7. Scalability & Operational Runway

| Scale Tier | Architecture & Storage Strategy | Monthly Infrastructure Cost |
| :--- | :--- | :--- |
| **0 to 3 Million Articles** | Cloudflare D1 + SQLite FTS5 (Indexing title/snippet only; aggressive retention pruning; batch write ingestion). | **$0 – $5 / month** |
| **3M to 10 Million Articles** | Cloudflare D1 (Source of Truth) + Cloudflare Vectorize (Distributed vector index on edge). | **$15 – $35 / month** |
| **10M+ Enterprise Articles** | Cloudflare D1 + Dedicated Typesense / Meilisearch cluster on Cloudflare Container / VPS. | **Standard VPS Pricing** |
