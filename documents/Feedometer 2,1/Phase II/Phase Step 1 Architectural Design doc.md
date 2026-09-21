# FEEDOMETER 2.1 — PHASE 2 ARCHITECTURAL DESIGN SPECIFICATION
## Personal Feed Intelligence Platform: Modular Single Worker, D1 Hierarchical Taxonomy, Stream Engine & Article Identity

**Document Title:** Phase Step 1 Architectural Design Doc  
**Project Phase:** Phase 2 — Personal Reader Fundamentals  
**Architecture Version:** 2.2 (Enterprise Taxonomy & Stream Engine First)  
**Date:** September 18, 2026  
**Status:** Approved Master Architectural Specification  
**Target Workspace:** `C:\feedometer_next_phase`  

---

## 1. Strategic Product Philosophy: The Personal Intelligence Platform

FeedOmeter is not merely a generic anonymous RSS reader. FeedOmeter is engineered as a **Personal Feed Intelligence Platform** where feeds, hierarchical folders, reading history, bookmarks, and future Edge AI insights belong to a verified user account from Day 1.

* **Public = Reader (Anonymous Users):**  
  Can browse the 25-outlet publisher catalog, open individual public feed streams, read articles, and evaluate the product with sub-10ms edge caching (existing Phase 1 baseline).
* **Authenticated = Owner (Logged-in Users):**  
  Can follow feeds, create hierarchical nested folders, star articles, save to Read Later, track reading history, build custom multi-feed stream fusions, save newsletters, and unlock future Edge AI article briefings.
* **Mandatory Login for Personal Features:**  
  Nothing personal exists without authentication. This eliminates brittle client-side data migration scripts and guarantees a pristine, relational Cloudflare D1 data model from Day 1.

---

## 2. Unified Modular Worker Architecture

Deploy as a single unified Cloudflare Worker, but organize the codebase internally into decoupled, highly cohesive ES modules and services. Never repeat the legacy monolithic script or 3-worker coordination overhead.

### Worker Directory Structure:
```
workers/
├── feedometer-worker.js         (Fast Router & Request Dispatcher)
├── modules/
│   ├── auth.js                  (/api/auth/register, login, logout, me, session verify)
│   ├── streams.js               (/api/stream Multi-Feed Fusion & User Hot Stream)
│   ├── discovery.js             (/api/discover Keyword & D1 Catalog Search)
│   ├── builder.js               (/api/builder Web-to-RSS & Newsletter Sniffer)
│   ├── collections.js           (/api/collections Custom Thematic Bundles)
│   ├── user.js                  (/api/follow, /api/folders, /api/star, /api/save)
│   └── cron.js                  (Scheduled 4h Pre-warming & Nightly Pruning)
├── services/
│   ├── rss-parser.js            (Universal Namespace XML & Atom Parser)
│   ├── feed-fusion.js           (Parallel Ingestion & Cross-Feed Deduplication)
│   ├── cache-manager.js         (Multi-Tier Cache: caches.default + KV + D1)
│   └── article-normalizer.js    (Canonical URLs, Clean Titles, ISO Timestamps)
└── lib/
    ├── crypto.js                (WebCrypto SHA-256 & Salted Password Hashing)
    └── response.js              (Standardized JSON & Error Responses)
```

---

## 3. Decoupled Subscription & Hierarchical Taxonomy Model

Feed Following and Folder Organization are established as two distinct, independent entities:

* **Entity 1: `user_feeds` (Following Layer):**  
  Captures which feeds a user follows. Powers the global Personal Daily Stream (`GET /api/stream`) with zero folder dependency.
* **Entity 2: `user_feed_assignments` (Classification Layer):**  
  Captures where a user has classified/placed a feed. A feed can live in 0 folders (*"Follow Only"*) or in specific nested folders (*"Follow & Organize"*).
* **Hierarchical Folders (`parent_folder_id`):**  
  Enables infinite recursive nesting (e.g., *Oracle* $\to$ *PeopleSoft* $\to$ *HCM* / *FIN*; *JDE*).
