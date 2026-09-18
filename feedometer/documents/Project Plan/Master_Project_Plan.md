# FeedOmeter Product Evolution: Master 7-Phase Project Plan & Linear Roadmap

**Document:** 7-Phase Engineering Work Breakdown Structure (WBS) & Linear Roadmap  
**Version:** 2.0 (Updated with Phase 1 Completed Foundation & Active Phase 2)  
**Date:** September 18, 2026  
**Status:** Approved & Ready for Linear Import  
**Import File:** `Linear_Import_FeedOmeter_Roadmap.csv`  

---

## 1. Executive Summary & Strategic Roadmap

This Master Project Plan operationalizes the complete FeedOmeter SaaS journey across **7 structured phases**.

### Key Architectural Baseline:
* **Phase 1 (COMPLETED):** Core RSS Feed Reader, Hostinger Domain, Cloudflare DNS/Pages, Cloudflare Worker API, D1 Database, KV Caching, Universal XML Parser, Deduplication, and Master Design System are **100% deployed and live**.
* **Phase 2 (ACTIVE CURRENT SPRINT):** Personal Reader Fundamentals (Local-First / Zero Login) delivering Subscriptions, Folders, Starred Articles, Mark Read/Unread, and OPML 2.0 Import/Export.
* **Phases 3 to 7 (FUTURE EXPANSION):** Cloud Identity & Device Sync $\to$ Search & Curation $\to$ SaaS Automation $\to$ Edge AI $\to$ Multi-Tenant Enterprise.

---

## 2. Linear 1-Click Import Instructions

