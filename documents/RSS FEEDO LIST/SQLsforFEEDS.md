# Cloudflare D1 & KV SQL and Wrangler Commands Playbook (SQLsforFEEDS)

## 1. Executive Summary & Purpose

This document provides a comprehensive, production-ready reference manual containing all **SQL statements, DDL schemas, indexing commands, verification queries, and Wrangler CLI workflows** used to initialize, populate, manage, and query the **Cloudflare D1** database and **Cloudflare Workers KV** cache for the **Feedometer RSS Reader** application.

---

## 2. Cloudflare D1 Schema Creation (DDL & Indexes)

Execute these statements in the **Cloudflare D1 Web Console** or via `wrangler d1 execute` to create the normalized relational schema.

### Statement 2.1: Create `categories` Table
- **Purpose:** Stores the 12 primary category pillars and 70+ granular sub-categories.
- **Keys:** Primary Key `id` and Unique Constraint on `slug`.

```sql
CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    sub_category TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    icon TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Statement 2.2: Create `feeds` Table (23 Fields)
- **Purpose:** Master registry for all curated feeds and dynamic user submissions with audit metrics, HTTP caching headers, and reputation rankings.

```sql
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
```

### Statement 2.3: Create Performance Indexes
- **Purpose:** Enables sub-1ms query execution across category lookups, status filtering, URL deduping, and background cron intervals.

```sql
CREATE INDEX IF NOT EXISTS idx_categories_slug ON categories(slug);
CREATE INDEX IF NOT EXISTS idx_categories_name_sub ON categories(name, sub_category);
CREATE INDEX IF NOT EXISTS idx_feeds_url ON feeds(feed_url);
CREATE INDEX IF NOT EXISTS idx_feeds_category ON feeds(category_id);
CREATE INDEX IF NOT EXISTS idx_feeds_status ON feeds(status);
CREATE INDEX IF NOT EXISTS idx_feeds_refresh ON feeds(refresh_interval);
CREATE INDEX IF NOT EXISTS idx_feeds_popularity ON feeds(popularity_rank);
```

---

## 3. Wrangler CLI Commands for Cloudflare D1

Run these commands from your local terminal in `C:\feedometer` to manage D1 remotely without browser UI limitations.

### Command 3.1: Execute Master Seed Script on Remote D1
- **Purpose:** Imports categories, indexes, and all 1,523 feeds in ~45ms using batched multi-row inserts.

```powershell
npx wrangler d1 execute feedometer-db --file="C:\RSSAdmin\exports\seed_d1.sql" --remote
```

### Command 3.2: Run an Inline SQL Query Remotely
- **Purpose:** Execute quick SQL queries against your production database directly from the terminal.

```powershell
npx wrangler d1 execute feedometer-db --command="SELECT COUNT(*) FROM feeds WHERE status = 'Valid';" --remote
```

### Command 3.3: Export Remote D1 Database to SQL Backup
- **Purpose:** Creates a point-in-time SQL snapshot of your remote Cloudflare database.

```powershell
npx wrangler d1 export feedometer-db --remote --output="C:\feedometer\backup_d1.sql"
```

### Command 3.4: List All D1 Databases in Your Account
```powershell
npx wrangler d1 list
```

---

## 4. Cloudflare Workers KV Commands

Cloudflare KV serves as the global edge cache for sub-15ms catalog reads.

### Command 4.1: Create KV Namespace
```powershell
npx wrangler kv:namespace create FEEDS_KV
```

### Command 4.2: Upload Full Master JSON Catalog into KV
- **Purpose:** Pushes the entire 1,523 feed bundle into Cloudflare edge memory for worker consumption.

```powershell
npx wrangler kv:key put --binding=FEEDS_KV "catalog:master" --path="C:\RSSAdmin\exports\feeds_cloudflare_production.json" --remote
```

### Command 4.3: Read a Key from Remote KV
```powershell
npx wrangler kv:key get --binding=FEEDS_KV "catalog:master" --remote
```

### Command 4.4: Delete a Key from KV
```powershell
npx wrangler kv:key delete --binding=FEEDS_KV "catalog:master" --remote
```

---

## 5. Verification & Catalog Audit SQL Queries

Use these queries in the **Cloudflare D1 Console** or via Wrangler to monitor database health and contents.

### Query 5.1: High-Level Catalog Counts Summary
- **Purpose:** Checks total categories, total feeds, valid feeds, and invalid counts in a single view.

```sql
SELECT 
    (SELECT COUNT(*) FROM categories) AS total_categories,
    (SELECT COUNT(*) FROM feeds) AS total_feeds,
    (SELECT COUNT(*) FROM feeds WHERE status = 'Valid') AS valid_feeds,
    (SELECT COUNT(*) FROM feeds WHERE status = 'Review Required') AS review_required_feeds,
    (SELECT COUNT(*) FROM feeds WHERE status = 'Invalid') AS invalid_feeds;
