# ⚡ FeedOmeter Feature Audit & Action Items Roadmap

**Date:** September 2026  
**Audited Directory:** `C:\feedometer_next_phase`  
**Target Reference:** RSS.app Feature Parity & Intelligence Platform  

---

## 📊 Executive Summary Scorecard

| Category | Available & Working | Partially Developed | To Develop (Missing) | Total Features |
| :--- | :---: | :---: | :---: | :---: |
| **1. RSS Feed Generation** | 2 | 2 | 1 | 5 |
| **2. Feed Management & Intelligence** | 2 | 2 | 1 | 5 |
| **3. Website Widgets** | 5 | 1 | 0 | 6 |
| **4. Automation & Bots** | 1 | 2 | 1 | 4 |
| **5. API & Integrations** | 2 | 2 | 0 | 4 |
| **Total** | **12 (50%)** | **9 (37.5%)** | **3 (12.5%)** | **24 (100%)** |

---

## 🔍 Detailed Feature Audit Matrix

### 1. RSS Feed Generation
| Feature | Status | Implementation in Codebase |
| :--- | :---: | :--- |
| **Generate RSS feeds from any website URL without coding** | 🟢 **Available & Working** | Fully functional in `builder.html`, `scripts/feedometer-builder.js`, and `workers/services/web-to-rss.js`. Scrapes HTML, extracts articles, enriches with OpenGraph thumbnails, and generates standard RSS 2.0 XML with copy & download buttons. |
| **Convert websites, blogs, news, and social media into RSS** | 🟡 **Partially Developed** | • **Working:** Standard websites, blogs, news portals, **YouTube** channels/handles/playlists (`youtube-bridge.js`), and **Reddit** subreddits/users (`reddit-bridge.js`).<br>• **Missing:** Twitter/X, Instagram, TikTok, LinkedIn, and Facebook profile scrapers. |
| **Visual RSS Feed Builder (point-and-click selector)** | 🟡 **Partially Developed** | Feedometer has an automatic heuristic scraper that detects content automatically, but lacks an interactive point-and-click Visual Selector (DOM element picker iframe proxy) for custom CSS selectors. |
| **Topic and keyword monitoring (Google Alerts alternative)** | 🟢 **Available & Working** | Built into `keyword-feed-engine.js`, `feed-discovery-engine.js`, and `workers/modules/alerts.js`. Generates virtual RSS feeds for topics/keywords with real-time matching. |
| **Convert email newsletters into RSS feeds** | 🔴 **To Develop** | Can discover public Substack/newsletter RSS feeds via search vectors, but lacks an inbound email ingestion service (e.g., custom `@feedometer.app` forwarding email addresses to convert private incoming emails into RSS). |

---

### 2. RSS Feed Management & Intelligence
| Feature | Status | Implementation in Codebase |
| :--- | :---: | :--- |
| **RSS Feed Aggregator & Bundler (combine feeds into one)** | 🟢 **Available & Working** | Built in `workers/services/feed-fusion.js` and `workers/modules/streams.js`. Bundles multiple feeds into folders/watchlists with cross-feed 3-tier deduplication and chronological cursor pagination. |
| **Manual RSS feed curation from multiple sources** | 🟡 **Partially Developed** | Articles can be saved to Starred (`starred.html`), Read Later (`read-later.html`), or Folders (`watchlists.html`). However, generating an outbound public/private RSS feed URL directly from a curated article list is not yet exposed. |
| **Feed filtering (keywords, deduplication, old posts)** | 🟢 **Available & Working** | Implemented in `filters.html`, `workers/services/user-filters.js`, and `workers/services/rule-engine.js`. Supports include/exclude keywords, include/exclude domains, image/summary/HTTPS requirements, and hiding posts older than $N$ days. |
| **RSS feed customization (output formatting, tags, limits)** | 🟡 **Partially Developed** | Basic post limits and RSS 2.0 XML / JSON stream outputs are supported. Custom XML templating, custom tag injection, and configurable syndication parameters per feed URL are minimal. |
| **RSS feed translation into 30+ languages** | 🔴 **To Develop** | No translation API integration (e.g., DeepL, Google Translate, or OpenAI Translation) is present in the codebase. |

---

### 3. Website Widgets
| Feature | Status | Implementation in Codebase |
| :--- | :---: | :--- |
| **News Wall widgets** | 🟢 **Available & Working** | Built into `widgets.html`, `scripts/feedometer-widgets.js`, and `styles/widgets-studio.css` (`.widget-layout-news-wall`). |
| **Carousel widgets** | 🟢 **Available & Working** | Supported in Widget Studio (`.widget-layout-carousel`). |
| **Ticker widgets** | 🟢 **Available & Working** | Supported in Widget Studio (`.widget-layout-ticker`). Also includes **Magazine**, **List**, and **Imageboard** layouts. |
| **No-code embed via HTML & JavaScript snippets** | 🟡 **Partially Developed** | The Widget Studio modal generates embed code (`<iframe>` and `<script>`), but the standalone host page `embed.html` and standalone embed script bundle (`feedometer-widgets.bundle.js`) are not yet created in the repository root. |
| **Mobile-responsive widget layouts** | 🟢 **Available & Working** | CSS grid/flex layouts with responsive breakpoints and live desktop/tablet/mobile viewport switchers in the studio. |
| **Design customization (fonts, colors, spacing, CSS)** | 🟢 **Available & Working** | Live controls for 5 themes (Light, Dark, Slate, Glass, Transparent), accent colors, border radius, typography fonts, items-per-page sliders, and display toggles. |

