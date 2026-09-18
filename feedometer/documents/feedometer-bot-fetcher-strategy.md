# FeedometerBot 1.0 & Resilient Feed Fetcher Strategy

**Date:** September 11, 2026  
**Document:** `feedometer-bot-fetcher-strategy.md`  
**Target:** Feed Fetcher Identity, Akamai/Cloudflare Bot Bypass, and Dual-Tier Upstream Resilience.

---

## 1. 📌 Background & The Akamai / ESPN Case Study

### The Problem
When users attempted to load `http://sports.espn.go.com/espn/rss/news` on `feedometer.pages.dev`, the reader returned:  
> *"We couldn't access the feed. Try another one please....."*

However, the exact same URL worked flawlessly in other RSS readers (Feedly, Inoreader) and in command-line tools (`curl`).

### Root Cause Analysis
1. **Datacenter IP + Chrome UA Mismatch:**  
   `feedometer-worker.js` was configured to send a standard desktop Chrome browser User-Agent (`Mozilla/5.0 ... Chrome/131.0.0.0`) from Cloudflare Worker datacenter IPs.
2. **Akamai Bot Defense Intervention:**  
   Major publisher networks protected by Akamai Bot Manager (such as ESPN / Disney) identify requests coming from datacenter IPs with desktop browser User-Agents as **automated headless browser scrapers**.
3. **The 202 Challenge Response:**  
   Instead of serving the XML, Akamai intercepts the request with a JavaScript challenge, responding with **`HTTP 202 Accepted` and a `0-byte` empty payload**.
4. **Worker Validation Failure:**  
   The Worker receives 0 bytes, fails XML validation, and emits `HTTP 422: "Not a valid RSS or Atom feed."`, which the frontend displays as a general connection failure.

---

## 2. 🤖 The Solution: FeedometerBot 1.0 Identity

### Why RSS Readers Need a Bot Identity
Major CDNs and publisher firewalls (Akamai, Cloudflare, Fastly, AWS CloudFront) maintain explicit **whitelists for legitimate RSS readers and web aggregators** on `/rss/*`, `/feed/*`, and `.xml` endpoints. When a request identifies itself as an RSS crawler, CDNs bypass headless browser challenges and return raw XML immediately.

### Specification: FeedometerBot User-Agent String
```http
User-Agent: Mozilla/5.0 (compatible; FeedometerBot/1.0; +https://feedometer.pages.dev)
```

### Why this format works:
- **`Mozilla/5.0 (compatible; ...)`**: Ensures legacy servers and basic string matchers don't reject the request as an unknown client.
- **`FeedometerBot/1.0`**: Clear, distinct aggregator identifier recognizable by Akamai and CDN bot classification algorithms.
- **`+https://feedometer.pages.dev`**: Complies with RFC web standards by providing an informational URL where site webmasters can verify the bot.

---

## 3. 🛡️ Dual-Tier Fetch Resilience Architecture

To ensure 100% feed reach across both strict CDNs and idiosyncratic legacy servers, the Worker implements a **2-Tier Adaptive Fetch Strategy**:

```text
Incoming Feed URL
      │
      ▼
[ Tier 1: FeedometerBot 1.0 ]
  • UA: Mozilla/5.0 (compatible; FeedometerBot/1.0; +https://feedometer.pages.dev)
  • Accept: application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.8
      │
      ├─► Success (HTTP 200 + XML content) ──► Parse & Cache
      │
      └─► Blocked / Challenged? (Status 202, 403, or Body Length 0)
            │
            ▼
      [ Tier 2: Standard Aggregator Fallback ]
        • UA: Feedometer/1.0 (+https://feedometer.pages.dev; RSS Reader)
        • Accept: text/xml, application/xml, */*
            │
            ├─► Success ──► Parse & Cache
            └─► Fails ────► Return Specific Upstream Error Code
```

---

## 4. 📋 Header Configuration Details

### A. RSS / Atom Feed Fetching (`fetchHeadersForFeed`)
Used exclusively for fetching `.xml`, `/feed`, and `/rss` streams:
```javascript
const FEEDOMETER_BOT_UA = 'Mozilla/5.0 (compatible; FeedometerBot/1.0; +https://feedometer.pages.dev)';

function fetchHeadersForFeed() {
  return {
    'User-Agent': FEEDOMETER_BOT_UA,
    'Accept': 'application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9'
  };
}
```

### B. HTML / OpenGraph Article Scraping (`fetchHeadersForHtml`)
Used when scraping article webpages for hero images (`/api/og` and `/api/build`):
```javascript
function fetchHeadersForHtml(targetUrl) {
  let origin = '';
  try { origin = new URL(targetUrl).origin; } catch (e) {}
  return {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Referer': origin || targetUrl,
    'Upgrade-Insecure-Requests': '1'
  };
}
```

> **Important Separation:** Feeds are fetched with `FeedometerBot`, while article web pages (HTML) are fetched with standard browser headers to correctly parse OpenGraph tags and web semantics.

---

## 5. 🧪 Diagnostic Test Results

| Publisher / URL | Test Header Profile | HTTP Status | Response Size | Result |
| :--- | :--- | :---: | :---: | :--- |
| **ESPN** (`sports.espn.go.com/...`) | Chrome Desktop UA | `202` | 0 KB | ❌ Akamai Challenge Block |
| **ESPN** (`sports.espn.go.com/...`) | **`FeedometerBot/1.0`** | `200` | **23.2 KB** | ✅ **39 Articles Parsed** |
| **The Verge** (`theverge.com/rss/...`) | **`FeedometerBot/1.0`** | `200` | **95.4 KB** | ✅ Articles Parsed |
| **NYT World** (`rss.nytimes.com/...`) | **`FeedometerBot/1.0`** | `200` | **121.1 KB** | ✅ Articles Parsed |
| **ScienceDaily** (`sciencedaily.com/...`) | **`FeedometerBot/1.0`** | `200` | **43.5 KB** | ✅ Articles Parsed |
| **BBC News** (`feeds.bbci.co.uk/...`) | **`FeedometerBot/1.0`** | `200` | **29.0 KB** | ✅ Articles Parsed |
| **NASA** (`nasa.gov/rss/...`) | **`FeedometerBot/1.0`** | `200` | **207.1 KB** | ✅ Articles Parsed |

---

## 6. 🛠️ Implementation & Rollout Steps

1. **Worker Update (`feedometer-worker.js`):**
   - Update `fetchHeadersForFeed()` to use `FEEDOMETER_BOT_UA`.
   - Add Tier 2 fallback logic in `handleViewFeed` if response is empty (0 bytes) or returns 202.
2. **Frontend Update (`scripts/feedometer-viewer.js`):**
   - Enhance `loadFeed()` error handler to display the specific `json.error` message from the Worker rather than generic fallback strings.
3. **Deploy & Verify:**
   - Deploy `feedometer-worker.js` via `npx wrangler deploy`.
   - Test `http://sports.espn.go.com/espn/rss/news` directly in `feedometer.pages.dev` to verify instant 200 OK rendering.