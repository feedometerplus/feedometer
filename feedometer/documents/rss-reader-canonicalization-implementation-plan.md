# RSS Reader — implementation plan

Canonicalization, URL normalization, in-feed deduplication, ingest-side images, and cache. Companion to `rss-reader-normalization-strategy.md`.

**Scope:** public Reader only (`index.html` + `feedometer-worker.js`). Builder stays as it is except where a shared URL helper is trivial. Do **not** add accounts, unread, or the other-cloud product.

**North star:** Worker owns the article brain. Browser paints JSON. Algorithms stay off View Source as much as this architecture allows.

---

## Current project (what we are changing)

```text
feedometer/
├── index.html                 # Reader UI (hero, cards, footer)
├── builder.html               # out of this pass
├── feedometer-worker.js       # LIVE Worker (wrangler.toml main)
├── workers/feedometer-worker.js   # stale copy — do not deploy
├── wrangler.toml              # cron 12h, WORKER_PUBLIC_URL
├── scripts/
│   ├── feedometer-config.js   # FEEDOMETER_API_BASE
│   ├── feedometer-viewer.js   # fat client: fetch, parse, images, OG, UI
│   ├── feedometer-builder.js
│   ├── bg-color-picker.js     # leave
│   └── mobile-nav.js          # leave
├── styles/feedometer.css      # leave except capacity/error if needed
└── documents/                 # strategy + this plan
```

**Today’s pipeline**

1. Client `normalizeFeedUrl` (slash, BBC/NASA shortcuts).
2. `tryWorkerView` → `/api/view` (Worker regex parse + Cache API; popular 12h / else 15m).
3. If Worker miss: direct CORS, proxies, rss2json, Jina — then **client `parseRssOrAtom`** (DOMParser) + Layer A images + OG.

Worker `parseFeedXml` is a thinner duplicate of the client parser. Cache key is the **raw request URL** (query string), so `/feed` vs `/feed/` can miss.

---

## Target pipeline

```text
paste URL
  → client: trim + call Worker only
  → Worker: canonicalize feed URL
  → Cache HIT? return JSON
  → fetch origin XML
  → parse RSS/Atom
  → map to CanonicalItem[]
  → Layer A images (no blocking OG)
  → dedupe within this response
  → Cache PUT (6h popular / 24h organic)
  → JSON { ok, meta, items }   // no raw XML
  → client: render cards (+ optional later OG via /api/og)
```

### Canonical item (Worker output)

Keep wire names compatible with current cards where possible (`link` stays, add `id`).

| Field | Notes |
| --- | --- |
| `id` | guid, else absolute `url` |
| `title` | cleaned |
| `url` / `link` | absolute http(s); `link` kept so current `renderCards` works |
| `publishedAt` | ISO; keep `pubDate` display string for now |
| `author` | optional |
| `summary` / `description` | plain text, capped |
| `image` | one hero or `""` |
| `source` | feed title |

---

## Phased order (do not skip ahead)

Ship each phase with Reader still working. Deploy Worker before thinning the client.

### Phase 0 — Contract (half day)

Agree JSON shape in this doc. Add `schemaVersion: 1` on `/api/view`. No user-facing change.

### Phase 1 — URL normalization (backend first)

**Backend (`feedometer-worker.js`)**

- `canonicalizeFeedUrl(raw)`: https, trim, WordPress `/feed/` slash, existing BBC/NASA shortcuts, strip tracking query junk, lowercase host.
- Fetch and **cache key** both use canonical URL, not the incoming query string as-is.
- Popular list compare against canonical form.

**Frontend (`feedometer-viewer.js`)**

- Validate “looks like a URL”, send the raw string to the Worker.
- Worker is the **single source of truth** for canonical feed URL (no duplicated rule set).
- Use `json.feedUrl` from the response for `replaceState` / input display if we want the box to show the canonical form.
- Pills remain **data** (already-canonical URLs), not logic.

**Done when:** SO Blog `/feed` and `/feed/` share one cache object. BBC shortcut still works.

### Phase 2 — Worker parse = client quality (backend)

Port from `feedometer-viewer.js` into Worker (do not invent a third dialect):

