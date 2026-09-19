# LEGACY CLOUDFLARE WORKERS ARCHITECTURE & FUNCTIONALITY
## Comprehensive Technical Breakdown of Legacy main-worker, feeds-admin-worker & backup-worker

**Document Title:** Legacy Workers Functionality Doc  
**Document Version:** 1.0 (Architecture Reference)  
**Date:** September 18, 2026  
**Classification:** Cloudflare Serverless Edge Systems Review  
**Source Examined:** `E:\feedoreader neat and clean\10 - Github version with user based access for starred and read later\3\feedplusapp\workers`  

---

## 1. Executive Overview: The 3-Worker Topology

In the legacy feedplusapp (`x-rover` / `feedOread`) infrastructure, backend operations were decoupled across three specialized Cloudflare Workers (along with a background pipeline worker). Each worker fulfilled a dedicated domain role, communicating across shared Cloudflare KV namespaces.

| Worker Name | File Size | Primary Domain / Role | Key KV Bindings |
| :--- | :---: | :--- | :--- |
| **main-worker.js** | 4,166 lines | Core Reader API, User Auth, Bookmarks, Safety Gate & Cron Curation | `CONTROL_PANEL_KV`, `FEEDS_KV`, `RAW_ARTICLES_KV`, `CURATED_ARTICLES_KV`, `USERS_KV` |
| **feeds-admin-worker.js** | 1,836 lines | Web-to-RSS Scraper, Auto-Discovery, Feed Validation, Vanity Masking | `FEEDS_KV`, `CONTROL_PANEL_KV`, `MYBROWSER` (Browser Rendering) |
| **backup-worker.js** | 379 lines | Disaster Recovery, Snapshot Export/Import, Read-Only Failover Mirror | `FEEDS_KV_BK`, `CURATED_ARTICLES_KV_BK`, `CONTROL_PANEL_KV_BK` |

---

## 2. Deep Dive: main-worker.js (Core Application & Reader Engine)

`main-worker.js` served as the operational heart of the application, fulfilling five critical responsibilities:

* **Public News & Feed Syndication:**  
  Exposed `/api/news`, `/api/categories`, and `/api/feeds`. Aggregated articles across multiple upstream feeds, executed title-hash deduplication, generated relative timestamps, and delivered pre-compiled feeds for the reader views (*Top Stories*, *Today*, *Inbox*).
* **User Authentication & Session Security:**  
  Implemented a custom authentication subsystem (`/api/auth/register`, `/api/auth/login`, `/api/auth/logout`, `/api/auth/me`) with salted SHA-256 password hashing, bearer session tokens (30-day TTL), and password update routines.
* **Per-User Row-Isolated Storage:**  
  Stored user-specific data under partitioned KV keys (e.g. `user:<id>:feeds`, `user:<id>:starred`, `user:<id>:read_later`, `user:<id>:folders`) via `/api/user/subscriptions`, `/api/user/bookmarks`, `/api/user/feed-folders`. Supported merging anonymous guest `localStorage` into cloud accounts on sign-in (`/api/user/merge-anonymous`).
* **Scout Safety Gate & Moderation Engine:**  
  Passed every fetched article through safety rules (hard-dropping adult content, hate speech, terrorism, and dangerous medical misinformation) before writing to `CURATED_ARTICLES_KV`. Provided moderation analytics (`/api/modules/safety/stats`) and quarantine inspection (`/api/modules/safety/quarantine`).
* **Scheduled Cron Ingestion:**  
  Executed recurring background fetch cycles via `scheduled(event, env, ctx)` to poll active feeds, run deduplication, and pre-warm caches.

---

## 3. Deep Dive: feeds-admin-worker.js (Ingestion, Web-to-RSS & Discovery)

`feeds-admin-worker.js` was engineered as the ingestion powerhouse and builder backend:

* **High-Speed Web-to-RSS Scraper (`/api/web-to-rss`):**  
  Allowed users to generate RSS feeds from any website. Scraped target HTML, extracted semantic article blocks, titles, publication dates, and hero images, and dynamically constructed standard RSS 2.0 XML.
* **Smart Auto-Discovery & Platform Resolvers (`/api/discover-feeds`):**  
  Probed target URLs, scanned `<head>` for `<link rel="alternate">` feed declarations, tested standard paths (`/feed`, `/rss`, `/atom.xml`), and natively resolved creator newsletter endpoints (Substack `/feed`, Beehiiv `/feed`, Ghost `/rss`).
* **Clean Vanity / Masked Feed URLs (`/feed/:slug` or `/f/:slug`):**  
  Allowed subscribing to complex internal feeds via branded vanity URLs, masking backend worker URLs and sensitive tokens.
* **Feed Validation & Live Previews (`/api/test-feed`, `/api/feed-preview`):**  
  Validated upstream XML feeds, checked HTTP responsiveness, and returned interactive preview cards before adding them to catalogs.
* **Headless Browser Screenshot Engine (`/api/og-screenshot`):**  
  Integrated with Cloudflare Browser Rendering / Puppeteer to capture visual screenshot thumbnails when OpenGraph tags were absent.

---

## 4. Deep Dive: backup-worker.js (Disaster Recovery & Snapshots)

`backup-worker.js` served as an isolated disaster recovery system:

* **Database Snapshot Export & Import (`/api/snapshot/export`, `/api/backup/import`):**  
  Exported complete JSON snapshots of feeds, categories, and curated articles, allowing seamless staging and hydration into backup namespaces.
* **Failover Read-Only Mirror (`/api/news`, `/api/categories`):**  
  Provided high-availability failover endpoints bound to secondary KV namespaces (`_BK`) to ensure the reader remained accessible during primary outages.
* **Backup Health & Sync Verification (`/api/backup/status`):**  
  Monitored row counts, timestamps, and integrity between primary and backup stores.

---

## 5. Modern FeedOmeter Architectural Evolution

Modern FeedOmeter (Phases 1 & 2) builds directly on the strengths of these workers while eliminating key bottlenecks:

1. **Unified Serverless Router:** Consolidates multiple fragmented workers into a clean, modular router structure, reducing operational overhead.
2. **Relational Cloudflare D1 Database:** Replaces fragile KV-string user/feed storage with structured SQL tables (foreign keys, indexing, ACID transactions).
3. **Sub-10ms Multi-Tier Edge Caching:** Combines Cloudflare Cache API (`caches.default`), global KV, and D1 for unmatched performance and zero client scraping loops.

---
*Document compiled and archived for FeedOmeter 2.1 Engineering Documentation.*
