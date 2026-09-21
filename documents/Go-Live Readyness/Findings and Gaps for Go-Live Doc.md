# FeedOmeter: Findings and Gaps for Go-Live

**Document Title:** Findings and Gaps for Go-Live Doc  
**Target Path:** `C:\feedometer\documents\Go-Live Readyness\Findings and Gaps for Go-Live Doc.md`  
**Source checklist:** `C:\feedometer\documents\Go-Live Readyness\Go-Live Checklist doc.md`  
**Reviewed codebase:** `C:\feedometer`  
**Review date:** 16 September 2026  
**Status:** Code largely ready; Cloudflare launch config still partial  

---

## 1. Executive verdict

The Go-Live Checklist’s **39/39 passed / production-ready** sign-off describes **code presence**, not a fresh live launch on `feedometer.com`.

| Area | Status |
|---|---|
| Front-end reader (odometer, Notify, 25 publishers, views, search, spinner) | **In the project** |
| Worker APIs (`/api/view`, `/api/build`, `/api/og`, cache, waitlist, telemetry) | **In the project** |
| SSRF + hate filter + Sensitive News badge | **In the project** |
| Documents listed in checklist section 2.7 | **Present** |
| Cloudflare launch config (custom domain, admin secret, WAF) | **Not done / partial** |

**Product decision (16 Sep 2026):** Custom domain (`feedometer.com` on Pages) will be attached **when going live**, not now. Until then, canonical URLs remain `feedometer.pages.dev`.

The reader, Worker, security, waitlist, and named docs **are in the repo**. Blocking for “we are live on feedometer.com” remains: attach the domain at go-live, rotate `ADMIN_SECRET`, and treat `pages.dev` as staging until then.

---

## 2. Checklist items confirmed in the repository

### 2.1 Front-end reader

Files: `index.html`, `scripts/feedometer-viewer.js`, `styles/feedometer.css`, `scripts/bg-color-picker.js`, `scripts/feedometer-telemetry.js`.

- Torn-paper odometer set to **99910**.
- Launch tagline: **Beyond Feeds. Built for Discovery.**
- Publisher directory: **25 outlets** (BBC, NY Times, The Guardian, Sky Sports, CNN, NPR, Al Jazeera, The Verge, TechCrunch, Wired, Hacker News, Ars Technica, MIT Tech, WSJ, Bloomberg, Forbes, FT, Fast Company, NASA, ScienceDaily, Nature, InsideEVs, IGN, Polygon) with per-publisher feed lists and modal search.
- Background color picker and popular-feeds / navigator popovers close each other.
- Grid and list view modes; in-feed headline search (client-side).
- Reader modal; SVG loading spinner with `#111827` stroke.
- Sensitive News badge; content-blocked / SSRF fallback UI.
- Bolt-on telemetry with `window.FEEDOMETER_TRACKING = false` kill-switch and `FeedOmeterTelemetry.getStats()`.

### 2.2 Cloudflare Worker

File: `workers/feedometer-worker.js`. Config: `wrangler.toml`.

- `/api/view`, `/api/fetch-feed` — RSS / Atom / RDF parse and normalize.
- `/api/build` — web-to-RSS.
- `/api/og`, `/api/og-image` — OpenGraph thumbnails.
- Dual-tier fetch: `FeedometerBot/1.0` then Chrome 131 browser UA.
- Waitlist: `POST /api/waitlist`, `GET /api/admin/waitlist`, `GET|POST /api/admin/waitlist-sync`.
- Cache: `/api/cache/refresh`, `/api/cache/purge`, `/api/cache/purge-all`, `/api/cache/status`.
- `/api/telemetry` — beacon with Cloudflare geo; IPs not stored as PII.
- Cache TTLs: popular **6 hours** (`21600`), organic **24 hours** (`86400`), build **30 minutes** (`1800`).
- `stale-while-revalidate=86400` on JSON cache responses.

### 2.3 Security (in Worker, not in the browser)

- SSRF host block: `localhost`, `127.*`, `10.*`, `192.168.*`, `172.16–31.*`, `169.254.*`, `.internal` / `.local`.
- `moderateFeedItems` hate/extremism regex; popular curated feeds skip full-feed rejection.
- Sensitive journalism tagging via regex → `Sensitive News` in the UI.

### 2.4 Waitlist (ahead of the original checklist)

The checklist described KV-only capture. Current design (working as of 16 Sep 2026):

- **Live Notify** writes KV (`waitlist:email:<address>` on `FEEDS_KV`).
- **D1** table `notify_signups` is the queryable ledger (`schema/notify_signups.sql`).
- Daily Worker cron **`0 13 * * *`** (13:00 UTC = **7:00 PM IST**) copies KV → D1 with `INSERT OR IGNORE`.
- Manual copy: `/api/admin/waitlist-sync` (secret-protected).
- First sync copied **7** KV records into D1.

