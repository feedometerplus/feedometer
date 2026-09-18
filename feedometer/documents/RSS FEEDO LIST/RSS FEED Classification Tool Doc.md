# RSS Feed Administration & Classification Tool

## 1. Executive Summary & Purpose
Create a standalone **Admin Tool** used to discover, validate, classify, organize, and export a massive catalog of **1,500+ genuine RSS feeds**.
This tool is completely independent of the end-user RSS Aggregator product. Its output is consumed by the RSS product later through exported CSV metadata files.

---

## 2. Setup & Environment Configuration

### Target Path
`C:\RSSAdmin`

### PowerShell Setup Steps
1. **Create Project Directory:**
   ```powershell
   mkdir C:\RSSAdmin
   cd C:\RSSAdmin
   ```
2. **Create & Activate Virtual Environment:**
   ```powershell
   Set-ExecutionPolicy -Scope Process -ExecutionPolicy RemoteSigned
   python -m venv venv
   .\venv\Scripts\Activate.ps1
   ```
3. **Upgrade Pip & Install Core Dependencies:**
   ```powershell
   python -m pip install --upgrade pip
   pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu
   pip install transformers feedparser requests fastapi uvicorn python-multipart
   ```
4. **Verify NLP / DistilBERT Pipeline (`test.py`):**
   ```python
   from transformers import pipeline

   classifier = pipeline(
       "zero-shot-classification",
       model="typeform/distilbert-base-uncased-mnli"
   )
   print("DistilBERT Zero-Shot Classifier Loaded Successfully")
   ```
5. **Verify Database Connection (`sqlite_test.py`):**
   ```python
   import sqlite3

   conn = sqlite3.connect("feeds.db")
   print("SQLite Database Ready")
   ```

---

## 3. System Architecture & Tech Stack

```
Windows Machine (C:\RSSAdmin)
  ├── Frontend: HTML5, Modern CSS, Vanilla JavaScript (Single Page Dashboard)
  ├── Backend Server: Python 3.12 (FastAPI + Uvicorn)
  ├── Storage: SQLite (`feeds.db` with 1,500+ entries & 13 audit columns)
  ├── Feed Engine: High-Speed Concurrent Multi-Threaded Validator (30 workers)
  ├── Classification Engine: DistilBERT (Zero-Shot) + Domain Rules Engine
  └── Data Export: Two-Tier CSV (Category & Sub-Category / Category, Sub-Category & Publisher)
```

---

## 4. Comprehensive Taxonomy (12 Primary Pillars & 60+ Sub-Categories)

| # | Primary Category | Sub-Categories Included |
| :---: | :--- | :--- |
| **1** | **Technology** | `Artificial Intelligence`, `Machine Learning`, `Data Science`, `Cybersecurity`, `Programming`, `Software Development`, `DevOps`, `Cloud Computing`, `Open Source`, `General Tech` |
| **2** | **Business & Finance** | `Markets`, `Investing`, `Banking`, `Finance`, `Personal Finance`, `Cryptocurrency`, `Startups`, `Entrepreneurship` |
| **3** | **Science & Biotech** | `Space`, `Biotechnology`, `Health`, `Medicine`, `Environment`, `Energy`, `Climate`, `Weather` |
| **4** | **Sports** | `Cricket`, `Football`, `Soccer`, `Tennis`, `Basketball`, `Baseball`, `Motorsports`, `General Sports` |
| **5** | **Entertainment** | `Movies`, `Television`, `Streaming`, `Music`, `Celebrities`, `Books`, `Podcasting` |
| **6** | **Gaming** | `Esports`, `PC Gaming`, `Console Gaming`, `Mobile Gaming` |
| **7** | **Politics & Government** | `World News`, `National News`, `Government`, `Public Policy`, `Legal` |
| **8** | **Education & Academics** | `Universities`, `Research`, `E-Learning` |
| **9** | **Lifestyle & Culture** | `Travel`, `Lifestyle`, `Food`, `Fashion`, `Photography`, `Culture`, `History`, `Religion` |
| **10** | **Automotive & Mobility** | `Automotive`, `Electric Vehicles`, `Transportation`, `Aviation` |
| **11** | **Real Estate & Living** | `Real Estate`, `Architecture` |
| **12** | **Industry & Commerce** | `Retail`, `E-Commerce`, `Manufacturing`, `Supply Chain`, `Logistics`, `Agriculture`, `Telecommunications`, `Defense` |

---

## 5. Database Design (SQLite `feeds.db`)

