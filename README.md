# ⚡ Feedometer &mdash; Free Public RSS Tools Suite

Feedometer is a standalone, high-performance, zero-login suite of free RSS tools designed for public web utility and organic Google Search Engine Optimization (SEO).

## 🚀 The 2 Standalone Tools Included

1. **📖 Public RSS Viewer & Reader (`index.html` / `viewer.html`)**
   - Instant client-side RSS 2.0 and Atom 1.0 stream parser.
   - Executive Briefing Cards layout (Grid and Compact List views).
   - Reading modal popup and 1-click `🔄` metadata refresh button.
   - Quick preloaded popular feeds (Hacker News, The Verge, NYT World, NASA, ScienceDaily, BBC).

2. **🛠️ Public Web-to-RSS Builder (`builder.html`)**
   - Converts any blog, news website, or static webpage into a standard RSS 2.0 XML feed.
   - Automatically detects article titles, links, snippets, dates, and thumbnails from HTML semantics.
   - 1-click "Copy XML" and "Download `.xml`" export.

---

## 📁 Repository Structure

```text
feedometer/
├── index.html            # Main Landing & Tool 1: RSS Reader
├── viewer.html           # Alias redirect to RSS Reader
├── builder.html          # Tool 2: Web-to-RSS Generator
├── sitemap.xml           # Google / Bing Sitemap
├── robots.txt            # Search Engine Directive
├── manifest.json         # PWA Manifest
├── favicon.svg           # Brand Vector SVG Favicon
├── styles/
│   └── feedometer.css    # Responsive dark-theme styling
├── scripts/
│   ├── feedometer-viewer.js    # Standalone reader logic
│   └── feedometer-builder.js   # Standalone web-to-rss scraper
└── README.md
```

---

## 🔒 Zero-Leakage Privacy & Architecture
- **100% Client-Side / Zero-Login**: No authentication, no private databases, no user tracking.
- **Zero Leakage**: Completely isolated from internal enterprise modules (Slack, MS Teams, LinkedIn, LLM summaries, Stripe, Admin backend).
- **SEO & Search Indexing**: Full Schema.org JSON-LD structured data on all pages, OpenGraph tags, semantic HTML5, and valid `sitemap.xml`.

---

## 🌐 Deployment (Pages + Worker API)

The **static site** (HTML/CSS/JS) and the **API Worker** (`workers/feedometer-worker.js`) are deployed separately. Popular feeds stay fast only when the browser calls the Worker’s `/api/view` and the cron job warms that Worker’s edge cache.

### 1. Deploy the API Worker

From this folder:

```bash
npm install -g wrangler   # or use npx wrangler
wrangler login
wrangler deploy
```

After deploy, note your Worker URL (e.g. `https://feedometer-api.<account>.workers.dev`).

This project’s live API is `https://feedometer-api.ancient-smoke-3af9.workers.dev`. Keep these in sync:

- `scripts/feedometer-config.js` → `PRODUCTION_API`
- `wrangler.toml` → `[vars] WORKER_PUBLIC_URL`
- `workers/feedometer-worker.js` → `DEFAULT_WORKER_PUBLIC_URL`

Optional waitlist (KV): create a namespace and uncomment `[[kv_namespaces]]` in `wrangler.toml`, then redeploy.