* **Multi-Folder Policy:**  
  Database schema supports 1 feed in multiple folders natively via `UNIQUE(user_id, feed_id, folder_id)`. Phase 2 UI presents single-folder selection for simplicity, unlocking multi-select in future phases with zero DB migration.

### Follow Modal Workflow Wireframe:
```
┌────────────────────────────────────────────────────────┐
│  Follow Source: Oracle HCM Cloud Updates               │
├────────────────────────────────────────────────────────┤
│                                                        │
│  ◉ Follow Only                                         │
│    (Adds to your master Daily Stream)                  │
│                                                        │
│  ○ Follow & Organize into Folders                      │
│    ┌────────────────────────────────────────────────┐  │
│    │ 📁 Oracle                                      │  │
│    │   ├── 📁 PeopleSoft                            │  │
│    │   │   ├── ☑ 📁 HCM  (Selected folder)          │  │
│    │   │   └── ☐ 📁 FIN                             │  │
│    │   └── ☐ 📁 JDE                                 │  │
│    └────────────────────────────────────────────────┘  │
│    [+ New Subfolder] inside selected folder            │
│                                                        │
├────────────────────────────────────────────────────────┤
│  [Cancel]                               [ Save Feed ]  │
└────────────────────────────────────────────────────────┘
```

---

## 4. Complete Production D1 SQL Database Schema

```sql
-- 1. Users
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  last_login INTEGER,
  status TEXT DEFAULT 'active'
);

-- 2. Sessions
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token_hash TEXT UNIQUE NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 3. Sources (Enhanced Metadata)
CREATE TABLE IF NOT EXISTS sources (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  feed_url TEXT UNIQUE NOT NULL,
  website_url TEXT,
  category TEXT DEFAULT 'general',
  language TEXT DEFAULT 'en',
  logo_url TEXT,
  is_verified INTEGER DEFAULT 0,
  article_count INTEGER DEFAULT 0,
  last_polled_at INTEGER,
  last_article_at INTEGER,
  status TEXT DEFAULT 'active'
);

-- 4. Source Health & Telemetry
CREATE TABLE IF NOT EXISTS source_health (
  source_id TEXT PRIMARY KEY,
  last_success_at INTEGER,
  last_failure_at INTEGER,
  consecutive_failures INTEGER DEFAULT 0,
  last_http_status INTEGER,
  response_ms INTEGER,
  error_message TEXT,
  FOREIGN KEY (source_id) REFERENCES sources(id) ON DELETE CASCADE
);

-- 5. User Feeds (Following Layer)
CREATE TABLE IF NOT EXISTS user_feeds (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  source_id TEXT NOT NULL,
  followed_at INTEGER NOT NULL,
  UNIQUE(user_id, source_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (source_id) REFERENCES sources(id) ON DELETE CASCADE
);

-- 6. Hierarchical Folders
CREATE TABLE IF NOT EXISTS folders (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  parent_folder_id TEXT,
  icon TEXT DEFAULT '📁',
  sort_order INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (parent_folder_id) REFERENCES folders(id) ON DELETE CASCADE
);

-- 7. User Feed Assignments (Classification Layer)
CREATE TABLE IF NOT EXISTS user_feed_assignments (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  feed_id TEXT NOT NULL,
  folder_id TEXT NOT NULL,
  assigned_at INTEGER NOT NULL,
  UNIQUE(user_id, feed_id, folder_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (feed_id) REFERENCES sources(id) ON DELETE CASCADE,
  FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE CASCADE
);

-- 8. Starred Articles
CREATE TABLE IF NOT EXISTS starred_articles (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  article_hash TEXT NOT NULL,
  article_data TEXT NOT NULL,
  starred_at INTEGER NOT NULL,
  UNIQUE(user_id, article_hash),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 9. Saved / Read Later Articles
CREATE TABLE IF NOT EXISTS saved_articles (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  article_hash TEXT NOT NULL,
  article_data TEXT NOT NULL,
  saved_at INTEGER NOT NULL,
  UNIQUE(user_id, article_hash),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 10. Reading History Timeline
CREATE TABLE IF NOT EXISTS read_history (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  article_hash TEXT NOT NULL,
  read_at INTEGER NOT NULL,
  UNIQUE(user_id, article_hash),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- High-Speed Covering Indexes
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_user_feeds_user ON user_feeds(user_id);
CREATE INDEX IF NOT EXISTS idx_folders_user_parent ON folders(user_id, parent_folder_id);
CREATE INDEX IF NOT EXISTS idx_assignments_user_folder ON user_feed_assignments(user_id, folder_id);
CREATE INDEX IF NOT EXISTS idx_assignments_feed ON user_feed_assignments(feed_id);
CREATE INDEX IF NOT EXISTS idx_starred_user ON starred_articles(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_user ON saved_articles(user_id);
CREATE INDEX IF NOT EXISTS idx_history_user ON read_history(user_id);
CREATE INDEX IF NOT EXISTS idx_source_health_failures ON source_health(consecutive_failures);
```

