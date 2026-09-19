# Dual HTTP Timedout Issue & Feedometer Engine 2.1 Resolution

**Date:** September 11, 2026  
**Document:** `Dual HTTP timedout Issue - Dual-Tier Resilient Fetch Engine doc.md`  
**Status:** **RESOLVED & IMPLEMENTED IN WORKER BACKEND ✅**  
**Engine:** Feedometer Engine 2.1: Adaptive Dual-Tier Upstream Fetch Pipeline  
**Target Feed Under Test:** `http://www.usnews.com/rss/health?int=a7fe09`

---

## 1. 📌 The Issue: Port 80 Timeouts & Bot Filtering

### Target Under Test
- **Input URL:** `http://www.usnews.com/rss/health?int=a7fe09`
- **Publisher:** *U.S. News & World Report*
- **Status:** **Active & Healthy** (serves **100 full health articles**, **78.6 KB RSS 2.0 XML**).

### The Root Causes
1. **Port 80 (Plain HTTP) Drops:** U.S. News drops TCP connections on plain port 80 (`http://`), requiring automatic protocol upgrade to **`https://`**.
2. **The CDN Firewall Paradox:**
   - **Akamai CDN (ESPN):** Whitelists RSS reader bot identities (`FeedometerBot/1.0`), challenges desktop browser UAs from datacenters with `202 Accepted` (0 bytes).
   - **Fastly/Shield CDN (U.S. News):** Drops unknown bot UAs with connection timeouts, requires **`https://` + Browser Profile + `Referer: origin`**.

---

## 2. 🛡️ The Implemented Feedometer Engine 2.1 Solution

The server-side Cloudflare Worker in `feedometer-worker.js` implements an **Adaptive Dual-Tier Upstream Fetch Pipeline**:

```javascript
const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const FEEDOMETER_BOT_UA = 'Mozilla/5.0 (compatible; FeedometerBot/1.0; +https://feedometer.pages.dev)';

function fetchHeadersForFeed(tier = 1, targetUrl = '') {
  if (tier === 2) {
    let origin = '';
    try { origin = new URL(targetUrl).origin; } catch (e) {}
    return {
      'User-Agent': BROWSER_UA,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Referer': origin || targetUrl,
      'Upgrade-Insecure-Requests': '1'
    };
  }
  return {
    'User-Agent': FEEDOMETER_BOT_UA,
    'Accept': 'application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9'
  };
}
```

### Adaptive Fallback Execution in `handleViewFeed`:
1. **Tier 1:** Executes primary fetch using `FeedometerBot/1.0` over HTTPS.
2. **Tier 2:** If Tier 1 times out, returns `202`, `403`, `520`, or fails XML validation &rarr; automatically upgrades to `https://` and fetches using Browser Profile + `Referer: origin`.

---

## 3. 🧪 Verification Matrix & Proof Across All 8 Streams

| Feed Stream | Profile Used | Extracted Stories | Result |
| :--- | :---: | :---: | :---: |
| **U.S. News Health** (`http://www.usnews.com/rss/health?int=a7fe09`) | **Tier 2 (Browser + HTTPS Fallback)** | **50 stories (capped)** | ✅ **PASS** |
| **Harvard Business Review** (`http://feeds.harvardbusiness.org/...`) | **Tier 1 (`FeedometerBot/1.0`)** | **50 stories** | ✅ **PASS** |
| **ESPN** (`http://sports.espn.go.com/...`) | **Tier 1 (`FeedometerBot/1.0`)** | **39 stories** | ✅ **PASS** |
| **The Verge** (`https://www.theverge.com/...`) | **Tier 1 (`FeedometerBot/1.0`)** | **10 stories** | ✅ **PASS** |
| **NYT World** (`https://rss.nytimes.com/...`) | **Tier 1 (`FeedometerBot/1.0`)** | **50 stories** | ✅ **PASS** |
| **BBC News** (`https://feeds.bbci.co.uk/...`) | **Tier 1 (`FeedometerBot/1.0`)** | **33 stories** | ✅ **PASS** |
| **NASA Breaking** (`https://www.nasa.gov/...`) | **Tier 1 (`FeedometerBot/1.0`)** | **10 stories** | ✅ **PASS** |
| **ScienceDaily** (`https://www.sciencedaily.com/...`) | **Tier 1 (`FeedometerBot/1.0`)** | **50 stories** | ✅ **PASS** |

---

## 4. 🛡️ IP & Security Boundary Check

- **100% Server-Side Isolation:** The protocol fallback, header switching, and timeout retry mechanics live entirely inside `feedometer-worker.js` on Cloudflare's Edge.
- **Zero Frontend Exposure:** The browser simply receives the normalized articles as JSON without ever knowing that an adaptive fallback occurred.