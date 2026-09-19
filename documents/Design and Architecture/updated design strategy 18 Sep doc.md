# FeedOmeter Architecture: Updated Design Strategy (18 Sep 2026)
**Document:** Pure Edge-First Image & Feed Processing Architecture  
**Version:** 2.0 (Unified Edge Model)  
**Date:** September 18, 2026  
**Status:** Approved Architectural Blueprint  

---

## 1. Executive Summary & Core Principle

The FeedOmeter architecture is refined to follow a strict **100% Edge-First, Server-Side Processing Principle**:
* **All Business Logic, RSS Parsing, Image Extraction, and Thumbnail Resolution live exclusively on the Cloudflare Worker.**
* **The Browser Client is a Pure Presentation Layer:** It issues exactly **1 single HTTP request** per feed, receives a fully assembled, ready-to-render JSON payload, and paints cards synchronously.
* **Elimination of Client-Side Scraper:** Completely removes the 24-request background loop (`startThumbnailOgEnrichment`) from the frontend, eliminating thumbnail flickering/pop-in, reducing mobile battery drain, and cutting browser network overhead by 96%.

---

## 2. End-to-End Edge Architecture Workflow

```
[ FRONTEND CLIENT (Browser) ]
       │
       │  1. Single Request: GET /api/view?url=<feed_url>
       ▼
┌─────────────────────────────────────────────────────────────┐
│             CLOUDFLARE WORKER PIPELINE                      │
├─────────────────────────────────────────────────────────────┤
│ 1. KV CACHE LOOKUP:                                         │
│    • Query `FEEDS_KV.get(cacheKey)`                         │
│    • Cache Hit (Pre-warmed/Cached): Return JSON in < 30ms ⚡  │
│                                                             │
│ 2. XML EXTRACTION (On Cache Miss):                          │
│    • Fetch RSS/Atom/JSON XML feed payload                   │
│    • Parse <media:content>, <media:thumbnail>, <enclosure>  │
│    • Extract inline <img> tags and highest-res srcset       │
│                                                             │
│ 3. EDGE HERO IMAGE ENRICHMENT (Missing thumbnails only):     │
│    • Bounded server-side head scraping for top articles     │
│    • Extract <meta property="og:image"> / <meta name="twitter:image">│
│    • Strip tracking params & normalize image URLs           │
│                                                             │
│ 4. STORAGE & PROPAGATION:                                   │
│    • Store ready-to-render payload in `FEEDS_KV` (4h-24h TTL│
│    • Populate Cloudflare Global Edge Cache (caches.default) │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               │  2. Complete Ready-to-Render JSON
                               ▼
[ READY-TO-RENDER JSON ]
 • title, description, link, pubDate, image (100% pre-resolved)
                               │
                               ▼
[ LEAN FRONTEND RENDER ]
 • Instant 1-pass card render
 • Zero layout shifts, zero /api/og calls
```

---

## 3. Background Cron Pre-Warming Workflow

```
[ CLOUDFLARE CRON TRIGGER (0 */4 * * *) ]
       │
       ▼
[ WORKER PRE-WARM ENGINE ]
 • Iterates through curated 25 popular outlets & D1 active feeds
 • Fetches fresh XML, resolves all article thumbnails
 • Pre-populates `FEEDS_KV` cache
       │
       ▼
[ REAL USER EXPERIENCE ]
 • 100% Cache HIT for popular feeds
 • Instant < 30ms response time on mobile and desktop
```

---

## 4. Frontend Simplification (What is Removed)

To ensure zero client-side lag and clean separation of concerns, the following legacy client-side scraping mechanisms are removed from `feedometer-viewer.js`:

| Removed Frontend Logic | Reason for Removal | New Replacement |
| :--- | :--- | :--- |
| `startThumbnailOgEnrichment()` | Fired up to 24 background HTTP requests | Worker resolves all thumbnails server-side |
| `fetchOgImageForArticle()` | Made secondary calls to `/api/og?url=...` | Worker returns `item.image` in primary JSON |
| `tryOgThumbnailForItem()` | Polled for missing images per card | Images painted synchronously on first render |
| `ogImageCache` & `thumbnailEnrichGen` | Client-side memory maps & race condition guards | Replaced by global `FEEDS_KV` edge cache |

---

## 5. Performance, Battery & SEO Impact Comparison

| Engineering Metric | Legacy Split Model | New Pure Edge-First Model | Impact |
| :--- | :--- | :--- | :--- |
| **Browser HTTP Requests** | 25+ requests per feed | **1 Single HTTP request** | **96% Reduction** |
| **Thumbnail Rendering** | 2–4s async pop-in | **Instant Synchronous Paint (0s lag)** | **100% Smooth** |
| **Mobile Battery & CPU** | High (24 parallel network promises) | **Near-Zero (Plain DOM injection)** | **Optimized** |
| **Edge Cache Retrieval** | Cold client-side state | **< 30ms KV Warm Edge Cache** | **Sub-50ms TTFB** |
| **SEO & Crawler Uniformity** | Inconsistent (client-rendered thumbnails) | **Identical JSON delivered to all crawlers** | **Googlebot Verified** |
| **Code Maintenance** | Split across 2 codebases | **100% Centralized in Worker backend** | **Clean & Modular** |