- `content:encoded`, Atom `content`/`summary`
- `media:thumbnail` / `media:content`, `itunes:image`, image enclosures
- HTML/`&lt;img` / srcset / data-src
- `isUsableHeroImage` (reject favicon/logo)
- Empty image still emits the item
- ISO dates + existing `pubDate` string

Optional: `waitUntil` OG for missing images **after** response (do not block `/api/view`). First paint may have empty thumbs; cache can update later **or** skip OG on ingest and keep client `/api/og` for now.

**Done when:** Worker JSON for Verge / WordPress / NASA / Reddit-class feeds matches (or beats) current client cards. Re-test a slice of the 150.

### Phase 3 — Deduplication (backend only)

**In-feed only** (not cross-site, not the full product):

- Key order: `id` (guid) → absolute URL (strip hash, trailing slash on path) → fallback `title+publishedAt`
- Keep first occurrence (or newest date if both dated)
- Cap still ~50 items after dedupe

**Done when:** a feed that repeats guid/link shows one card.

### Phase 4 — Cache policy (backend + wrangler)

| Bucket | TTL | Refresh |
| --- | --- | --- |
| Curated popular | **6 hours** | Cron every 6h (`0 */6 * * *`), `nocache=1` warm |
| Organic | **24 hours** | On first miss |
| Failures | **do not cache** | — |

- Expand `POPULAR_FEEDS` toward ~50 when you have a list (pills can stay a subset).
- Defer “10 hits → extra day” (needs KV counters).

**Done when:** headers/`cached` field show `6h`/`24h`; second BBC click is `X-Feedometer-Cache: HIT`.

### Phase 5 — Thin the Reader (frontend)

Only after Phase 2 is on the **deployed** Worker.

**Keep**

- UI: hero, pills, list/grid, search, modal, errors, mobile nav, bg picker
- `tryWorkerView` (local 8787 then production)
- Map Worker JSON → `currentItems` (field aliases)
- `renderCards`, `sanitizeItemImages` as a last-line reject of favicons if any leak
- Optional: `startThumbnailOgEnrichment` calling `/api/og` until ingest OG exists
- Refresh → `nocache=1`

**Remove or stop calling**

- `parseRssOrAtom` / `extractHeroImageFromFeedItem` / proxy XML / rss2json / Jina **as the success path**
- `keepIfRich` hunting richer XML after a valid Worker payload

**Worker-down behavior (product choice)**

- **A (preferred):** friendly error + capacity-style copy. Algorithms stay off the client.
- **B:** keep proxies as last resort (re-exposes parse). Only if you insist the page works with Worker dead.

**Done when:** DevTools on a successful load has **no** RSS XML in the client; only `/api/view` JSON. Feel-good test from the strategy doc.

### Phase 6 — Hardening (backend + frontend)

**Backend**

- Stop returning raw XML in JSON (never add it).
- 429/503 JSON `{ ok: false, code: 'capacity' }`.
- Do not cache 403/empty.

**Frontend**

- Map `capacity` → “Free reader is busy. Try again in a few hours.”
- Keep generic fetch error for other failures.

**Hygiene**

- Do not edit/deploy `workers/feedometer-worker.js` (delete or add a one-line “unused” comment later).
- `FEEDOMETER_API_BASE` stays the live `*.workers.dev` (or custom domain).

---

## Task list by side

### Backend (Worker + wrangler)

| # | Task | Phase |
| --- | --- | --- |
| B1 | `canonicalizeFeedUrl` + cache key from canonical URL | 1 |
| B2 | Popular membership uses canonical URL | 1 |
| B3 | `schemaVersion` + canonical item mapper | 0–2 |
| B4 | Port Layer A image + encoded content parse from viewer | 2 |
| B5 | In-feed dedupe | 3 |
| B6 | TTL 6h popular / 24h organic; cron `0 */6 * * *` | 4 |
| B7 | Warm ~50 feeds (list TBD); no OG in warm loop | 4 |
| B8 | Optional `waitUntil` OG; never block view | 2 or 6 |
| B9 | Capacity error shape; never cache failures | 6 |
| B10 | Deploy `feedometer-worker.js` only | all |

### Frontend (Reader)