To import this complete roadmap into Linear:
1. Open your workspace in **[linear.app](https://linear.app)**.
2. Go to **Settings** $\to$ **Import / Export** $\to$ **Import CSV**.
3. Select file: `C:\feedometer\documents\Project Plan\Linear_Import_FeedOmeter_Roadmap.csv`.
4. Linear will automatically detect all 7 Projects/Phases, Priorities, Estimates, and Statuses (**Phase 1 tasks are pre-marked as DONE!**).
5. Click **Import**!

---

## 3. Detailed 7-Phase Work Breakdown Structure (WBS)


### Phase 1: RSS Feed Reader & Infrastructure Foundation *(COMPLETED / 100% DONE ✅)*

| Task ID | Task Title | Status | Tier | Priority | Est (Pts) | Key Deliverables & Acceptance Criteria |
| :--- | :--- | :---: | :---: | :---: | :---: | :--- |
| **P1-01** | Domain & Cloud Infrastructure Setup | ✅ Done | Tier 1 | Urgent | 3 | Registered feedometer.com on Hostinger, configured Cloudflare DNS, SSL/TLS certificates, custom apex/www domain routing, and Cloudflare Pages hosting. |
| **P1-02** | GitHub Repository & Production Build Pipeline | ✅ Done | Tier 1 | High | 3 | Initialized GitHub repository, configured branch workflows, and implemented automated production minification engine (build.js) achieving -38% payload reduction. |
| **P1-03** | Cloudflare D1 Database & KV Schema Architecture | ✅ Done | Tier 1 | High | 4 | Created feedometer-db D1 database, defined publishers, feeds, and notify_signups tables with unique indexes, and bound FEEDS_KV for multi-tier global caching. |
| **P1-04** | Cloudflare Edge Worker API & Routing Engine | ✅ Done | Tier 1 | Urgent | 5 | Engineered stateless feedometer-worker.js with sub-10ms Edge Cache API (caches.default), KV fallback, /api/view, /api/catalog, /api/og, and /api/waitlist routes. |
| **P1-05** | Universal XML Parsing & Layer A Image Extraction | ✅ Done | Tier 1 | High | 4 | Built universal namespace-agnostic RSS 2.0 / Atom 1.0 parser with deep extraction for Media RSS (<media:content>, <media:thumbnail>), iTunes enclosures, and inline <img srcset>. |
| **P1-06** | URL Canonicalization, Deduplication & Safety Moderation | ✅ Done | Tier 1 | High | 3 | Implemented tracking parameter stripping (utm_*, fbclid), canonical article URL generation, atomic title-hash deduplication, and automated hate speech/extremism content filter. |
| **P1-07** | Server-Side Async Hero Image Enrichment & KV Caching | ✅ Done | Tier 1 | High | 4 | Added non-blocking ctx.waitUntil OpenGraph hero image extraction with per-article KV caching (og:<url>, 7-day TTL), eliminating all client-side scraping loops. |
| **P1-08** | Dynamic 25-Outlet Publisher Directory & D1 Seeding | ✅ Done | Tier 1 | High | 3 | Seeded 25 curated news publishers and sub-topics into D1 (seed_publishers.sql) with edge-cached /api/catalog route, stripping all hardcoded catalog JSON from frontend. |
| **P1-09** | 10-15% Pure Presentation Frontend & Master Design System | ✅ Done | Tier 1 | High | 4 | Refactored feedometer-viewer.js to pure presentation (fetch -> render), declared master :root design tokens, standardized typography H1-H6, and unified .btn / .badge schemas. |

### Phase 2: Personal Reader Fundamentals *(ACTIVE CURRENT SPRINT 🚀)*

| Task ID | Task Title | Status | Tier | Priority | Est (Pts) | Key Deliverables & Acceptance Criteria |
| :--- | :--- | :---: | :---: | :---: | :---: | :--- |
| **P2-01** | Local Subscriptions & Personal Feed Library | ⏳ Todo | Tier 1 | Urgent | 3 | Implement local client-side subscription store using LocalStorage/IndexedDB. Allow users to subscribe/unsubscribe to feeds with instant visual confirmation and local library persistence without requiring login. |
| **P2-02** | Folders & Collections Hierarchy | ⏳ Todo | Tier 1 | High | 3 | Build folder and collection management in the sidebar. Users can create, rename, delete folders and drag/move subscribed feeds into organized topic groups. |
| **P2-03** | Starred & Saved Articles System | ⏳ Todo | Tier 1 | High | 2 | Add a 1-click Star/Bookmark button to article cards and full reader view. Provide a dedicated "Starred" view in the navigation bar with local bookmark storage. |
| **P2-04** | Mark Read / Unread & Reading History | ⏳ Todo | Tier 1 | High | 3 | Track read article URLs with visual dimming on opened cards. Display live unread badge counters per feed/folder and provide a searchable Reading History timeline. |
| **P2-05** | OPML 2.0 Import & Export Engine | ⏳ Todo | Tier 1 | Urgent | 3 | Create standard OPML 2.0 XML parser and exporter. Allows users to import feeds/folders from Feedly, Inoreader, or Apple News in 1 click and export their library anytime. |
| **P2-06** | Instant Article Search & In-Memory Filter | ⏳ Todo | Tier 1 | Medium | 2 | Implement lightning-fast client-side keyword search across article titles, summaries, and authors within currently loaded feeds. |
| **P2-07** | Mobile-Optimized Reader Controls & Gestures | ⏳ Todo | Tier 1 | Medium | 2 | Refine mobile drawer navigation, swipe-to-star, and swipe-to-dismiss gesture interactions for touchscreens conforming to the Master Design System. |

### Phase 3: Cloud Identity, D1 Persistence & Device Sync

| Task ID | Task Title | Status | Tier | Priority | Est (Pts) | Key Deliverables & Acceptance Criteria |
| :--- | :--- | :---: | :---: | :---: | :---: | :--- |
| **P3-01** | Passwordless Magic Link & OAuth Authentication | 📋 Backlog | Tier 1 | High | 4 | Create secure Cloudflare D1 users table and JWT authentication pipeline supporting 1-click Magic Email Login (via Resend/Postmark) and Google/GitHub OAuth. |
| **P3-02** | Bidirectional Cloud Sync Engine (D1 ◄► Local) | 📋 Backlog | Tier 1 | High | 4 | Build automatic background synchronization between local state and Cloudflare D1 database. Merges offline feeds and ensures instant multi-device continuity. |
| **P3-03** | User Profile & Persistent Cloud Preferences | 📋 Backlog | Tier 1 | Medium | 2 | Store user layout settings, reading theme (dark/light/sepia), refresh frequencies, and default start pages in user profile preferences. |
| **P3-04** | Multi-Device Session Management & Live Broadcast | 📋 Backlog | Tier 1 | Medium | 2 | Handle secure HTTP-only session cookies and cross-tab BroadcastChannel communication for instant multi-tab status synchronization. |

### Phase 4: Search, Curation & Discovery Platform

| Task ID | Task Title | Status | Tier | Priority | Est (Pts) | Key Deliverables & Acceptance Criteria |
| :--- | :--- | :---: | :---: | :---: | :---: | :--- |
| **P4-01** | Global Feed Directory & Autodiscovery Search | 📋 Backlog | Tier 1 | High | 3 | Enhance feed search modal with category exploration, popularity rankings from D1, and real-time website URL RSS autodiscovery. |
| **P4-02** | Saved Searches & Dynamic Smart Feeds | 📋 Backlog | Tier 2 | Medium | 3 | Allow users to save recurring search queries as dynamic "Smart Feeds" that automatically aggregate matching articles across all subscribed feeds. |
| **P4-03** | Multi-Dimensional Article Tags & Categories | 📋 Backlog | Tier 2 | Medium | 3 | Implement custom tag pills on articles with tag filtering, allowing multi-label cross-categorization outside traditional folder hierarchies. |
| **P4-04** | Public Collections & Shareable Reading Lists | 📋 Backlog | Tier 2 | Medium | 3 | Generate unique public share links for user-curated feed bundles or article collections with custom branded landing cards. |
| **P4-05** | Feed Health, Uptime & Latency Diagnostics | 📋 Backlog | Tier 1 | Low | 2 | Provide an automated health monitoring dashboard showing feed response times, HTTP status codes, and last-successful-fetch timestamps. |

### Phase 5: SaaS Automation, Alerting & Integrations

| Task ID | Task Title | Status | Tier | Priority | Est (Pts) | Key Deliverables & Acceptance Criteria |
| :--- | :--- | :---: | :---: | :---: | :---: | :--- |
| **P5-01** | Edge Rules & Keyword Matcher Engine | 📋 Backlog | Tier 2 | High | 4 | Build a serverless edge evaluation engine in Cloudflare Worker for regex keyword matching, author filters, and topic inclusion/exclusion rules. |
| **P5-02** | Notification Dispatcher (Email & Web Push) | 📋 Backlog | Tier 2 | High | 4 | Integrate real-time notification dispatching supporting Web Push API (VAPID) and instant email alerts via transactional mail API. |
| **P5-03** | Outbound Webhook Dispatcher | 📋 Backlog | Tier 3 | Medium | 3 | Trigger secure JSON POST webhook payloads to custom HTTP endpoints whenever high-priority keyword or filter rules match incoming articles. |
| **P5-04** | SaaS Integrations (Slack, Discord, Teams, Zapier) | 📋 Backlog | Tier 2 | Medium | 4 | Pre-built webhook connectors formatting article rich cards directly into Slack channels, Discord webhooks, Microsoft Teams, and Zapier triggers. |
| **P5-05** | Newsletter Digest Builder Studio | 📋 Backlog | Tier 2 | Low | 4 | A visual newsletter creator that compiles top starred/curated articles of the week into a responsive HTML email digest. |

### Phase 6: Edge AI Intelligence Layer

| Task ID | Task Title | Status | Tier | Priority | Est (Pts) | Key Deliverables & Acceptance Criteria |
| :--- | :--- | :---: | :---: | :---: | :---: | :--- |
| **P6-01** | 1-Click Executive AI Article Summaries | 📋 Backlog | Tier 3 | High | 3 | Integrate Cloudflare Workers AI (@cf/meta/llama-3-8b-instruct) to generate concise 2-bullet executive summaries directly inside article cards with KV response caching. |
| **P6-02** | AI Topic Clustering & Semantic De-duplication | 📋 Backlog | Tier 3 | Medium | 4 | Use Cloudflare Vectorize / Text Embeddings to cluster breaking news stories across multiple publishers into single aggregated topic streams. |
| **P6-03** | Brand, Competitor & Executive Tracker | 📋 Backlog | Tier 3 | Medium | 4 | Automated entity extraction and sentiment analysis tracking specific companies, brand mentions, and executive announcements across global feeds. |
| **P6-04** | AI Research Assistant & Interactive Q&A | 📋 Backlog | Tier 3 | Low | 4 | Interactive AI chatbot enabling users to ask questions, extract key takeaways, and synthesize trends across saved article collections. |

### Phase 7: Multi-Tenant Enterprise, Workspaces & APIs

| Task ID | Task Title | Status | Tier | Priority | Est (Pts) | Key Deliverables & Acceptance Criteria |
| :--- | :--- | :---: | :---: | :---: | :---: | :--- |
| **P7-01** | Multi-Tenant Team Workspaces Architecture | 📋 Backlog | Tier 3 | Medium | 4 | Implement multi-tenant workspace partitioning in Cloudflare D1 with workspace switcher, shared feed collections, and team member management. |
| **P7-02** | Role-Based Access Control (Admin/Editor/Viewer) | 📋 Backlog | Tier 3 | Medium | 3 | Granular permissions granting Admins billing/member management, Editors feed/rule curation, and Viewers read-only dashboard access. |
| **P7-03** | Enterprise SSO (SAML / OIDC) & Audit Logs | 📋 Backlog | Tier 3 | Low | 4 | Single Sign-On integration via Cloudflare Access / Okta / Azure AD with comprehensive compliance audit logging for team actions. |
| **P7-04** | Developer Public REST API & API Key Management | 📋 Backlog | Tier 3 | Low | 3 | Expose secure REST API with API key token generation, rate limiting, and OpenAPI/Swagger interactive documentation. |

---

## 4. Phase Dependency & Critical Path Diagram

```mermaid
graph TD
    P1["Phase 1: RSS Feed Reader & Core Infra (DONE ✅)"] --> P2["Phase 2: Personal Reader Fundamentals (ACTIVE 🚀)"]
    P2 --> P3["Phase 3: Cloud Identity & D1 Sync"]
    P2 --> P4["Phase 4: Search, Curation & Discovery"]
    P3 --> P5["Phase 5: SaaS Automation & Alerting Engine"]
    P4 --> P5
    P5 --> P6["Phase 6: Edge AI Intelligence (Workers AI)"]
    P5 --> P7["Phase 7: Multi-Tenant Enterprise & APIs"]
```

---

## 5. Summary Progress Tracker

* **Phase 1 Progress:** 9 of 9 Tasks Completed (100% DONE ✅)
* **Completed Story Points:** 33 / 125 Points (26% Overall Progress)
* **Current Active Sprint:** Phase 2 (Personal Reader Fundamentals)
* **Total Discrete Tasks in Roadmap:** 38 Tasks across 7 Phases
