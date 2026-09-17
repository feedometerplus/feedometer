# Gaps & Architectural Improvement Audit: Feedometer Feed Engine

**Date:** September 11, 2026  
**Document:** `gaps-audit-normalization.md`  
**Target:** Feed Intelligence, Security, Parsing, Image Scoring, Deduplication & Edge Runtime.

---

## 1. 🛡️ IP & API Protection: The "Free Feed Extraction API" Vulnerability

### Current State
- `feedometer-worker.js` returns `Access-Control-Allow-Origin: *` across all `/api/*` endpoints.
- No origin verification, token signing, or rate limiting is enforced on the worker.

### The Gaps & Risks
- **Free Extraction Engine for Competitors:** Anyone can build their own frontend or scrape with Python and use your Cloudflare Worker as a free, compute-heavy feed normalizer and HTML scraper.
- **Black-Box Reverse Engineering:** Competitors can feed hundreds of synthetic RSS feeds into `/api/view` and inspect output JSON to deduce your extraction rules.
- **Cloudflare Bill Exhaustion:** Malicious actors or high-volume scrapers can burn through your Workers request quota (and subrequest allocations).

### Recommended Improvements (Phase 3 / Dashboard)
1. **Cloudflare Rate Limiting (WAF Rule):** Enforce strict per-IP rate limits (e.g. 30–60 req/min) on `/api/*` in the Cloudflare Dashboard to block bulk scrapers before they hit Worker compute.
2. **Custom Domain Route:** Attach `api.feedometer.app` and disable the public `*.workers.dev` trigger route in the Cloudflare Dashboard so scrapers cannot bypass your WAF.

---

## 2. 🧩 Parsing Engine & Custom XML Namespaces: [RESOLVED / FIXED ✅]

### Status: RESOLVED via Feedometer Engine 2.0
- **Namespace-Agnostic Tag Extractor:** `extractTagContent` and `extractAttr` now support both standard tags (`<title>`, `<link>`) and any custom XML namespace prefix (`<ns6:title>`, `<dc:creator>`, `<content:encoded>`, `<itunes:image>`).
- **Namespace-Agnostic Stream Tokenizers:** `looksLikeFeedXml`, `entryRegex`, and `itemRegex` detect and iterate over entries regardless of namespace wrappers (e.g. `<ns6:entry>`, `<rdf:item>`).
- **Relative Link Resolution:** Relative article links (e.g. `/2026/09/...`) are automatically resolved to absolute URLs against `meta.link` or `baseUrl`.
- **100% Server-Side:** Implemented inside `feedometer-worker.js` with zero client-side code exposure.

---

## 3. 🌐 Adaptive Dual-Tier Upstream Engine (The CDN Firewall Fix): [RESOLVED / FIXED ✅]

### Status: RESOLVED via Feedometer Engine 2.1
- **Tier 1 (FeedometerBot 1.0):** Outgoing feed streams default to RFC aggregator identity `Mozilla/5.0 (compatible; FeedometerBot/1.0; +https://feedometer.pages.dev)` to satisfy bot-whitelisting CDNs like Akamai (ESPN).
- **Tier 2 (Adaptive Browser Fallback + HTTPS Upgrade):** If Tier 1 encounters timeouts, dropped sockets, 202 challenges, or 403/520 statuses, the Worker automatically upgrades to `https://` with Browser Profile + `Referer: origin` to satisfy bot-restricted CDNs like Fastly/Shield (U.S. News).
- **100% Server-Side:** Implemented inside `feedometer-worker.js` with zero client-side code exposure.

---

## 4. 🖼️ Image Extraction & Hero Scoring: First-Match vs. Multi-Signal Scoring

### Current State
- `extractItemImage` and `isUsableHeroImage` pick the first image encountered in the XML/HTML that is not explicitly in the blacklist (favicon, logo, sprite).

### The Gaps & Risks
- **First-Match False Positives:** Many popular publications (Substack, Medium, WordPress blogs) place author avatars, author badges, or sponsor banners in the HTML before the main featured hero image.
- **Sub-optimal `srcset` Selection:** `srcset` extraction currently grabs the first item instead of picking the highest-resolution or best-aspect-ratio candidate (e.g. `1200w` vs `320w`).

### Recommended Improvements: Scored Candidate Pipeline
Collect all candidate URLs in an article and score them using a weighted multi-signal heuristic:

$$\text{Score} = w_{\text{source}} + w_{\text{dimension}} + w_{\text{aspect\_ratio}} + w_{\text{keywords}} - p_{\text{penalties}}$$

