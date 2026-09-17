# FeedOmeter: Tracking Key Metrics for Performance & User Analytics

**Document Title:** Tracking Key Metrics for Performance Doc  
**Target Path:** `C:\feedometer\documents\User Traffic Feedometer\Tracking Key Metrics for performance doc.md`  
**System:** FeedOmeter RSS Reader & Discovery Platform  
**Target Infrastructure:** Cloudflare (Workers, Pages, Web Analytics, Analytics Engine), Browser Telemetry  
**Status:** Strategic Design & Architecture Specification  

---

## 1. Executive Overview

This document outlines the telemetry, analytics, and user engagement tracking strategy for **FeedOmeter**. It defines the metrics to monitor product growth, user engagement depth, reading behavior, and system health while maintaining user privacy and GDPR/ePrivacy compliance.

---

## 2. Key Metrics We Can Track

| Metric Category | Specific Metrics | How It Helps FeedOmeter |
|---|---|---|
| **Traffic & Reach** | • Total Visitors & Unique Visitors<br>• Page views (Homepage vs. Reader mode)<br>• Bounce rate & Exit pages | Quantifies audience reach and identifies drop-off points. |
| **Feed Engagement** | • **Feed Attempt Rate:** % of visitors who submit or click a feed.<br>• **Feeds per User Session:** Number of distinct feeds consumed per visit (1 vs. 3 vs. 8+).<br>• **Feed Switching Velocity:** Time elapsed between changing feeds. | Measures core product stickiness and discovery depth. |
| **Dwell Time & Reading** | • **Total Session Duration:** Elapsed time on site.<br>• **Active Reading Time:** Time spent actively scrolling, hovering, and reading articles (excluding background/inactive tabs). | Differentiates quick skimmers from dedicated, deep readers. |
| **Content & Feature Popularity** | • Top searched/loaded feed URLs & publishers.<br>• Most clicked curated publishers (BBC, TechCrunch, NASA, etc.).<br>• Outbound story link clicks (articles opened in external tabs).<br>• Theme & background color toggle frequency.<br>• Search/filter keyword queries within loaded feeds. | Informs homepage layout, curated directory prioritization, and UI feature improvements. |
| **System Health & Safety** | • Feed fetch error rates (404, invalid XML, timeout).<br>• SSRF protection trigger count.<br>• Extremist/hate content block frequency.<br>• Edge cache hit ratio vs. origin fetch latency. | Ensures infrastructure stability and content safety enforcement. |

---

## 3. Accessible User Data & Privacy Boundary

When a user visits FeedOmeter, client browsers and Cloudflare edge nodes provide specific technical and contextual data points:

### 3.1 Network & Geographic Data (Cloudflare Edge Headers)
* **Country, Region, City:** Approximate geographic location derived from IP (e.g., `United States, California, San Francisco` or `India, Karnataka, Bengaluru`).
* **ISP / Autonomous System (ASN):** Network provider (e.g., Comcast, Airtel, Jio, AWS, Google Cloud).
* **Connection Protocol:** HTTP/2, HTTP/3, QUIC, TLS cipher version.
* **IP Address Handling:** The Cloudflare Worker receives the client IP (`request.headers.get('cf-connecting-ip')`). In privacy-first analytics, the IP is hashed using a daily rotating salt (`SHA-256(IP + Salt)`) to count unique daily visitors without storing Personally Identifiable Information (PII).

### 3.2 Device & Browser Environment (Browser Client)
* **Device Category:** Mobile phone, Tablet, or Desktop/Laptop.
* **Operating System:** Windows, macOS, iOS, Android, Linux.
* **Browser Engine & Version:** Chrome, Safari, Firefox, Edge, Brave, Opera.
* **Screen Resolution & Viewport:** e.g., `1920x1080` (Desktop) or `390x844` (iPhone 14).
* **System Preferences:** Color scheme preference (`prefers-color-scheme: dark/light`), reduced motion settings.
* **Language / Locale:** Browser preferred language (e.g., `en-US`, `hi-IN`, `es-ES`, `de-DE`).

### 3.3 Traffic Source & Attribution
* **Referrer URL:** Originating page (e.g., Google Search, Twitter/X, Reddit, LinkedIn, direct bookmark).
* **Campaign Attribution (UTMs):** Inbound campaign parameters (`utm_source`, `utm_medium`, `utm_campaign`, `utm_content`).

### 3.4 🔒 Privacy Boundaries (What We Do NOT Collect)
* No personal identity data (no name, email, phone number, physical address without explicit user login).
* No precise GPS coordinates (only approximate city/region derived at edge).
* No cross-site tracking or browsing history outside `feedometer.com`.
* No access to local files, camera, microphone, or private device sensors.

