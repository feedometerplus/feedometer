# Cloudflare setup — canonical Reader (do this yourself in the dashboard)

You create/confirm **Cloudflare resources**. We change **code** in this repo. Canonicalization does **not** need KV, Durable Objects, R2, Queues, or Pages Functions.

Live API today: `https://feedometer-api.ancient-smoke-3af9.workers.dev`  
Static site: Cloudflare **Pages** (HTML/JS/CSS only). The Reader calls the Worker URL from `scripts/feedometer-config.js`.

---

## A. What you must have in Cloudflare (checklist)

Walk: [dash.cloudflare.com](https://dash.cloudflare.com) → left sidebar **Workers & Pages**.

| Resource | Create new? | Why |
| --- | --- | --- |
| **Workers Paid** (~$5/mo) | Upgrade if still on free | 10M requests/month class included; cron + longer CPU |
| **Worker `feedometer-api`** | **No** — already exists | `/api/view` fetch, parse, cache, warm |
| **Pages project** (the Reader site) | **No** if `feedometer.pages.dev` (or your domain) already deploys this folder | Serves `index.html` only |
| **Cache API** | **Nothing to create** | `caches.default` in Worker code. No “create cache” button |
| **Cron Trigger** | Already on Worker; **edit** 12h → 6h when we ship cache phase | Pre-warm popular feeds |
| **Worker variable `WORKER_PUBLIC_URL`** | Confirm it matches the real `*.workers.dev` | Cron warm must hit **this Worker**, not Pages |
| **KV `WAITLIST`** | **Skip** | Not used for cache or canonicalization |
| **Pages Functions / `_routes.json`** | **Do not add** | Would confuse `/api` with Pages. API stays on the Worker hostname |
| **R2, D1, Durable Objects, Queues** | **Do not add** | Out of scope |

---

## B. Click-path: confirm Worker (do this first)

1. **Workers & Pages** → **Overview** (or **Workers**).
2. Open **`feedometer-api`** (not a random `worker.js` preview tab with a truncated file).
3. **Settings** → **Compatibility** / **Runtime**: leave as deployed (`compatibility_date` in `wrangler.toml` is `2024-09-01`).
4. **Settings** → **Variables and Secrets**:
   - `WORKER_PUBLIC_URL` = `https://feedometer-api.ancient-smoke-3af9.workers.dev` (no trailing slash).
   - If you later attach a custom API host, change this to that `https://` origin.
5. **Triggers**:
   - **routes / workers.dev**: subdomain `feedometer-api` on account `ancient-smoke-3af9` should already be there.
   - **Cron Triggers**: you should see `0 */12 * * *`. **After** we ship 6h cache in code, change this in the dashboard **or** in `wrangler.toml` and redeploy — one source of truth. Prefer **wrangler.toml + deploy** so git matches Cloudflare.
6. **Deployments**: latest successful deploy must be the **full** `feedometer-worker.js` from this repo. Do **not** paste a truncated script in the dashboard editor (that caused `Unexpected end of input`).

**Cache:** there is no Cache namespace to create. First `/api/view` after deploy is MISS; second same canonical URL should show response header `X-Feedometer-Cache: HIT` (we already set this in code).

---

## C. Click-path: Workers Paid (if not already)

1. **Workers & Pages** → overview, or **Billing**.
2. Enable **Workers Paid**.
3. After it is on, **Workers & Pages** → **`feedometer-api`** → **Metrics** (or account **Analytics**): watch **Requests**. That is the $5 meter (`/api/view`, `/api/og`, `/api/build`).

---

## D. Click-path: Pages (static Reader)

1. **Workers & Pages** → **Pages**.
2. Open the project that publishes this repo (e.g. **feedometer**).
3. **Settings** → **Builds**:
   - Build command: **empty**
   - Output directory: `/` (project root)
4. **No** Functions. **No** `_routes.json` that sends `/api/*` to Pages.
5. Custom domain (optional): Pages hostname for humans; Worker stays `feedometer-api.*.workers.dev` until you add a **Worker custom domain** (e.g. `api.yoursite.com`) and then update `feedometer-config.js` + `WORKER_PUBLIC_URL`.

Redeploy Pages **after** frontend thinning (Phase 5), not before the Worker understands canonical JSON.

---

## E. What you do **not** click

- Do **not** create a KV namespace for “feed cache.” Edge Cache API is enough.
- Do **not** create a second Worker for canonicalization.
- Do **not** put Reader HTML inside the Worker as a site (keep Pages + Worker split).
- Do **not** use the dashboard editor as the source of truth; deploy from this folder (`npx wrangler deploy`) or Git if connected.

---

## F. Flow of events (implementation order)

You (Cloudflare + approve deploys) and code (this repo) alternate. **Worker deploy before Pages** whenever JSON shape changes.

```text
[You]  Confirm Worker + Paid + Pages (sections B–D)
          ↓
[Code] Phase 1 — canonicalizeFeedUrl, cache key, return feedUrl
[You]  wrangler deploy  (Worker only)
[You]  Smoke: paste /feed and /feed/ — second load HIT, same identity
          ↓
[Code] Phase 2–3 — parse, normalize, canonical id, article URL strip, dedupe, ISO dates
[You]  wrangler deploy
[You]  Re-test 10 known feeds vs today’s Reader
          ↓
[Code] Phase 4 — TTL 6h/24h, cron 0 */6 * * *
[You]  wrangler deploy  (cron updates from wrangler.toml)
[You]  Triggers → confirm cron is 6-hourly
[You]  Optional: GET …/api/warm-cache once
          ↓
[Code] Phase 5 — thin feedometer-viewer.js
[You]  Deploy **Pages** (Git push or Pages retry)
[You]  DevTools: only /api/view JSON, no client XML parse
          ↓
[Code] Phase 6 — capacity JSON
[You]  Worker deploy; optional Pages if error copy changed
```

### After each Worker deploy (2 minutes)

1. Open `https://feedometer-api.ancient-smoke-3af9.workers.dev/` → `status: ok`.
2. Reader → one pill → Network → `/api/view` → 200 JSON.
3. Repeat same feed → `X-Feedometer-Cache: HIT`.
4. If dashboard **Preview** shows a syntax error, you edited the wrong/truncated script — redeploy from git, do not “fix” in the tiny editor.

---

## G. Optional later (not for this pass)

| Cloudflare thing | When |
| --- | --- |
| Worker **custom domain** | You want `api.` on your brand instead of `workers.dev` |
| Expand **popular list** in code (not a CF product) | You have ~50 URLs |
| KV hit counters | Only if we ever do “10 users → extra day” |
| Logpush / Workers Trace | Debugging production, not required to ship |

---

## H. One-screen mental model

```text
User browser
    → Pages (index.html, CSS, thin JS)     [you: Pages project]
    → GET Worker /api/view?url=…           [you: Worker feedometer-api]
         → Cache API (automatic)
         → fetch(bbc rss) on MISS
         → JSON canonical items
    → Cron every 6h warms popular URLs     [you: Cron trigger on that Worker]
```

If health JSON works but Reader fails, `feedometer-config.js` is pointing at the **wrong** hostname (that already happened with `feedometer-api.feedometer.workers.dev`). Dashboard Worker URL and config must match.
