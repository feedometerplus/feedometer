# FeedOmeter 2.1 — Complete Master Database Relational Matrix (All 14 Tables)

**Document Version:** 2.1.0  
**Engine:** Cloudflare D1 (SQLite)  
**Workspace:** `C:\feedometer_next_phase`  
**Date:** September 2026  

---

## 1. Relational Architecture & Topology Overview

The FeedOmeter Cloudflare D1 schema integrates **14 tables** divided into two operational tiers:
1. **Phase 1 Public Curated Directory (4 tables):** Curated editorial taxonomy and pre-seeded discover catalog.
2. **Phase 2 Personal Feed Intelligence Platform (10 tables):** Authenticated user accounts, session state, decoupled feed subscriptions, recursive folder hierarchies, many-to-many feed folder mappings, and reading state (starred, saved, history).

---

## 2. Complete 14-Table Relational Matrix

| Domain | Table Name | Primary Key (PK) | Functional Purpose | Foreign Key Dependencies & Connected Tables |
| :--- | :--- | :--- | :--- | :--- |
| **Phase 1** | `categories` | `id` (INTEGER) | Curated editorial taxonomy for categorizing pre-seeded public feeds (e.g., Tech, News, AI). | **FKs:** None<br>**Connected:** `feeds` (1 : N via `feeds.category_id`) |
| **Phase 1** | `feeds` | `id` (INTEGER) | Phase 1 catalog of pre-curated public RSS/Atom feeds displayed in discover/guest views. | **FKs:** `category_id -> categories(id)`, `publisher_id -> publishers(id)`<br>**Connected:** `categories` (N : 1), `publishers` (N : 1) |
| **Phase 1** | `publishers` | `id` (INTEGER) | Directory of 25+ verified media publishers and news organizations. | **FKs:** None<br>**Connected:** `feeds` (1 : N via `feeds.publisher_id`) |
| **Phase 1** | `notify_signups` | `id` (INTEGER) | Pre-launch waitlist and email notifications capture for early platform registration. | **FKs:** None<br>**Connected:** Standalone marketing telemetry |
| **Phase 2** | `users` | `id` (TEXT UUID/CUID) | Core user authentication, profile data, secure salted password hashes, and tier/role status. | **FKs:** None<br>**Connected:** `sessions`, `user_feeds`, `folders`, `user_feed_assignments`, `starred_articles`, `saved_articles`, `read_history` (1 : N to all) |
| **Phase 2** | `sessions` | `id` (TEXT) | Active user authentication bearer sessions with cryptographic tokens, 30-day TTL expiry. | **FKs:** `user_id -> users(id) ON DELETE CASCADE`<br>**Connected:** `users` (N : 1 via `user_id`) |
| **Phase 2** | `sources` | `id` (TEXT UUID/CUID) | Master runtime registry of all active RSS/Atom URLs polled by Feed Fusion engine with ETag/Last-Modified caching. | **FKs:** None<br>**Connected:** `source_health` (1 : 1), `user_feeds` (1 : N via `source_id`) |
| **Phase 2** | `source_health` | `source_id` (TEXT) | HTTP telemetry, response latencies, failure counters, and circuit breaker status for feeds. | **FKs:** `source_id -> sources(id) ON DELETE CASCADE`<br>**Connected:** `sources` (1 : 1 via `source_id`) |
| **Phase 2** | `user_feeds` | `id` (TEXT UUID/CUID) | Decoupled subscription layer mapping users to subscribed sources with custom aliases and fetch priority. | **FKs:** `user_id -> users(id) ON DELETE CASCADE`, `source_id -> sources(id) ON DELETE CASCADE`<br>**Connected:** `users` (N : 1), `sources` (N : 1), `user_feed_assignments` (1 : N via `user_feeds.id`) |
| **Phase 2** | `folders` | `id` (TEXT UUID/CUID) | Recursive multi-level folder taxonomy for hierarchical user feed organization (supports nested subfolders). | **FKs:** `user_id -> users(id) ON DELETE CASCADE`, `parent_folder_id -> folders(id) ON DELETE CASCADE`<br>**Connected:** `users` (N : 1), `folders` (Self N : 1 parent/children), `user_feed_assignments` (1 : N via `folder_id`) |
| **Phase 2** | `user_feed_assignments` | `id` (TEXT UUID/CUID) | Many-to-many classification bridge mapping user feed subscriptions into specific folders. | **FKs:** `user_id -> users(id) ON DELETE CASCADE`, `feed_id -> user_feeds(id) ON DELETE CASCADE`, `folder_id -> folders(id) ON DELETE CASCADE`<br>**Connected:** `users` (N : 1), `user_feeds` (N : 1 via `feed_id`), `folders` (N : 1 via `folder_id`) |
| **Phase 2** | `starred_articles` | `id` (TEXT UUID/CUID) | User-curated favorite/bookmarked articles identified by canonical SHA-256 content hash. | **FKs:** `user_id -> users(id) ON DELETE CASCADE`<br>**Connected:** `users` (N : 1 via `user_id`) |
| **Phase 2** | `saved_articles` | `id` (TEXT UUID/CUID) | Read-Later queue with read/unread tracking and offline sync capabilities. | **FKs:** `user_id -> users(id) ON DELETE CASCADE`<br>**Connected:** `users` (N : 1 via `user_id`) |
| **Phase 2** | `read_history` | `id` (TEXT UUID/CUID) | Complete reading audit log for stream-level read/unread indicators and personal intelligence analytics. | **FKs:** `user_id -> users(id) ON DELETE CASCADE`<br>**Connected:** `users` (N : 1 via `user_id`) |

---

## 3. Query Topologies & Join Paths

```
[users] ──(1:N)──> [sessions]
   │
   ├──(1:N)──> [user_feeds] ──(N:1)──> [sources] ──(1:1)──> [source_health]
   │                 │
   │                 ├──(1:N)──> [user_feed_assignments] <──(N:1)── [folders] (Self-referential tree)
   │
   ├──(1:N)──> [starred_articles]  ── (article_hash O(1) overlay)
   ├──(1:N)──> [saved_articles]    ── (article_hash O(1) overlay)
   └──(1:N)──> [read_history]      ── (article_hash O(1) overlay)

[categories] ──(1:N)──> [feeds] <──(N:1)── [publishers]  (Phase 1 Curated Directory)
```

---

## 4. Key Relational Integrity Guarantees

1. **Decoupled Architecture:** Subscriptions (`user_feeds`) exist independently of folders. Feeds can belong to 0, 1, or multiple folders without duplicate source fetching.
2. **Cascading Cleanups:** Deleting a user account cascades to all private data structures without orphan records.
3. **Stateless Article Enrichment:** Article read/starred/saved status is bound by deterministic `article_hash = SHA256(canonical_url)`, enabling seamless overlay onto live RSS stream feeds without storing millions of article bodies in D1.