```

### Query 5.2: Feed Distribution Across Primary Categories
- **Purpose:** Shows how many feeds are assigned to each primary category pillar, sorted by count.

```sql
SELECT 
    c.name AS primary_category, 
    COUNT(f.id) AS feed_count 
FROM categories c 
LEFT JOIN feeds f ON c.id = f.category_id 
GROUP BY c.name 
ORDER BY feed_count DESC;
```

### Query 5.3: Granular Sub-Category Breakdown
- **Purpose:** Inspects feed volume per specific sub-category topic.

```sql
SELECT 
    c.name AS category,
    c.sub_category,
    COUNT(f.id) AS valid_feed_count
FROM categories c
JOIN feeds f ON c.id = f.category_id
WHERE f.status = 'Valid'
GROUP BY c.name, c.sub_category
ORDER BY c.name ASC, valid_feed_count DESC;
```

### Query 5.4: Top 20 Feeds by AI Confidence & Article Density
- **Purpose:** Surfaces highest-confidence, richest RSS feeds for spotlighting in the UI.

```sql
SELECT 
    f.id,
    c.name AS category,
    c.sub_category,
    f.publisher,
    f.feed_name,
    f.article_count,
    f.confidence_score,
    f.refresh_interval
FROM feeds f
JOIN categories c ON f.category_id = c.id
WHERE f.status = 'Valid'
ORDER BY f.confidence_score DESC, f.article_count DESC
LIMIT 20;
```

### Query 5.5: Search Feeds by Keyword
- **Purpose:** Tests keyword lookup across title, publisher, and sub-category.

```sql
SELECT 
    f.feed_name,
    f.publisher,
    c.sub_category,
    f.feed_url
FROM feeds f
JOIN categories c ON f.category_id = c.id
WHERE (f.feed_name LIKE '%ai%' OR f.feed_name LIKE '%tech%')
  AND f.status = 'Valid'
LIMIT 15;
```

---

## 6. Production Maintenance & Day-2 Operations SQL Queries

### Query 6.1: Dynamic User Feed Insertion (With Category Lookup)
- **Purpose:** Inserts a newly discovered user feed, linking it to the correct category ID.

```sql
INSERT INTO feeds (category_id, publisher, feed_name, feed_url, status, confidence_score, classification_method, article_count, refresh_interval, user_count)
VALUES (
    (SELECT id FROM categories WHERE slug = 'technology-artificial-intelligence' LIMIT 1),
    'Custom Publisher',
    'Custom AI Blog',
    'https://custom-ai-blog.com/feed.xml',
    'Valid',
    1.0,
    'User Submission',
    10,
    4,
    1
);
```

### Query 6.2: Increment User Subscription Counter
- **Purpose:** Increases the popularity counter when an existing feed is subscribed to by another user.

```sql
UPDATE feeds 
SET user_count = user_count + 1 
WHERE feed_url = 'https://openai.com/news/rss.xml';
```

### Query 6.3: Update HTTP ETag & Last Fetched Timestamp (Cron Worker)
- **Purpose:** Updates caching metadata after an edge worker background fetch cycle.

```sql
UPDATE feeds 
SET 
    etag = 'W/"64f8a123-100"',
    last_modified_header = 'Sun, 13 Sep 2026 06:00:00 GMT',
    last_fetched_at = CURRENT_TIMESTAMP
WHERE feed_url = 'https://openai.com/news/rss.xml';
```

### Query 6.4: Batch Query Feeds Due for Refresh
- **Purpose:** Retrieves feeds matching a specific refresh cadence (e.g. 4-hour tier) whose cache is expired.

```sql
SELECT id, feed_url, etag, last_modified_header 
FROM feeds 
WHERE status = 'Valid' 
  AND refresh_interval = 4 
  AND (last_fetched_at IS NULL OR last_fetched_at <= datetime('now', '-4 hours'))
LIMIT 50;
```

### Query 6.5: Purge All Feeds (Database Reset)
- **Purpose:** Clears feeds table while preserving categories and schema structures.

```sql
DELETE FROM feeds;
```

---

## 7. Cloudflare Worker `wrangler.toml` Bindings Reference

Add these bindings to your **`C:\feedometer\wrangler.toml`** file to connect your worker to both D1 and KV:

```toml
name = "feedometer-api"
main = "feedometer-worker.js"
compatibility_date = "2024-09-01"

# D1 Database Binding
[[d1_databases]]
binding = "DB"
database_name = "feedometer-db"
database_id = "e25f4a17-8f70-40ea-95dd-3a5d22a60be0"

# Workers KV Cache Binding
[[kv_namespaces]]
binding = "FEEDS_KV"
id = "your_kv_namespace_id_here"

# 4-Hour Refresh Trigger
[triggers]
crons = ["0 */4 * * *"]
```