---

## 5. Formal Article Identity Strategy

The single immutable identifier across FeedOmeter is:
$$\text{article\_hash} = \text{SHA256}(\text{Canonicalize}(\text{article.link}))$$

* **Canonicalization Rules:**
  1. Lowercase scheme and host (`https://theverge.com/tech`).
  2. Strip tracking query params (`utm_*`, `fbclid`, `gclid`, `ref`, `source`, `mc_eid`, `_ga`).
  3. Remove URL anchor fragments (`#comments`).
  4. Normalization fallback if link is missing: `SHA256(feed_url + "::" + (guid || title))`.
* **Universal Utility:**  
  `article_hash` serves as the primary foreign key for Read History, Starred Articles, Read Later Queue, Deduplication, and future Edge AI article caching.

---

## 6. Stream Engine Pipeline & Pagination Strategy

* **Priority #1 Component (`/api/stream`):**  
  Executes parallel ingestion across followed feeds (`Promise.allSettled`), deep XML/Atom parsing, cross-feed deduplication, and strict JSON normalization.
* **Pagination Contract:**  
  `GET /api/stream?limit=50&cursor=<epoch_ms>_<article_hash>`. Default 50 items (max 100), ensuring rock-solid pagination stability even during live breaking news ingestion.
* **Recursive Folder Streams:**  
  `GET /api/stream?folder_id=<id>` traverses the folder subtree using recursive SQL CTEs to fuse all child folder feeds in a single step.

---

## 7. Realigned 7-Step Phase 2 Execution Sequence

| Step | Task ID | Task Title | Key Deliverable |
| :---: | :---: | :--- | :--- |
| **Step 1** | **P2-01** | **Authentication Foundation** | D1 user & session tables, salted SHA-256 passwords, bearer tokens, `POST /api/auth/register`, `login`, `me`. |
| **Step 2** | **P2-02** | **Stream Engine (The Heart)** | Multi-feed fusion (10 feeds $\to$ 1 stream), deduplication, normalized JSON, `GET /api/stream` with cursor pagination. |
| **Step 3** | **P2-03** | **Personal Feed Library & Taxonomy** | Decoupled `user_feeds` & `user_feed_assignments`, recursive folder tree, follow modal, unread rollups. |
| **Step 4** | **P2-04** | **Feed Discovery Engine** | D1 catalog search (`/api/discover?q=...`), category starter pills, suggested verified feeds. |
| **Step 5** | **P2-05** | **Universal Website Feed Builder** | Alternate link sniffing, Substack/Beehiiv/Ghost/Medium resolvers, fallback Edge HTML article extractor. |
| **Step 6** | **P2-06** | **Personal Reader Actions** | D1 `starred_articles`, `saved_articles`, `read_history` with `article_hash` indexing and filter views. |
| **Step 7** | **P2-07** | **Thematic Collections Engine** | Custom thematic collections and collection-filtered composite streams (`/api/collections/:id/stream`). |

---
*Document compiled and archived for FeedOmeter 2.1 Engineering Documentation.*
