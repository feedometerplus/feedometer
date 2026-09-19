# FeedOmeter: Production Cloudflare Objects & SQL Runbook

**Document Title:** Production Cloudflare Objects and SQL Runbook  
**Target Path:** `C:\feedometer\documents\MIgration from one cloudfalre to another\Production Cloudflare Objects and SQL Runbook.md`  
**Purpose:** Exact SQL statements, object names, bindings, environment variables, and manual setup steps to replicate the production FeedOmeter infrastructure.

---

## 1. Cloudflare D1 SQL Database

### 1.1 Object Name
* **Database Name:** `feedometer-db`
* **Binding Variable Name:** `DB`

---

### 1.2 Complete Table & Index Creation SQLs

Run the following SQL statements in the Cloudflare D1 Console (or via Wrangler CLI):

```sql
-- ============================================================
-- 1. CATEGORIES TABLE (Taxonomy & Pillars)
-- ============================================================
CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  sub_category TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  icon TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_categories_slug ON categories(slug);
CREATE INDEX IF NOT EXISTS idx_categories_name_sub ON categories(name, sub_category);

-- ============================================================
-- 2. FEEDS TABLE (1,523 Curated Catalog Feeds)
-- ============================================================
CREATE TABLE IF NOT EXISTS feeds (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id INTEGER NOT NULL,
  publisher TEXT DEFAULT 'General',
  feed_name TEXT NOT NULL,
  feed_url TEXT UNIQUE NOT NULL,
  status TEXT CHECK(status IN ('Valid', 'Invalid', 'Review Required')) DEFAULT 'Valid',
  confidence_score REAL DEFAULT 0.0,
  classification_method TEXT DEFAULT 'Rules Engine',
  article_count INTEGER DEFAULT 0,
  validation_details TEXT,
  refresh_interval INTEGER DEFAULT 4,
  etag TEXT,
  last_modified_header TEXT,
  last_fetched_at DATETIME,
  user_count INTEGER DEFAULT 1,
  popularity_rank INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_feeds_url ON feeds(feed_url);
CREATE INDEX IF NOT EXISTS idx_feeds_category ON feeds(category_id);
CREATE INDEX IF NOT EXISTS idx_feeds_status ON feeds(status);
CREATE INDEX IF NOT EXISTS idx_feeds_refresh ON feeds(refresh_interval);
CREATE INDEX IF NOT EXISTS idx_feeds_popularity ON feeds(popularity_rank);

-- ============================================================
-- 3. NOTIFY SIGNUPS TABLE (Waitlist Ledger)
-- ============================================================
CREATE TABLE IF NOT EXISTS notify_signups (
  email TEXT PRIMARY KEY,
  joined_at TEXT NOT NULL,
  source TEXT,
  country TEXT,
  city TEXT,
  synced_at TEXT NOT NULL
);
```

---

### 1.3 Schema Verification SQL
```sql
-- Verify all tables exist:
SELECT name FROM sqlite_master WHERE type='table';

-- Verify counts after data import:
SELECT COUNT(*) AS total_categories FROM categories;
SELECT COUNT(*) AS total_feeds FROM feeds;
SELECT COUNT(*) AS total_waitlist FROM notify_signups;
```

---

## 2. Cloudflare KV Namespaces

| # | Namespace Name | Binding Variable Name | Purpose |
| :-: | :--- | :--- | :--- |
| **2.1** | **`FEEDS_KV`** *(Primary)* | `FEEDS_KV` | Live RSS/Atom XML response cache, taxonomy metadata, and fast waitlist capture |
| **2.2** | **`WAITLIST`** *(Secondary / Optional)* | `WAITLIST` | Dedicated waitlist storage partition |

### Manual Creation in Dashboard:
1. Go to **Storage & Databases** $\to$ **KV**.
2. Click **Create namespace** $\to$ Name: `FEEDS_KV` $\to$ Save.

---

## 3. Cloudflare R2 Object Storage

| # | Bucket Name | Purpose | Retention Policy |
| :-: | :--- | :--- | :--- |
| **3.1** | **`feedometer-backups`** | Disaster recovery snapshot storage | 30-Day Rolling Automatic Prune |

### Manual Creation in Dashboard:
1. Go to **Storage & Databases** $\to$ **R2**.
2. Click **Create bucket** $\to$ Name: `feedometer-backups` $\to$ Save.