### Table: `feeds` (1,500+ Records)
```sql
CREATE TABLE IF NOT EXISTS feeds (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category TEXT,
    sub_category TEXT,
    publisher TEXT,
    feed_name TEXT NOT NULL,
    feed_url TEXT UNIQUE NOT NULL,
    status TEXT CHECK(status IN ('Valid', 'Invalid', 'Review Required')),
    confidence_score REAL,
    classification_method TEXT,
    article_count INTEGER DEFAULT 0,
    validation_details TEXT,
    validation_date DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

---

## 6. Functional Pipeline & UI Button Workflows

```
[ Popular Feeds ] ──► 1,500+ Feeds Discovery & Strict URL Deduplication
                            │
                            ▼
[ Validate ]      ──► Concurrent 30-Worker ThreadPool Validation (HTTPS, Format, Recency, Count)
                            │
                            ▼
[ Classify ]      ──► Two-Tier Classification (DistilBERT + Rules for Category & Sub-Category)
                            │
                            ▼
[ By Name ]       ──► 4-Level Hierarchy (Category ➔ Sub-Category ➔ Publisher ➔ Feed)
                            │
                            ▼
[ Export ]        ──► Two-Tier CSV Generation (Instant File Download)
```

### 1. Popular Feeds
- Discovers **1,500+ genuine feeds** across all 12 primary categories and 80+ sub-categories.
- Removes duplicates automatically.

### 2. Validate (High-Speed Concurrent)
- 30 parallel worker threads check reachability, HTTPS, XML validity, and recency in seconds.

### 3. Classify (Two-Tier)
- DistilBERT Zero-Shot NLP combined with fine-grained rules tags both Category and Sub-Category with confidence scores.

### 4. By Name (Hierarchy View)
- Renders full 4-level tree: `Category ➔ Sub-Category ➔ Publisher ➔ Feed`.

### 5. Export
- **Format 1: Export by Category & Sub-Category** (`Category,SubCategory,FeedName,FeedURL`)
- **Format 2: Export by Category, Sub-Category & Publisher** (`Category,SubCategory,Publisher,FeedName,FeedURL`)

---

## 7. How to Launch & Use the Tool

### Option A: One-Click Launcher (Easiest)
- Double-click **`C:\RSSAdmin\run.bat`** in Windows File Explorer.
- The dashboard opens automatically at **`http://127.0.0.1:8000`**.

### Option B: PowerShell
```powershell
cd C:\RSSAdmin
.\run.ps1
```

---

## 8. Diagnostic & Verification Commands

```powershell
# Run full pipeline test
& "C:\RSSAdmin\venv\Scripts\python.exe" C:\RSSAdmin\e2e_test.py

# Test DistilBERT model inference
& "C:\RSSAdmin\venv\Scripts\python.exe" C:\RSSAdmin\test.py
```

---

## 12. Cloudflare Implementation of D1, KV & Cache

### 1. Architectural Overview & Tiered Strategy

The downstream RSS Aggregator application leverages Cloudflare's serverless edge infrastructure to provide **sub-15ms response times**, high scalability, and minimal operating costs:

```
                    ┌─────────────────────────┐
                    │      End User App       │
                    │   (Web / Mobile Reader) │
                    └────────────┬────────────┘
                                 │
                                 ▼
                   ┌──────────────────────────┐
                   │   Cloudflare Edge CDN    │  ⚡ Sub-10ms Response
                   │   (Parsed Feed JSON)     │  (Free & Unlimited)
                   └─────────────┬────────────┘
                         Miss    │   Hit
                    ┌────────────┴────────────┐
                    ▼                         ▼
        ┌───────────────────────┐       [ Instant Response ]
        │     Cloudflare KV     │  ⚡ Sub-25ms Read Store
        │  (12-hr Catalog Sync) │  (Fast global snapshot)
        └───────────┬───────────┘
              Miss  │   Hit
        ┌───────────┴───────────┐
        ▼                       ▼
┌──────────────────┐     [ Fetch Origin, Parse &
│  Cloudflare D1   │       Cache at Edge ]
│ (Master SQLite)  │
└──────────────────┘
```

---

### 2. Cloudflare D1 Production Schema (Normalized Design)

To optimize relational queries, indexing, and data integrity, D1 uses a normalized two-table architecture linked via Primary and Foreign Keys:

#### Table 1: `categories`
```sql
CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,          -- e.g. 'Technology', 'Business & Finance'
    sub_category TEXT NOT NULL,         -- e.g. 'Artificial Intelligence', 'Markets'
    slug TEXT NOT NULL UNIQUE,          -- e.g. 'technology-ai'
    icon TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_categories_slug ON categories(slug);
CREATE INDEX IF NOT EXISTS idx_categories_name_sub ON categories(name, sub_category);
```