---

### 4. Automation & Bots
| Feature | Status | Implementation in Codebase |
| :--- | :---: | :--- |
| **Discord bot for auto-posting RSS feeds** | 🟡 **Partially Developed** | Listed in `integrations.html` under "Coming Soon" and aliases to the generic webhook in the backend. Needs a dedicated Discord Webhook Embed formatter (`{ embeds: [...] }`) and bot dispatch handler. |
| **Slack bot integration** | 🟢 **Available & Working** | Implemented in `workers/integrations/connectors/slack.js` and `workers/services/webhook-dispatcher.js`. Sends native interactive Block Kit cards with article images, source tags, snippets, and live test pinging. |
| **Telegram bot integration** | 🔴 **To Develop** | Marked as "Coming Soon" in the catalog UI; no Telegram Bot API connector (`sendMessage` endpoint / bot token handler) exists. |
| **Email digest delivery (daily, weekly, custom schedules)** | 🟡 **Partially Developed** | The scheduling engine (`digests.js`), cursor lookback tracking, and HTML email compiler (`digest-generator.js`) are fully written and passing unit tests. However, outbound sending via Resend/SMTP is only wired for auth emails and needs to be hooked up inside `executeDigestRun`. |

---

### 5. API & Integrations
| Feature | Status | Implementation in Codebase |
| :--- | :---: | :--- |
| **Real-time webhooks** | 🟢 **Available & Working** | Implemented in `workers/modules/webhooks.js` and `workers/services/webhook-dispatcher.js`. Features HMAC-SHA256 signature verification (`X-Feedometer-Signature-256`), real-time delivery queues, retry handling, and scheduled batching. |
| **REST API access to feed data** | 🟢 **Available & Working** | Full REST API v1 in `workers/modules/rest-api-v1.js` with developer API key authentication (`/api/v1/articles`, `/api/v1/search`, `/api/v1/sources`, `/api/v1/me/subscriptions`, `/api/v1/me/folders`) and cursor pagination. |
| **Export feeds to CSV, JSON, and OPML** | 🟡 **Partially Developed** | • **OPML:** Fully working (import & export in `workers/modules/opml.js`, `workers/services/opml-engine.js`, and `/api/v1/me/opml`).<br>• **JSON:** Available via REST API & bookmark export.<br>• **CSV:** Missing / To Develop. |
| **Third-party integrations (Zapier, Make, n8n, Notion, etc.)** | 🟡 **Partially Developed** | • **Zapier, Make, n8n:** Compatible via REST API v1 and inbound/outbound Webhooks.<br>• **Notion, Airtable, Google Sheets, Mailchimp, Buffer, Hootsuite, Confluence, Coda:** Listed as "Coming Soon" / placeholders; native OAuth app connectors are not yet built. |

---

## 🎯 Prioritized Action Items Roadmap

### Phase 1: High Priority (Quick Wins & Complete Partially Developed Items)
1. **[Website Widgets] Standalone Embed Host & Bundle**
   - Create `embed.html` in the root folder with query-param reader (`?feed=...&layout=...&theme=...`).
   - Create lightweight standalone `scripts/feedometer-widgets.bundle.js` for zero-iframe `<div id="feedometer-widget">` embeds.
2. **[Automation] Outbound Email Digest Dispatcher**
   - In `workers/services/digest-generator.js` (`executeDigestRun`), connect Resend API (`https://api.resend.com/emails`) or SMTP to dispatch compiled digest HTML directly to user email addresses.
3. **[Automation] Discord Bot / Webhook Formatter**
   - Create `workers/integrations/connectors/discord.js` formatting articles as native Discord Rich Embeds (`{ embeds: [{ title, description, url, image: { url }, color }] }`).
4. **[Export] CSV Data Exporter**
   - Add `/api/v1/articles/export?format=csv` endpoint and client-side "Export CSV" buttons in `starred.html` and `account.html`.

### Phase 2: Medium Priority (Core Functional Expansion)
5. **[Automation] Telegram Bot Connector**
   - Create `workers/integrations/connectors/telegram.js` utilizing Telegram Bot API (`https://api.telegram.org/bot<TOKEN>/sendMessage` with HTML formatting).
6. **[Curation] Curated Custom Feed Generator**
   - Add an endpoint `/api/curated/:id.xml` and `/api/curated/:id.json` allowing users to publish an active RSS feed containing their starred/bookmarked articles.
7. **[Generation] Inbound Email Newsletter to RSS Engine**
   - Setup Cloudflare Email Routing / Worker to assign unique user forward addresses (e.g., `user_xyz@inbound.feedometer.com`) that ingest incoming newsletter emails, parse HTML, and generate an RSS feed.

### Phase 3: Advanced Capabilities
8. **[Translation] Multilingual RSS Feed Translation**
   - Integrate DeepL or OpenAI translation API to allow auto-translating feed titles and summaries into 30+ languages.
9. **[Generation] Visual Point-and-Click Selector**
   - Build a sandboxed visual inspector iframe allowing users to click headline, image, date, and description elements to generate custom selector recipes for difficult/dynamic sites.
10. **[Integrations] Native Productivity OAuth Connectors**
    - Build direct OAuth integrations for Notion databases, Airtable bases, and Google Sheets append workflows.