| # | Task | Phase |
| --- | --- | --- |
| F1 | URL: validate + send; display Worker `feedUrl`; no duplicated canonicalize rules | 1 |
| F2 | Prefer Worker JSON; stop `keepIfRich` discard | 2 (soft) / 5 (hard) |
| F3 | Render from canonical fields (`id`, `link`/`url`) | 5 |
| F4 | Delete/stop XML parse, proxies, rss2json, Jina success path | 5 |
| F5 | Keep OG enrichment **or** drop once Worker images are enough | 5 |
| F6 | Capacity + fetch error copy | 6 |
| F7 | Confirm pills/query `?url=` use canonical URLs | 1 |
| F8 | No CSS/layout work unless capacity banner needs it | — |

### Out of this implementation

- Builder scrape algorithms
- Hit-count KV / extra-day TTL
- HN special-case parser or paid proxies
- Cross-feed global dedup, users, plans, analytics product
- Mobile/desktop UI redesign

---

## Suggested build sequence (when we code)

1. B1–B2 + F1 + F7 (URL; Worker is SSOT) — deploy Worker, smoke BBC + `/feed/`.
2. B3–B5 (canonical parse + dedupe) — deploy, compare 10 known feeds vs current UI.
3. B6–B7 (cache) — deploy, confirm HIT header.
4. F2–F5 (thin client) — Pages deploy; DevTools check.
5. B8–B9 + F6 (OG optional + capacity).

---

## Test plan (regression)

- Pills: Verge, NYT, ScienceDaily, BBC, NASA (not HN).
- WordPress `/feed/` with few images (e.g. Stack Overflow Blog) — articles still list.
- Reddit/media-rss style if you have a URL from testing.
- Duplicate guid feed if you saved one.
- Refresh button bypasses cache.
- Mobile: no layout regression.
- Worker 500/timeout → chosen down-path (A or B).

---

## Success

Network: `/api/view` JSON only. Cards equal or better than today’s client parse. Second visitor to the same canonical URL is a cache HIT. Image rules not in the browser bundle (except a thin favicon sanitizer if we keep it).

---

## Addendum — review of extra canonicalization notes (Sep 2026)

External notes vs this plan. **Accepted** items are in scope; **defer** stays out of the public Reader.

| Note | Verdict |
| --- | --- |
| Feed URL: lowercase host, drop :80/:443, trailing slash, tracking params, sort query | **Accept** into B1. Do **not** strip functional query (`?format=xml`). Prefer `https` when the origin is HTTPS; do not blindly rewrite http→https if the feed only exists on http. |
| Article URL: drop `utm_*`, `fbclid`, `gclid`, common `ref`/`source`, fragments; resolve relative | **Must have (B5 pre-step).** Only strip **known trackers**, never `?id=` / `?p=`. |
| Stable `id`: guid \|\| canonicalLink \|\| hash(title+published+source) | **Accept.** Hash is the fallback, not a new product. Cross-feed dedupe is the other account — do not build it here. |
| Explicit Normalize stage in the pipeline | **Accept as named Worker functions**, not extra services. We already decode entities / clean text; make `normalizeItem()` obvious. |
| `publishedAt` / `updatedAt` ISO-8601 UTC | **Accept.** Frontend formats for display. Invalid/missing → `""`. RSS often has no `updatedAt`. Can keep `pubDate` as a derived display string during the thin-client transition, then drop. |
| Feed meta: title, home URL, icon, lastFetched | **Nice to have.** Title/home already exist as `meta`. Channel icon ≠ article hero. `lastFetched` is diagnostics (`X-Feedometer-Fetched`), not a user feature. |
| Images **after** dedupe | **Accept for OG** (expensive). Layer A from the same XML blob is cheap and can stay with parse. |
| Worker-only canonicalization; client validates only | **Upgrade to must-have.** Avoid mirroring rules in the viewer (drift). Return `feedUrl` so the UI can show the canonical URL. Pills are constants, not a second engine. |
| Feed-provider TTL (`<ttl>`, `sy:updatePeriod`) | **Defer.** Our 6h/24h floor is enough for this utility. Do not poll more often than we already don’t. |

**Must-have from those notes (this pass):** article URL strip-trackers, stable `id`, named normalize step, ISO dates, Worker SSOT for feed URLs.

**Nice-to-have:** feed icon, lastFetched header, OG-after-dedupe, publisher TTL.
