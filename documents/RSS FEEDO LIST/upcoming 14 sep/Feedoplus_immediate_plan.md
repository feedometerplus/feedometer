# feedOmeter & FeedO+: Immediate Dual-Track Strategy & Project Plan
**Production Launch Lockdown & Isolated Dev/R&D Pipeline**

---

## 1. Executive Summary & Strategy Overview

### 1.1. The Dual-Track Mandate
To ensure maximum product velocity, zero disruption to end-users, and complete brand clarity, we are adopting a formal **Dual-Track Environment Architecture**:

1. **Track 1: Production Environment (`feedometer`)**
   * **Positioning:** *"A beautifully simple, ultra-fast, and reliable RSS reader."*
   * **Scope:** 100% focus on rock-solid, minimalist RSS reading.
   * **Action:** Keep the public build pure, lightning-fast, and completely unbloated.
   * **Outcome:** Instant launch readiness, SEO optimization, and immediate marketing execution without user friction.

2. **Track 2: Dev & R&D Sandbox (`feedo`)**
   * **Positioning:** *"Web Intelligence & Attention Aggregator — Signal, Context & Discussions."*
   * **Scope:** Aggressive feature engineering (Canonical Story Engine, Reddit OAuth API, Hacker News signals, First-Party Attention Telemetry, Community Pulse Score).
   * **Action:** Hosted on an independent repository and secondary Cloudflare environment.
   * **Outcome:** Fearless experimentation with zero risk of breaking live users or burning production API limits.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       PRODUCTION ENVIRONMENT (feedometer)                   │
│  GitHub: feedometer (main)  ──►  Cloudflare: Production Domain / Worker     │
│                                                                             │
│  • Pure, ultra-fast RSS Reader (100% stable, zero bloat)                    │
│  • Curated "Popular Feeds" Navigator & Custom Themes                        │
│  • Full in-app article reading & multi-device responsiveness                │
│  • Live for public users, social sharing & marketing launch                 │
└─────────────────────────────────────────────────────────────────────────────┘
                                     ▲
                                     │ (Tested, approved modules migrated)
                                     │
┌─────────────────────────────────────────────────────────────────────────────┐
│                          DEV / R&D SANDBOX (feedo)                          │
│  GitHub: feedo              ──►  Cloudflare: Dev Worker / Staging           │
│                                                                             │
│  • Canonical Story & Merge Engine (storyId Schema & URL Deduplication)      │
│  • Official Reddit OAuth 2.0 API (Real upvotes & comment counts)            │
│  • Hacker News Real-Time Signal Stream (Firebase API)                       │
│  • Dual-Action Cards ([Read Article] vs [Community Discussions])            │
│  • First-Party Engagement Telemetry (Proprietary Data Moat)                 │
│  • Topic Bundles & Community Pulse Score (0–100)                            │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Core Architectural Principles (The "Merge First" Rule)

### 2.1. The Canonical Story is the Product; Reddit & HN are Data
Ingesting social platforms before building a deduplication layer floods the reader with duplicate items (e.g. 1 blog post + 3 subreddit reposts + 1 HN post = 5 repetitive cards).

**Sequence Mandate:**
1. Build the **Canonical Story & Merge Layer first**.
2. Connect **Reddit & Hacker News second**.
3. When community data flows in, it automatically folds cleanly into the master story as rich discussion badges rather than noisy duplicate cards.

### 2.2. The `storyId` Container Model
Stories are anchored by a unique `storyId` rather than a single URL, future-proofing multi-outlet coverage (e.g., TechCrunch and The Verge covering the same event):

