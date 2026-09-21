# Feedometer Feed Issues & Diagnostic Architecture Document

**Date:** September 13, 2026  
**Status:** Resolved & Deployed to Production  
**Project:** Feedometer RSS Reader & Edge Worker (`feedometer-api`)  
**Target File:** `C:\feedometer\documents\feed-issues.md`

---

## Executive Summary

This document details the root causes, forensic diagnostic findings, resolution strategies, and architectural implementation for two major categories of feed behavior resolved in Feedometer:

1. **Issue 1: Query Parameter Wildcard Percent-Encoding (`*` vs `%2A`)**
   * **Affected Feeds:** TownNews / Blox CMS newspaper feeds (e.g., *Richmond Times-Dispatch*, *Omaha World-Herald*, *Tulsa World*, *St. Louis Post-Dispatch*, *Buffalo News*, *Toronto Star*, *NOLA.com*, etc.).
   * **Symptom:** `"Free reader is busy. Try again in a few hours."`
   * **Status:** **Resolved & Deployed to Cloudflare Edge Worker.**

2. **Issue 2: HTML Webpage Submissions & RSS Autodiscovery (`newsroom.workday.com`)**
   * **Affected Feeds:** Company newsrooms, corporate portals, and blog homepages (e.g., `https://newsroom.workday.com/home?showAll=true`).
   * **Symptom:** `"We couldn't access the feed. Try another one please....."`
   * **Status:** **Resolved & Deployed via Dedicated RSS Autodiscovery Engine.**

---

## Section 1: Query Parameter Wildcard Percent-Encoding Bug

### 1.1 Problem Statement
Feeds such as `https://richmond.com/search/?f=rss&t=article&c=news*&l=50&s=start_time&sd=desc` that were validated as active, high-reputation feeds in curation testing failed when requested through Feedometer, showing the error message:
> *"Free reader is busy. Try again in a few hours."*

### 1.2 Forensic Root Cause Analysis
1. **CMS Requirement for Literal Asterisk:**
   * TownNews / Blox CMS (powering 70+ regional US and international newspaper websites) uses the query parameter `c=news*` to match category prefixes.
   * When Blox CMS receives the literal asterisk (`c=news*`), its search indexer processes the query and returns HTTP `200 OK` with 50 RSS items.
2. **WHATWG `URL` Object Percent-Encoding:**
   * During URL canonicalization in `feedometer-worker.js`, the function `canonicalizeFeedUrl()` reconstructed the query parameters via `URLSearchParams.append(k, v)`.
   * The JavaScript runtime converted the literal `*` to percent-encoded `%2A` (`c=news%2A`).
   * When Blox CMS received `%2A`, its backend rejected the query and returned **HTTP 429 (Too Many Requests / Anti-Bot Throttling)**.
3. **Error Cascading:**
   * In `handleViewFeed()`, upstream HTTP `429` responses were mapped to internal worker capacity limits (`code: 'capacity'`), displaying the misleading "Free reader is busy" error.

### 1.3 Resolution & Verification
* **Fix Applied:** In `feedometer-worker.js`, `canonicalizeFeedUrl()` now unescapes `%2A` back to literal `*` before issuing HTTP requests to origin servers.
* **Error Classification:** Upstream 429/503 responses are now labeled `origin_rate_limited` rather than `capacity`.
* **Deployment:** Deployed to Cloudflare Edge (`feedometer-api`).
* **Test Results:** 100% success across all Blox CMS feeds tested (*Richmond*, *Omaha*, *Tulsa*, *St. Louis Post-Dispatch*, *Buffalo News*, *Toronto Star*, *NOLA.com*, *Waco Tribune*, etc.), returning 50 articles each.

---

## Section 2: HTML Webpage Submissions & RSS Autodiscovery

### 2.1 Problem Statement
When a user inputted a URL like `https://newsroom.workday.com/home?showAll=true`, other readers (e.g., Feedly, Inoreader, NetNewsWire, Miniflux) successfully loaded articles, whereas Feedometer displayed:
> *"We couldn't access the feed. Try another one please....."*

### 2.2 Root Cause Analysis
1. **HTML vs. XML Payload:**
   * `https://newsroom.workday.com/home?showAll=true` is an **HTML web page** (`Content-Type: text/html; charset=UTF-8`, ~196 KB), not a direct RSS/Atom XML feed.
   * Feedometer’s `/api/view` endpoint previously required the target URL to return direct XML (`<rss>`, `<feed>`, `<rdf:RDF>`). Because the payload was HTML, `looksLikeFeedXml(rawXml)` evaluated to `false`.
