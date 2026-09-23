# RSS Reader — canonical model & normalization strategy

Internal strategy for the public Feedometer RSS Reader (`index.html` + Worker `/api/view`). Captures product and architecture decisions from the Sep 2026 working session. **Not a launch spec for the full user/plans product.**

This public suite stays a **no-login RSS utility** (Reader + Builder). A separate, fuller product (accounts, plans, analytics beyond RSS) lives on another Cloudflare account and must **not** be previewed here.

---

## 1. Why this document exists

After live testing (dozens of feed types; target **150+** before the architecture move), we agreed:

- The Reader already feels **fast and decent** for casual use (a handful of feeds per visit).
- **Architecture should match how we think about articles**, even if this site stays small.
- A **canonical article on ingest** (UI never speaks RSS) is a **boundary**, not a product to copy. We are not trying to be Feedly.
- Our edge is **better feed/image algorithms**, then putting that brain **on the Worker** so it is at least **hard to lift from View Source** — not a vault, but not a recipe book in the browser either.
- We will do that boundary after testing — without becoming a subscription reader.

---

## 2. What “canonical” means for *this* Reader

Not unread counts, crawl-every-15-minutes, or a story database.

**Ingest (Worker):** fetch RSS / Atom / messy XML → **one article record**.

**UI (browser):** render JSON only. No `DOMParser`, no Layer A image hunt, no rss2json/Jina as a second brain.

### Canonical article (target fields)

| Field | Role |
| --- | --- |
| `id` | Stable id (prefer guid/link) |
| `title` | Headline |
| `url` | Article link |
| `publishedAt` | Normalized date |
| `author` | If present |
| `summary` | Plain-text snippet |
| `image` | Single hero URL, or `""` |
| `source` | Feed title |

Empty `image` is **valid**. Gold standard: hunt every reasonable feed/OG path; if there is no image, **still list the article**.

### Feel-good test when we ship it

Paste a feed → Network shows **JSON items only** → cards match that JSON. If client-side XML parse were gone, the Reader would still work.

---

## 3. Current vs target architecture

### Today (mixed)

| Layer | What it does |
| --- | --- |
| Client (~70% of Reader *rules*) | Parse RSS/Atom, image Layer A, OG fill, filters/UI, fetch orchestration, proxies |
| Worker (~30%) | CORS fetch, regex parse, Cache API, `/api/og`, Builder/Validate |

**Sensitive Reader logic (image rules, “no thumb still show posts”) lives in `scripts/feedometer-viewer.js`.** Anyone can read it in DevTools. The Worker URL is mostly **plumbing** (get the XML).

**Access vs rules:** most sites never send RSS to the browser (CORS). Success depends on the Worker; **card correctness** is still decided on the client.

### Target (after 150+ feed testing)

1. Worker fetches and **normalizes once** (including image gold standard).
2. Client is a **renderer**.
3. Client XML fallbacks go away, or exist only as “Worker down” emergency — not a second algorithm.
4. Optional later: do not return raw XML to the browser; return canonical items only.

**Tradeoff:** slower iteration (deploy Worker to tweak image rules). Reader dies if the Worker is down, unless we keep a dumb fallback (which leaks the brain again).

---

## 4. IP, “vault,” and competitors

- Moving logic to the Worker **hides View Source**. It is **not** a vault.
- Worker JS is still source we deploy; `/api/view` JSON is visible on the wire.
- Real protection for *this* repo: **private git if we care**, thin client, results not methods.
- Obfuscation / WASM / enclaves are not worth it for a free RSS tool.

Large readers (Feedly, Inoreader, etc.) use ingest → canonical article → UI because they **operate crawlers and accounts**. That is a useful **shape**, not a north star. We will write **our** normalizer and image rules; we are not chasing their feature set.

Making logic **tougher to copy** for this public Reader: parse + image gold standard **only on the Worker**, client renders JSON, do not ship raw XML or extractor code to the browser, keep the Worker source off a public repo if we care. Determined people can still watch `/api/view`. That is accepted. The goal is **no casual DevTools clone**, plus algorithms we believe will beat “good enough” RSS apps on messy real-world feeds.

---

## 5. Product split (do not mix)

| This Cloudflare project | Other account (later) |
| --- | --- |
| Public Reader / Builder | Users, plans, analytics, more than RSS |
| Demand + SEO + trust | Real business |
| Measure: Worker/Pages traffic, `/api/view` + `/api/build` volume | Full product metrics |

Do **not** park unreleased differentiators on these Pages. Usage of paste-a-URL tools is the question this site answers.