---

## 4. Implementation Options Architecture

```
                     +---------------------------------------------------------+
                     |                  FeedOmeter User                        |
                     +----------------------------+----------------------------+
                                                  |
                  +-------------------------------+-------------------------------+
                  |                               |                               |
                  v                               v                               v
       [Option 1: Cloudflare Web]     [Option 2: Worker Edge Native]    [Option 3: Product Analytics]
       • Zero code / 1 script tag      • Tracks feed queries & proxy     • PostHog / Umami / Plausible
       • Visitors, countries, tech     • Top feeds, response times       • Funnels, reading time,
       • 100% Free & GDPR-ready        • Zero third-party scripts        • Feeds per user session
```

### Option 1: Cloudflare Web Analytics (Zero-Config & Built-In)
* **Mechanism:** Single lightweight JavaScript snippet or Cloudflare automatic proxy injection.
* **Advantages:** 100% free, zero maintenance, privacy-first (no cookies, no GDPR cookie banners required), automatic bot-traffic filtering, Core Web Vitals (LCP, FID, CLS) tracking.
* **Limitations:** Does not record granular in-app user interactions (e.g., "clicked 3rd story in NASA feed").

### Option 2: FeedOmeter Edge-Native Telemetry (`feedometer-worker.js`)
* **Mechanism:** Telemetry hooks inside the Cloudflare Worker combined with lightweight front-end beacon events (`navigator.sendBeacon`).
* **Advantages:**
  * Zero third-party analytics scripts.
  * Records feed queries, cache hit ratios, origin latencies, and moderation block events directly at the edge.
  * Stores aggregated metrics in Cloudflare KV or Cloudflare Analytics Engine without incurring additional hosting costs.
* **Data Logged:** Feed URL, request duration, country, device type, moderation tag, and cache status.

### Option 3: Modern Product Analytics (PostHog / Plausible / Umami)
* **PostHog (Recommended for Deep Product Insights):**
  * Generous free tier (1,000,000 events/month).
  * **Funnels:** Land on Page -> Open Flame Menu -> Read Feed -> Click External Article.
  * **Active Dwell Time:** Exact seconds spent actively reading each feed.
  * **Retention Cohorts:** Measures day-1, day-7, and day-30 return rates.
* **Plausible / Umami (Ultra-Lightweight & Cookieless):**
  * Minimal payload (<1 KB), privacy-first, clean visual dashboard.

---

## 5. Strategic Recommendation for FeedOmeter

A **two-layer hybrid telemetry model** provides maximum visibility with minimal complexity:
1. **Layer 1 (Baseline Traffic & Vitals):** Enable Cloudflare Web Analytics for visitor counts, top countries, browser stats, and page loading speeds.
2. **Layer 2 (Engagement & Feed Intelligence):** Implement a lightweight custom event beacon (or PostHog integration) to track:
   * Total feeds consumed per session.
   * Active reading time per feed.
   * Most popular curated feeds and external article clicks.
   * Blocked / invalid feed diagnostics.

---

## 6. Bolt-On (Zero-Coupling) Architecture & Implementation Specification

To ensure FeedOmeter remains lightweight, maintainable, and completely decoupled from analytics vendors or telemetry dependencies, the tracking system is designed as an **independent "bolt-on" plugin**.

### 6.1 Architectural Isolation Principles
1. **Zero Core Dependencies:** Core reader files (`scripts/feedometer-viewer.js`, `index.html`, and `feedometer.css`) operate completely independently without hard-coded tracking dependencies.
2. **Passive Event Observation:** The telemetry layer observes standard browser lifecycle hooks and custom DOM events (e.g., `window.addEventListener('feedometer:feed-loaded')`) rather than invasive inline code modifications.
3. **Instant Removal / Kill Switch:** The telemetry layer can be disabled or permanently removed at any time with zero impact on reader functionality:
   * **Temporary Disable:** Set `window.FEEDOMETER_TRACKING = false;` in `index.html`.
   * **Permanent Removal:** Delete `scripts/feedometer-telemetry.js` and remove its single `<script>` tag from `index.html`.

---

### 6.2 Architecture Diagram