2. **Why Other RSS Readers Succeed (RSS Autodiscovery):**
   * Standard RSS readers implement the **W3C/IETF RSS Autodiscovery Standard**.
   * When given a general webpage URL, the reader downloads the HTML and inspects the `<head>` section for embedded feed discovery link tags:
     ```html
     <link rel="alternate" 
           type="application/rss+xml" 
           href="https://newsroom.workday.com/press-releases?pagetemplate=rss" 
           title="Workday Newsroom | WDAY Press Releases | Workday">
     ```
   * The reader extracts the target feed URL (`https://newsroom.workday.com/press-releases?pagetemplate=rss`) and subscribes to that feed automatically.

---

## Section 3: Architecture of the Implemented RSS Autodiscovery Engine

The RSS Autodiscovery Engine is integrated surgically into `feedometer-worker.js` with **zero interference** with direct XML feeds.

### 3.1 Architecture Diagram

```
User submits URL (e.g. newsroom.workday.com/home?showAll=true)
                       │
                       ▼
            [Tier 1: Direct Fetch]
                       │
             Is response valid XML?
             ├── YES ──► [Standard RSS/Atom Parsing Fast Path] (Existing Direct Feeds)
             │
             └── NO (Response is HTML)
                       │
                       ▼
      [Tier 2.5: RSS Autodiscovery Engine]
      Scan HTML <head> for <link rel="alternate" type="application/rss+xml">
                       │
             Discovered Feed URL found?
             ├── YES ──► [Fetch Discovered Feed URL] ──► [Parse & Return Feed]
             │                                              (feedUrl = discovered, feedHomeUrl = page)
             │
             └── NO ──► [Tier 3 Fallback / Clear Error Diagnostic]
```

### 3.2 Implementation Details in `feedometer-worker.js`

```javascript
/* ========================================================================= */
/* SECTION: RSS AUTODISCOVERY ENGINE (HTML Webpages -> Embedded RSS Feeds)   */
/* Scans HTML <head> for <link rel="alternate" type="application/rss+xml">   */
/* ========================================================================= */

function discoverFeedUrlFromHtml(html, pageUrl) {
  if (!html || typeof html !== 'string') return null;
  const headCut = html.indexOf('</head>');
  const searchArea = headCut !== -1 ? html.slice(0, headCut + 7) : html.slice(0, 120000);
  const linkRe = /<link[^>]*?>/gi;
  let match;
  const candidates = [];

  while ((match = linkRe.exec(searchArea)) !== null) {
    const tag = match[0];
    const rel = (extractAttrFromTag(tag, 'rel') || '').toLowerCase();
    const type = (extractAttrFromTag(tag, 'type') || '').toLowerCase();
    const href = extractAttrFromTag(tag, 'href');

    if (!href || href === '#' || href.startsWith('javascript:')) continue;

    const isAlternateOrFeed = /(alternate|feed)/i.test(rel);
    if (!isAlternateOrFeed && !type.includes('rss') && !type.includes('atom')) continue;

    if (
      type === 'application/rss+xml' ||
      type === 'application/atom+xml' ||
      type === 'application/feed+json' ||
      type === 'application/json' ||
      type === 'application/xml' ||
      type === 'text/xml'
    ) {
      const resolved = resolveUrl(href, pageUrl);
      if (resolved) {
        const priority = (type.includes('rss') || type.includes('atom')) ? 1 : 2;
        candidates.push({ url: resolved, priority });
      }
    }
  }

  if (candidates.length > 0) {
    candidates.sort((a, b) => a.priority - b.priority);
    return candidates[0].url;
  }
  return null;
}
```

---

## Section 4: Live Verification Test Results

| Test Target | Type | Result | Articles / Notes |
| :--- | :---: | :---: | :---: |
| **Workday Newsroom** (`https://newsroom.workday.com/home?showAll=true`) | **HTML Autodiscovery** | **HTTP 200 OK** | **5 items** (Resolved to `press-releases?pagetemplate=rss`) |
| **Richmond Times-Dispatch** (`richmond.com/search/?f=rss...&c=news*...`) | Direct Wildcard RSS | **HTTP 200 OK** | **50 items** |
| **Omaha World-Herald** (`omaha.com/search/?f=rss...&c=news*...`) | Direct Wildcard RSS | **HTTP 200 OK** | **50 items** |
| **The Verge** (`theverge.com/rss/index.xml`) | Direct RSS 2.0 | **HTTP 200 OK** | **10 items** |
| **NYT World News** (`rss.nytimes.com/.../World.xml`) | Direct RSS 2.0 | **HTTP 200 OK** | **50 items** |
| **Hacker News** (`news.ycombinator.com/rss`) | Direct RSS | **HTTP 200 OK** | **30 items** |
| **GitHub Releases** (`github.com/opensearch-project/.../releases.atom`) | Direct Atom | **HTTP 200 OK** | **10 items** |