```typescript
interface CanonicalStory {
  storyId: string;                     // Unique story identifier (e.g. "story_20260914_openai_gpt5")
  title: string;                       // Clean, normalized headline
  summary: string;                     // Core editorial excerpt
  heroImage?: string;                  // High-resolution preview image
  primarySource: {                     // Original breaking publisher
    name: string;                      // e.g. "OpenAI Blog"
    domain: string;                    // "openai.com"
    url: string;                       // https://openai.com/blog/gpt-5
    publishedAt: string;
  };
  relatedCoverage: {                   // Secondary coverage from news outlets
    source: string;                    // e.g. "The Verge", "Ars Technica"
    url: string;
    publishedAt: string;
  }[];
  discussions: {                       // Social signal layer
    platform: 'reddit' | 'hn' | 'x';
    community: string;                 // "r/LocalLLaMA", "Hacker News"
    url: string;
    score: number;                     // Upvotes / Points
    commentsCount: number;
    trendingVelocity?: number;         // e.g. "+65% surge"
  }[];
  metrics: {
    communityPulse: number;            // Normalized 0 - 100 score
    internalReadsCount: number;        // FeedO reader opens
    internalSavesCount: number;        // FeedO bookmarks/stars
    estimatedReadTimeMinutes: number;
  };
}
```

### 2.3. The Proprietary Data Moat (First-Party FeedO Signals)
While competitors can scrape public Reddit/HN scores, FeedO will capture anonymous, first-party user engagement:

$$\text{Community Pulse} = \underbrace{\Big(w_1 \cdot \text{Reddit Karma} + w_2 \cdot \text{HN Points}\Big)}_{\text{Public Attention Signals}} + \underbrace{\Big(w_3 \cdot \text{FeedO Reads} + w_4 \cdot \text{FeedO Saves}\Big)}_{\text{Proprietary First-Party Moat}}$$

---

## 3. Comprehensive Work Breakdown Structure (WBS)

### Track 1: Production Lockdown & Public Launch Readiness (`feedometer`)

* [ ] **Task 1.1: Revert Experimental Plugin from Production**
  * Remove `<script src="feedoplus/feedoplus.js"></script>` from `index.html`.
  * Ensure top-left exclusively displays the clean `READ F.M` logo.
  * Verify top-right Navigator and theme switcher operate flawlessly.
* [ ] **Task 1.2: End-to-End Core Reader Regression Testing**
  * Validate default feeds (The Verge, NYT World, ScienceDaily, Wired, TechCrunch).
  * Test custom user inputs (Substack, Medium, BBC, GitHub Releases).
  * Confirm article extraction, full reader view, and modal overlays work smoothly.
* [ ] **Task 1.3: Asset, Icon & Metadata Audit**
  * Verify `favicon.ico`, `favicon.png` (512x512), and `favicon.svg` load across all browsers.
  * Check OpenGraph meta tags and Twitter cards for public social sharing.
* [ ] **Task 1.4: Production Git & Cloudflare Sync**
  * Commit clean production code to the primary `feedometer` repository.
  * Verify Cloudflare Worker (`feedometer-api`) routes and CORS headers.
* [ ] **Task 1.5: Public Launch Execution**
  * Kick off initial marketing, outreach, community directories, and social sharing.

---

### Track 2: Development & Staging Environment Setup (`feedo`)

* [ ] **Task 2.1: Initialize Secondary GitHub Repository**
  * Create repository: `feedo` (or `feedo-plus`).
  * Push the complete codebase including `feedoplus/` plugin directory.
* [ ] **Task 2.2: Setup Secondary Cloudflare Account / Worker**
  * Create new Cloudflare account/project for the dev environment.
  * Deploy `feedo-dev-worker` with independent routing and environment variables.
* [ ] **Task 2.3: Configure Dev Environment Endpoints**
  * Point dev frontend to query `feedo-dev-worker`.
  * Add dev environment badge (e.g. `[FEEDO LAB]`) in footer for clear visual distinction.
* [ ] **Task 2.4: Validate Complete Environmental Isolation**
  * Confirm zero shared state or cross-talk between Prod and Dev environments.

---

### Track 3: Canonical Story & Merge Engine (Dev Sandbox — Core Foundation)

* [ ] **Task 3.1: URL Normalizer & Parameter Stripper**
  * Strip tracking parameters (`utm_*`, `ref`, `fbclid`, `gclid`).
  * Normalize destination URLs across news sources and social posts.