Hostinger SMTP from the Worker was **removed**. Cloudflare Workers cannot TCP to `smtp.hostinger.com` (Cloudflare IP range). Email-to-inbox is not required for go-live; D1/KV is the source of truth.

### 2.5 Documentation (checklist section 2.7)

Present under `C:\feedometer\documents\`, including Go-Live Checklist, Pre-Launch Gap Analysis, Hate Security, Tracking Key Metrics, Infrastructure & Backup Plan, Architectural Design, normalization/canonicalization docs.

Additional: `documents\admin sec\ADMIN_SECRET Rotation Doc.md`.

---

## 3. Gaps vs the Go-Live Checklist

### 3.1 Must-fix before public go-live on a brand domain

| Gap | Finding | Action |
|---|---|---|
| **Custom domain** | Canonical, Open Graph, `robots.txt`, and `sitemap.xml` still use `https://feedometer.pages.dev/`. Domain not attached. | Attach `feedometer.com` (or chosen host) on Cloudflare Pages at go-live; update those URLs. **Deferred by product until go-live.** |
| **`ADMIN_SECRET`** | `/api/admin/waitlist` falls back to a hardcoded development string in Worker source if the Cloudflare Secret is missing. Waitlist export is then guessable. | Set Cloudflare Worker Secret `ADMIN_SECRET` (type Secret). Procedure: `documents\admin sec\ADMIN_SECRET Rotation Doc.md`. |
| **Dedicated `WAITLIST` KV** | Checklist asked for a `WAITLIST` binding. Signups use **`FEEDS_KV`**. It works; it is not an isolated namespace. | Optional: create `WAITLIST` KV and bind it. Not blocking while `FEEDS_KV` prefix `waitlist:email:` is in use. |

### 3.2 Spec drift (doc vs code — not always a blocker)

| Checklist says | Project actually has |
|---|---|
| 12 preset color themes + hex/RGB | HSV/RGB color wheel only (`scripts/bg-color-picker.js`); localStorage persistence yes |
| 6-second origin timeout | Primary fetch **8s**, fallbacks **10–12s** |
| 5MB maximum payload cap | **Not implemented** on feed `fetch().text()` |
| Privacy policy section | Terms & Conditions modal only; **no Privacy page** |
| Social share card image | `og:image` is `favicon.svg` |
| Telemetry persisted in KV | `/api/telemetry` exists; **`TELEMETRY_KV` is not bound** in `wrangler.toml` |

### 3.3 Cloudflare dashboard (not verifiable from Git)

These live in the account, not the repo:

- WAF / rate limit on `/api/*` (Pre-Launch Gap doc: 60 req/min/IP).
- Cloudflare Web Analytics.
- Confirmation that **this** Worker revision (D1 waitlist sync + cleaned SMTP) is what production `feedometer-api` is running after every dashboard edit.

---

## 4. Checklist section 3 sign-off (re-scored)

Those `[x]` boxes were **code inventory**, not a re-run of the 39-assertion suite on 16 Sep 2026.

| Sign-off item | In repo? |
|---|---|
| JavaScript files present / compile in project | Yes (suite not re-run here) |
| SSRF and private IP blocking | Yes |
| Content safety triage and journalism whitelist | Yes |
| Bolt-on telemetry + kill-switch | Yes |
| Color picker and flame/nav mutually exclusive | Yes |
| 25 publishers modal | Yes |
| Odometer 99910 | Yes |
| Tagline “Beyond Feeds. Built for Discovery.” | Yes |
| Circular SVG spinner `#111827` | Yes |
| Edge caching SWR | Yes (build path TTL 30 min; SWR on `jsonResponse` cache headers) |
| Wrangler Worker configuration | Yes (`wrangler.toml` + D1 + KV + crons) |

---

## 5. Recommended go-live order

1. Set **`ADMIN_SECRET`** on `feedometer-api` (and staging if used). Verify old string → 401, new string → 200.
2. Keep Notify → KV → nightly D1 as-is. Query D1 for counts; do not depend on SMTP.
3. When going live: attach custom domain; point canonical / OG / sitemap / robots at that host; keep Hostinger **MX** on Hostinger (do not enable Cloudflare Email Routing).
4. Optional polish: privacy page, OG share image, 5MB fetch cap, WAF rate limit, Web Analytics, dedicated `WAITLIST` KV.

---

## 6. Related documents

- `Go-Live Checklist doc.md` — original feature inventory and sign-off.
- `Pre-Launch Gap doc Analysis.md` — earlier WAITLIST binding, domain, WAF, ADMIN_SECRET gaps.
- `documents\admin sec\ADMIN_SECRET Rotation Doc.md` — how to rotate the admin header secret.
- `schema\notify_signups.sql` — D1 waitlist ledger DDL.