```
┌────────────────────────────────────────────────────────────────────────┐
│                        FeedOmeter Core Engine                          │
│                                                                        │
│   [Search Feed] ───► [Render Stories] ───► [Color Picker / Modals]     │
│         │                    │                                         │
│         ▼                    ▼                                         │
│   (Emits Standard DOM Events: "feed:loaded", "story:click", etc.)      │
└─────────┬────────────────────┬─────────────────────────────────────────┘
          │                    │  ◄── (Passive Event Listening / No hard references)
┌─────────▼────────────────────▼─────────────────────────────────────────┐
│              OPTIONAL BOLT-ON: feedometer-telemetry.js                 │
│                                                                        │
│  • Tracks session feeds count (Feeds per session)                      │
│  • Calculates active reading timer (pauses when tab is hidden/idle)    │
│  • Aggregates top publishers visited                                   │
│  • Sends lightweight beacon to Worker edge or PostHog                  │
│                                                                        │
│  [KILL SWITCH]: window.FEEDOMETER_TRACKING = false (or remove script)  │
└────────────────────────────────────────────────────────────────────────┘
```

---

### 6.3 Tracked Engagement Dimensions

1. **Feeds Viewed Per Session:**
   * Increments an in-memory session counter whenever a new feed is successfully loaded.
   * Tracks user discovery progression (e.g., `['BBC News', 'NASA Breaking', 'The Verge']`).

2. **Active Reading Time Engine:**
   * Utilizes the browser's `document.visibilityState` and `window.onblur / onfocus` APIs.
   * **Smart Idle Detection:** If the user switches tabs or remains inactive for >60 seconds, the active timer pauses immediately so data reflects genuine reading attention rather than forgotten background tabs.

3. **Top Publishers & Stories Engaged:**
   * Logs which curated publishers (from the Flame menu, publisher modal, or direct URL search) are opened.
   * Logs outbound article link clicks to track story engagement.

4. **Built-In Local Debug Inspector:**
   * Developers and site owners can inspect live session metrics directly in the browser DevTools console at any time by calling `FeedOmeterTelemetry.getStats()`:
     ```json
     {
       "sessionId": "sess_8f29a1b0",
       "feedsLoaded": 4,
       "activeReadingSeconds": 142,
       "publishers": ["BBC News", "NASA Breaking News", "The Verge"],
       "storiesClicked": 2
     }
     ```

5. **Edge Worker Ingestion (`/api/telemetry`):**
   * Uses `navigator.sendBeacon()` upon session end or page unload to dispatch an ultra-compact (<200 bytes) non-blocking JSON telemetry ping to the Cloudflare Worker edge.

---

## 7. What Was Implemented (Implementation Record)

### 7.1 Bolt-On Front-End Tracker (`scripts/feedometer-telemetry.js`)
* **Zero Core Coupling:** Standalone module loaded via `<script src="scripts/feedometer-telemetry.js"></script>` in `index.html`. If this file or script tag is deleted, the core reader continues running with 100% functionality and zero errors.
* **Master Kill-Switch:** Setting `window.FEEDOMETER_TRACKING = false;` completely disables tracking instantly.
* **Feeds per Session Tracker:** Accurately counts how many feeds each visitor loads during their visit and records their discovery pathway.
* **Active Reading Time Engine:** Employs `document.visibilityState` and idle listeners (`mousemove`, `keydown`, `scroll`, `touchstart`) with a 60-second inactivity pause to measure genuine user attention rather than forgotten tabs.
* **Publisher & Story Engagement:** Passively observes curated publisher clicks (Flame menu, publisher modal, quick pills) and external story link clicks.
* **Live Console Inspector:** Developers and administrators can type `FeedOmeterTelemetry.getStats()` in the browser DevTools console at any time to inspect live session stats.

### 7.2 Core Viewer Passive Events (`scripts/feedometer-viewer.js`)
* Emits lightweight standard DOM CustomEvents:
  * `feedometer:feed-loaded`: Dispatches title, feed URL, item count, and publisher name upon successful feed load.
  * `feedometer:feed-error`: Dispatches feed URL and error code if a feed fails or is blocked.
  * `feedometer:story-clicked`: Dispatches story title and link when clicked.
* Wrapped safely in `try/catch` blocks to ensure zero execution risk or performance impact.

### 7.3 Cloudflare Worker Edge Telemetry Ingestion (`workers/feedometer-worker.js`)
* Added `/api/telemetry` and `/api/event` endpoint.
* Ingests non-blocking `navigator.sendBeacon` telemetry pings on session unload or feed transitions.
* Enriches events with edge metadata: country (`request.cf.country`), city (`request.cf.city`), region (`request.cf.region`), and ASN (`request.cf.asn`).
* IP addresses are anonymized and zero PII is stored.

### 7.4 Verification & Test Results
* Unit and integration test suite executed:
  * Syntax validation for all scripts: **PASSED (100%)**
  * Custom event dispatch & capture: **PASSED (100%)**
  * Feeds per session incrementing: **PASSED (100%)**
  * Session storage isolation: **PASSED (100%)**
  * Live console inspection API: **PASSED (100%)**