* [ ] **Task 3.2: Implement `storyId` Container Model**
  * Build the `CanonicalStory` data assembler supporting primary articles, related coverage, and discussions.
  * Implement `NativeDiscussionItem` schema for community self-posts (Show HNs, AMAs).
* [ ] **Task 3.3: Dual-Action Card Interface**
  * Design clean card UI with primary `[ 📖 Read Article ]` and secondary `[ 🗨️ View Discussions ]` buttons.
  * Display interactive badges with live metrics: `🟠 HN (420 pts)` • `🔴 r/LocalLLaMA (910 votes)`.
* [ ] **Task 3.4: Local Story Deduplication Test Suite**
  * Test merging of 20+ simulated mixed feeds to guarantee zero duplicate headlines.

---

### Track 4: Official Reddit API & Ingestion (Dev Sandbox)

* [ ] **Task 4.1: Reddit Developer App Registration**
  * Register new app on Reddit Developer Portal to obtain `Client ID` and `Client Secret`.
* [ ] **Task 4.2: OAuth 2.0 Token Manager in Cloudflare Worker**
  * Implement automated Client Credentials token exchange (`/api/v1/access_token`) with in-memory/KV token caching.
* [ ] **Task 4.3: Structured Subreddit JSON Handler**
  * Query `/r/{subreddit}/hot.json` with Bearer token and parse clean karma scores, comment counts, author, and thumbnails.
* [ ] **Task 4.4: Rate-Limit Monitor & Fallback Mechanism**
  * Track rate-limit headers (`x-ratelimit-remaining`) and implement graceful fallback to anonymous syndication if needed.

---

### Track 5: Hacker News Integration & First-Party Attention Signals (Dev Sandbox)

* [ ] **Task 5.1: Real-Time Hacker News Ingestion**
  * Connect official Firebase Hacker News API endpoints (`topstories`, `item/{id}`).
  * Match HN stories against primary RSS articles and Reddit discussions by normalized URL.
* [ ] **Task 5.2: First-Party Engagement Telemetry**
  * Track client-side article reads, click-throughs, and bookmark saves.
  * Store anonymous engagement telemetry in worker KV storage.
* [ ] **Task 5.3: Community Pulse Score Algorithm (0–100)**
  * Implement normalized formula combining external signals (Reddit + HN) + first-party reader engagement.
* [ ] **Task 5.4: "Why Am I Seeing This?" Explainability Popovers**
  * Build interactive popovers explaining ranking signals (e.g., *#1 on Hacker News, +65% velocity in 3h*).

---

### Track 6: Staging Validation & Production Migration Protocol

* [ ] **Task 6.1: Quality Assurance & Cross-Browser Testing**
  * Execute comprehensive QA across Chrome, Firefox, Safari, iOS, and Android.
* [ ] **Task 6.2: Modular Release Packaging**
  * Package validated features into clean, modular pull requests / cherry-picks.
* [ ] **Task 6.3: Seamless Production Rollout**
  * Deploy approved features to Production with zero downtime and publish release notes.

---

## 4. Execution Milestones & Dependency Roadmap

```
[ MILESTONE 1: PROD LAUNCH ] ────────► Clean, pure RSS reader live for marketing (feedometer)
             │
[ MILESTONE 2: DEV SANDBOX ] ────────► Independent GitHub repo & Cloudflare instance (feedo)
             │
[ MILESTONE 3: CANONICAL ENGINE ] ───► storyId schema, URL deduplication, dual-action cards
             │
[ MILESTONE 4: REDDIT OAUTH ] ───────► Real karma & comment counts streaming via Bearer token
             │
[ MILESTONE 5: HN & ATTENTION ] ─────► Firebase HN API + first-party engagement telemetry
             │
[ MILESTONE 6: PULSE & EXPLAIN ] ────► 0–100 Community Pulse & "Why Am I Seeing This?" cards
             │
[ MILESTONE 7: MIGRATION RELEASE ] ──► Battle-tested FeedO+ intelligence promoted to Production
```

---
*Document saved to: `C:\feedometer\documents\RSS FEEDO LIST\upcoming 14 sep\Feedoplus_immediate_plan.md`*