---

## 4. Cloudflare Worker API (`feedometer-api`)

* **Worker Name:** `feedometer-api`
* **Entry Script:** `workers/feedometer-worker.js`
* **Compatibility Date:** `2024-09-01`

### 4.1 Resource Bindings
Under **Worker Settings** $\to$ **Bindings**:

1. **D1 Database Binding:**
   * Variable name: **`DB`**
   * Target: **`feedometer-db`**
2. **KV Namespace Binding:**
   * Variable name: **`FEEDS_KV`**
   * Target: **`FEEDS_KV`**

---

### 4.2 Environment Variables (`[vars]`)
Under **Worker Settings** $\to$ **Variables and Secrets**:

| Variable Name | Value | Description |
| :--- | :--- | :--- |
| **`ENVIRONMENT`** | `production` | Active runtime tier |
| **`WORKER_PUBLIC_URL`** | `https://feedometer-api.<subdomain>.workers.dev` | Public worker base URL |
| **`ADMIN_NOTIFY_EMAIL`** | `admin@feedometer.com` | Administrative notification recipient |

---

### 4.3 Encrypted Secrets
Under **Worker Settings** $\to$ **Variables and Secrets** $\to$ **Add Secret**:

| Secret Name | Value | Purpose |
| :--- | :--- | :--- |
| **`ADMIN_SECRET`** | `[Your_Encrypted_Passphrase]` | Protects administrative endpoints (`/api/admin/waitlist` and `/api/admin/waitlist-sync`) |

---

### 4.4 Cron Triggers
Under **Worker Settings** $\to$ **Triggers** $\to$ **Cron Triggers**:

1. **`0 */4 * * *`**: Warmed cache feed refresh (runs every 4 hours).
2. **`0 13 * * *`**: Waitlist sync from KV to D1 ledger (runs daily at 13:00 UTC / 7:00 PM IST).

---

## 5. Cloudflare Pages Frontend (`feedometer`)

* **Project Name:** `feedometer`
* **Connected Repository:** `feedometerplus/feedometer` (or your GitHub repo)
* **Production Branch:** `main`

### 5.1 Build Configuration
* **Framework preset:** `None`
* **Build command:** *(Leave empty / None)*
* **Deploy command:** *(Leave empty / None)*
* **Root directory / Build output directory:** `/` *(or leave blank)*

### 5.2 Pages Bindings
Under **Pages Settings** $\to$ **Bindings**:
* **D1 database**: Variable name **`DB`** $\to$ select `feedometer-db`
* **KV namespace**: Variable name **`FEEDS_KV`** $\to$ select `FEEDS_KV`

---

## 6. Frontend Code Configuration (`scripts/feedometer-config.js`)

Ensure line 9 in `scripts/feedometer-config.js` matches your worker's live URL:
```javascript
var PRODUCTION_API = 'https://feedometer-api.<your-subdomain>.workers.dev';
```

---

## 7. Complete Object & Variable Master Summary

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          FEEDOMETER CLOUDFLARE MATRIX                       │
├──────────────────────┬──────────────────────┬───────────────────────────────┤
│ Object Type          │ Object Name          │ Binding / Config Reference    │
├──────────────────────┼──────────────────────┼───────────────────────────────┤
│ D1 SQL Database      │ feedometer-db        │ env.DB                        │
│ KV Namespace         │ FEEDS_KV             │ env.FEEDS_KV                  │
│ R2 Bucket            │ feedometer-backups   │ R2 Storage Manifest           │
│ Worker API           │ feedometer-api       │ https://feedometer-api...     │
│ Worker Secret        │ ADMIN_SECRET         │ env.ADMIN_SECRET              │
│ Worker Variable      │ ADMIN_NOTIFY_EMAIL   │ admin@feedometer.com          │
│ Worker Variable      │ ENVIRONMENT          │ production                    │
│ Worker Cron #1       │ 0 */4 * * *          │ Cache warm-up (Every 4 hours) │
│ Worker Cron #2       │ 0 13 * * *           │ Daily KV→D1 Sync (13:00 UTC)  │
│ Pages Project        │ feedometer           │ Root '/' (Static frontend)    │
│ Pages Bindings       │ DB, FEEDS_KV         │ D1 & KV attached to Pages     │
└──────────────────────┴──────────────────────┴───────────────────────────────┘
```