| Signal | Scoring Rule |
| :--- | :--- |
| **Source Type** | `<media:content medium="image">` (+40), `og:image` (+35), `<enclosure>` (+30), `<img>` in content (+15) |
| **`srcset` Density** | URL matching `800w`–`1600w` or `@2x` (+20) |
| **URL Keywords** | Contains `hero`, `featured`, `header`, `lead`, `cover` (+25) |
| **Negative Keywords** | Contains `author`, `avatar`, `sponsor`, `advert`, `icon`, `share-button` (-50) |
| **Extension/Format** | Modern formats (`.webp`, `.avif`, `.jpg`, `.png`) prioritized over `.gif` |

---

## 5. 🔁 Deduplication: Exact Matching vs. Semantic / Syndication Dedupe

### Current State
- `dedupeItems` matches against: (1) `item.id`, (2) normalized `urlKey`, (3) fallback `simpleHash(title + publishedAt)`.

### The Gaps & Risks
- **Syndicated Articles:** Identical articles republished across wire services (AP, Reuters, Yahoo, MSN) have different GUIDs and URLs, resulting in duplicate cards.
- **Editorial Tweaks & Edits:** Minor headline typos fixed 5 minutes after publishing or date updates bypass the exact `simpleHash`.
- **Editorial Prefixes:** Titles with tags like `[Live Updates]`, `WATCH:`, `Breaking:`, or `PODCAST:` don't match without normalization.

### Recommended Improvements
1. **Title Stemming & Prefix Stripping:** Strip prefixes (`[Breaking]`, `Opinion:`, `(Updated)`), trim stop words (`a`, `the`, `in`), and collapse punctuation.
2. **Fuzzy / Near-Duplicate Detection (SimHash / Token Jaccard):**
   - Calculate 64-bit SimHash of title 3-grams.
   - If Hamming distance $\le 3$, group as duplicates and keep the richest item.

---

## 6. ⚡ Cloudflare Worker Runtime Limits (`ctx.waitUntil` Subrequests)

### Current State
- On a cache MISS, `ctx.waitUntil` triggers `enrichItemsMissingHeroImages` for up to 12 items, firing 12 subrequests in parallel.

### The Gaps & Risks
- **Subrequest Limits:** Cloudflare limits Workers to 50 subrequests per invocation. High-volume miss traffic can hit worker subrequest exhaustion.
- **Bot-Blocked Origins:** Sites behind Cloudflare Bot Fight Mode, Turnstile, or Akamai return 403s, wasting worker execution time on repetitive doomed fetches.

### Recommended Improvements
1. **Subrequest Budgeting:** Cap background enrichment to the top 5–6 items.
2. **Domain-level Circuit Breakers:** If a domain returns 403 on article fetch, cache the failure at the domain level to prevent making 12 wasted subrequests.

---

## 7. 💻 Frontend Privacy & Favicon Resolution: [RESOLVED / FIXED ✅]

### Status: RESOLVED
- **Google Favicon API Leak:** Completely **removed**.
- **Worker-side Resolution:** The Worker extracts `meta.feedIcon` via `pickFeedIcon(xml, baseUrl)` from `<itunes:image>`, `<icon>`, or `<image><url>`.
- **Frontend Hydration:** `scripts/feedometer-viewer.js:601` now binds directly to `currentFeedMeta.feedIcon` without making any third-party external calls to Google or external favicon trackers.

---

## 🎯 Priority Matrix

| Priority | Feature / Gap | Impact | Effort | Status |
| :---: | :--- | :---: | :---: | :---: |
| **P1** | **Universal XML Namespace Parser (Feedometer Engine 2.0)** | Handles HBR, Atom `ns6:`, Dublin Core, etc. | Medium | **DONE ✅** |
| **P2** | **Adaptive Dual-Tier Fetch Pipeline (Feedometer Engine 2.1)** | Solves both Akamai (ESPN) and Fastly/Shield (U.S. News) | Medium | **DONE ✅** |
| **P3** | **Frontend Favicon Privacy Leak Elimination** | Zero third-party IP leakage to Google | Low | **DONE ✅** |
| **P4** | **Image Extraction Scoring Pipeline** | Fixes avatar/banner false positives | Medium | Open |
| **P5** | **Subrequest Circuit Breakers & Budgeting** | Prevents subrequest exhaustion & 403 waste | Low | Open |
| **P6** | **Fuzzy / Near-Duplicate Deduplication** | Detects syndicated / edited articles | Medium | Open |
| **P7** | **Cloudflare Dashboard WAF / Rate Limiting** | Stops API bulk scraping & abuse | Low | Phase 3 (Dashboard) |