#### Table 2: `feeds`
```sql
CREATE TABLE IF NOT EXISTS feeds (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category_id INTEGER NOT NULL,
    publisher TEXT,
    feed_name TEXT NOT NULL,
    feed_url TEXT UNIQUE NOT NULL,
    status TEXT CHECK(status IN ('Valid', 'Invalid', 'Review Required')) DEFAULT 'Valid',
    confidence_score REAL,
    classification_method TEXT,
    article_count INTEGER DEFAULT 0,
    validation_details TEXT,
    refresh_interval INTEGER DEFAULT 4, -- Hours: 4, 12, or 24
    etag TEXT,                          -- HTTP ETag for 304 Not Modified checks
    last_modified_header TEXT,          -- Last-Modified HTTP header
    last_fetched_at DATETIME,
    user_count INTEGER DEFAULT 1,       -- Tracks how many users subscribe to this feed
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_feeds_url ON feeds(feed_url);
CREATE INDEX IF NOT EXISTS idx_feeds_category ON feeds(category_id);
CREATE INDEX IF NOT EXISTS idx_feeds_status ON feeds(status);
CREATE INDEX IF NOT EXISTS idx_feeds_refresh ON feeds(refresh_interval);
```

---

### 3. Cloudflare KV Key-Value Structure

Cloudflare KV maintains a global snapshot of the D1 database, refreshed every 12 hours. It is indexed for instant key-based lookups:

1. **Individual Feed Key (Fast Lookup by URL Hash):**
   - **Key:** `feed:hash:<SHA256(feed_url)>`
   - **Value (JSON):**
     ```json
     {
       "id": 101,
       "name": "OpenAI News & Research",
       "url": "https://openai.com/news/rss.xml",
       "publisher": "OpenAI",
       "category": "Technology",
       "sub_category": "Artificial Intelligence",
       "status": "Valid",
       "refresh_interval": 4,
       "etag": "W/\"123456789\"",
       "last_fetched_at": "2026-09-13T09:30:00Z"
     }
     ```

2. **Category Bundle Key (Batch Retrieval for Category Views):**
   - **Key:** `catalog:category:<category_slug>`
   - **Value:** Array of all valid feeds belonging to that category for rapid UI rendering.

---

### 4. Dynamic User Feed Discovery Flow (Zero User Latency)

When a user subscribes to a feed in the reader:

```
User submits Feed URL
         │
         ▼
Check Edge Cache / KV
         │
    ┌────┴────┐
    ▼         ▼
 [Found]   [Not Found (New Feed)]
    │         │
    │         ├─► 1. Worker immediately fetches & parses feed from Origin
    │         ├─► 2. Returns articles to user instantly (ZERO DELAY)
    │         └─► 3. Background Task (ctx.waitUntil):
    │                  • Validates XML structure & checks HTTPS
    │                  • Inserts new record into D1 as a Valid feed
    ▼
Display to User
```

On the next 12-hour Cron cycle (`D1 -> KV`), all newly discovered feeds in D1 automatically populate into the global KV store and propagate across Cloudflare's 300+ edge POPs.

---

### 5. 3-Tier Adaptive Refresh Engine (4h / 12h / 24h)

Feeds are assigned a refresh cadence based on publishing volume and content type:

| Refresh Tier | Frequency | Target Feed Types |
| :---: | :---: | :--- |
| **Tier 1: High Cadence** | **Every 4 Hours** | Breaking News (*BBC, Reuters*), Financial Markets (*WSJ, CNBC*), Live Sports (*ESPN*), Major Tech (*TechCrunch, The Verge*) |
| **Tier 2: Medium Cadence** | **Every 12 Hours** | Niche Tech blogs, Substack newsletters, GitHub project releases, Entertainment & Culture |
| **Tier 3: Low Cadence** | **Every 24 Hours** | Personal blogs, Academic journals (*Nature, ArXiv*), Architecture, Photography, Weekly digests |

#### Bandwidth Saver: HTTP 304 (`ETag` & `If-Modified-Since`)
During background refresh cycles, workers send the stored `etag` and `last_modified_header`. If no new articles were published, the server returns **HTTP 304 Not Modified** with 0 bytes transferred, eliminating bandwidth waste and avoiding rate limits.

---

### 6. Transient Failure & Offline Feed Policy

If a feed server experiences a temporary outage, timeout, or HTTP 5xx error during a background fetch:
- **Policy:** The system checks if the feed was previously marked as **`Valid`**.
- **Action:** If previously valid, the system retains the **`Valid`** flag and treats the outage as temporary. The cached content remains accessible to users.
- **Outcome:** Prevents intermittent network glitches or short publisher downtimes from prematurely invalidating feeds.

---