Casual testers (e.g. **5–6 feeds** a visit) are the expected load. Quality bar: **good enough to try RSS**, not a substitute for the full product.

---

## 6. Caching strategy (server / edge)

**Goal:** User A opens BBC → cache at the Worker/edge → User B is a HIT. That is how a **$5 Workers Paid** plan stays viable.

### Two buckets (agreed)

1. **Curated popular (~50 later; 6 today)**  
   Cron **pre-fetches** and writes cache. Refresh about **every 6 hours** (today: 6 URLs, cron every **12 hours**, popular TTL **12h**).

2. **Organic (anyone pastes a URL)**  
   First successful fetch is cached. Target TTL about **24 hours** (“that day”).  
   **Today: 15 minutes** — too short vs this plan.

Same URL shared by 10 or 10,000 users is **one object**. That is already the win.

### Defer

**“If 10+ people open it, keep an extra day”** needs hit counters (e.g. KV). Edge Cache TTL is set at write time. Skip until logs show real overlap.

### Rules that matter more than ranking

- **Normalize cache keys** (`/feed` vs `/feed/`) so one feed is one entry.
- **Do not cache failures** (e.g. HN 403) or we poison everyone.
- **Refresh / `nocache=1`** still bypasses for “I want live.”
- Warm path must **not** OG 50 feeds (too many subrequests).
- 6h freshness is enough for this public Reader; the full product can poll faster later.

### Cloudflare cost (order of magnitude)

Workers Paid (~$5/mo) includes on the order of **10 million requests/month**. Static Pages are not the meter; **`/api/view`, `/api/build`, `/api/og` are**.

- 1,000 people × 6 feeds/month-scale casual use: well inside the included quota if **one request per feed**.
- 1,000 × 100 feeds/day is still plausible for `/api/view` alone (~3M/month).
- **`/api/og` per article** can multiply 1 feed into many Worker hits — watch that first.

If the free public budget is exhausted: short, non-technical copy — e.g. try again in a few hours. No Cloudflare/Worker jargon. The coming full product is already mentioned on the RSS pages; that is enough.

---

## 7. Hacker News (out of scope for “parser is broken”)

Official `https://news.ycombinator.com/rss` is **intermittent** because **YC blocks many datacenter/Cloudflare IPs** (403 / short HTML), not because our XML rules fail.

Checklist when it fails: status, body length (tiny HTML vs RSS), not TLS/redirects.

**Decision:** do not special-case HN in the parser. **Hacker News was removed from the Reader popular pills** so the first trial is not a failure. Users can still paste the URL. Builder unchanged. A mirror URL for the pill is a later product choice, not an algorithm rewrite.

---

## 8. Image gold standard (unchanged)

1. Layer A: every image a normal reader would find in the item XML/HTML (`media:`, enclosure, `content:encoded`, `img` / `srcset`, etc.).
2. Layer B: OG on the **article page** only if A is empty. Never treat favicon/site logo as hero.
3. If still empty → **post the article anyway**.

Stack Overflow Blog-style feeds (text descriptions, few in-feed images) must list. Do not reject a feed for missing images.

---

## 9. Implementation notes (when we execute)

No code in this pass — trigger after **150+ feed types** feel stable.

1. Freeze image + parse rules in the Worker; emit canonical items from `/api/view`.
2. Thin `feedometer-viewer.js` to fetch JSON + render + OG only if we still want client gap-fill (prefer server if we can).
3. Expand `POPULAR_FEEDS`, cron **6 hours**, popular TTL **6h**, organic TTL **24h** (or 6h if we choose newsier).
4. Normalize feed URLs for fetch **and** cache key.
5. Capacity message on 429/503 when we have real traffic.

Files today: `feedometer-worker.js` (`handleViewFeed`, `parseFeedXml`, `POPULAR_FEEDS`, Cache API), `scripts/feedometer-viewer.js`, `wrangler.toml` crons.

---

## 10. Decisions log

| Topic | Decision |
| --- | --- |
| Canonical normalize | **Yes**, after testing — Worker ingest, client render |
| Full SaaS features on this domain | **No** |
| Code vault | **No**; private repo + server ingest is enough |
| Cache shared by URL | **Yes** |
| Popular warm + ~6h refresh | **Yes** (tune list to ~50 when ready) |
| Organic TTL ~1 day | **Yes** (replace 15m) |
| Hit-count extra day | **Defer** |
| HN pill on Reader | **Removed** |
| HN parser work | **Not today** |
| Quota UX | Friendly retry-later if needed |
| $5 Workers plan | Sufficient for intended casual use if OG is controlled |

---

*Written for the Feedometer public RSS suite. Update this file when the canonical pass ships.*