## 13. 10 Key Data Enrichments & Offline Preparation for Cloudflare

To keep Cloudflare runtime operations fast, serverless, and low-cost, all heavy computation, parsing, NLP zero-shot inference, content deduplication, and quality audits are conducted **100% offline inside the Admin Tool (`C:\RSSAdmin`)**. The resulting master production dataset is exported directly as pre-processed CSV, JSON, and D1 SQL seed files.

### The 10 Offline Enrichment Dimensions

| # | Feature / Gap | Offline Admin Implementation | Production Cloudflare Benefit |
| :---: | :--- | :--- | :--- |
| **1** | **Feed Quality Scoring (0–100)** | Composite algorithm auditing HTTPS (+15), valid XML parse (+25), recency within 7 days (+25), entry volume ≥ 5 (+15), and author/tag metadata (+20). | Cloudflare reader surfaces highest-quality feeds first; filters out dead or low-value feeds without edge compute. |
| **2** | **Duplicate Feed Detection** | URL normalization (stripping query parameters, tracking tags, trailing slashes) and canonical domain/feed hashing. | Prevents redundant edge cache entries and duplicate article fetches for the same publisher content. |
| **3** | **Publisher Reputation Tracking** | Automated tier assignment: `Major` (top global outlets like BBC, Reuters, NYT), `Verified` (established industry blogs), and `Community` (independent creators). | Enables verified badges in the UI and informs caching priority. |
| **4** | **Category Confidence Score** | DistilBERT zero-shot classification outputs explicit confidence probability scores (e.g., `0.94`) saved per feed. | Low-confidence feeds (`< 0.60`) are automatically routed to `Review Required` for human curation. |
| **5** | **Multi-Category Support** | NLP model and rules engine assign primary `category` / `sub_category` plus comma-separated `secondary_categories` (e.g., `Technology,Business,AI`). | Cloudflare edge can index feeds into multiple discovery views without duplicate storage rows. |
| **6** | **Language Detection** | Feed channel metadata & character analysis tags standard ISO codes (`en`, `es`, `fr`, `de`, `hi`, `zh`, `ja`, etc.). | Allows instant frontend language filtering at zero edge runtime cost. |
| **7** | **Country / Region Detection** | Top-level domain (TLD) and publisher geo-tagging assigns ISO country codes (`US`, `UK`, `IN`, `AU`, `CA`, `GLOBAL`). | Readers can localize catalog recommendations based on user geography or Cloudflare `CF-IPCountry` header. |
| **8** | **Publishing Cadence Analysis** | Article timestamp delta analysis tags cadence: `Hourly` (4h TTL), `Daily` (12h TTL), `Weekly` (24h TTL), or `Inactive`. | Directly sets the optimal Cloudflare Edge Cache TTL and cron refresh cadence. |
| **9** | **Broken Feed Monitoring** | Comprehensive HTTP status auditing (200 OK, 301/302 Redirects, 404 Not Found, 5xx Server Errors, SSL failures). | Automatically retains valid flags for transient glitches while quarantining permanently dead feeds. |
| **10** | **Popularity & Authority Rank** | Weighted ranking combining publisher reputation, quality score, and article cadence into an indexed integer rank (`1` to `N`). | Enables zero-computation "Trending" and "Top Feeds" sorting directly from Cloudflare KV. |

---

### Cloudflare Master Export Schemas

The Admin Tool generates three ready-to-ingest formats:

#### 1. Master Cloudflare CSV (`feeds_cloudflare_production.csv`)
```csv
id,category,sub_category,secondary_categories,publisher,reputation_tier,feed_name,feed_url,language,country_code,quality_score,publishing_frequency,status,confidence_score,classification_method,article_count,popularity_rank
1,Technology,Artificial Intelligence,"Data Science,Programming",OpenAI,Major,OpenAI News & Research,https://openai.com/news/rss.xml,en,US,95,Daily,Valid,0.96,DistilBERT,20,1
```

#### 2. Master Cloudflare JSON Bundle (`feeds_cloudflare_production.json`)
Hierarchical bundle keyed by category and URL hash, ready for single-command bulk import into Cloudflare KV:
```json
{
  "catalog_metadata": {
    "total_feeds": 1523,
    "valid_feeds": 854,
    "avg_quality_score": 88.4,
    "generated_at": "2026-09-13T10:30:00Z"
  },
  "feeds": [ ... ]
}
```

#### 3. Cloudflare D1 SQL Seed Script (`seed_d1.sql`)
Pre-formatted batch `INSERT` statements with normalized foreign keys for instant D1 deployment via Wrangler CLI:
```bash
wrangler d1 execute rss-production-db --file=seed_d1.sql
```