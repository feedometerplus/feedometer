# Gaps audit — consider vs skip

**Date:** September 11, 2026  
**Source audit:** `documents/gaps-audit-normalization.md`  
**Product frame:** public no-login Reader + Builder, one feed at a time. Not the other-cloud SaaS.

Valid diagnosis and “we should do it” are not the same. Verdicts below are for **this** site.

---

## How to read

| Verdict | Meaning |
| --- | --- |
| **Consider** | True, and worth a later pass on this product |
| **Partial** | True, but limited, hygiene-only, or wait for evidence |
| **Skip** | Wrong for this product, fake security, or over-specified |

---

## Decision matrix

| Verdict | Section | Item | Diagnosis | Why |
| --- | --- | --- | --- | --- |
| Consider | 1. API | Cloudflare rate limits on `/api/view` and `/api/build` | Valid | Only lever that actually limits scrapers and bill burn. Builder (HTML + Jina) is the expensive route. |
| Partial | 1. API | CORS `*` is a free extraction API | Valid | Anyone can call the Worker. Accepted for a public no-login tool. JSON-on-the-wire is not a vault. |
| Partial | 1. API | Origin / Referer allowlist | Valid as hygiene | Stops casual website embedding. Curl/Python can send any Origin. Not IP protection. |
| Skip | 1. API | Client HMAC / short-lived browser token | Not valid here | Secret would live in Pages JS. Looks like auth on a product with no sessions. |
| Partial | 2. Parser | Regex breaks on CDATA, namespaces, odd `<link>` tags | Valid risk | Real class of bugs. Do not rewrite until a corpus of feeds that actually fail. |
| Skip | 2. Parser | Adopt fast-xml-parser / WASM streaming XML now | Overstated | Cost with no failing-feed list. `fast-xml-parser` is a tree parser, not a stream engine. |
| Consider | 2. Parser | `HTMLRewriter` for HTML scrape and OG | Valid | Fits Workers. Helps Builder and Layer-B OG without buffering huge HTML in JS regex. |
| Consider | 3. Images | First-match hero (avatars / banners) | Valid | Prefer media / enclosure / OG over first `<img>`; expand negative keywords. |
| Consider | 3. Images | `srcset`: pick densest / largest candidate | Valid | Today takes the first `srcset` token. Cheap, user-visible. Fold into candidate scoring, not a math model. |
| Skip | 3. Images | Full weighted `Score = w_source + …` formula | Over-specified | v1 does not need a scoring equation. Big ads can win on dimension. Empty image stays valid. |
| Consider | 4. Dedupe | Strip editorial prefixes in-feed (`WATCH:`, `Breaking:`) | Valid | Cheap. Helps same-story duplicates inside one feed. |
| Skip | 4. Dedupe | SimHash / Jaccard for syndicated AP–Reuters–Yahoo | Wrong product | Reader is one feed at a time. Cross-wire syndication never appears as two cards. Merges distinct headlines. |
| Consider | 5. Canonical | Unwrap Feedburner / feedproxy article links | Valid if we see it | Fetch already follows redirects for the feed URL. Item links can still be wrappers. Do it from real cards. |
| Skip | 5. Canonical | Strip AMP hosts and `/amp/` paths | Risky | Easy to mint a wrong desktop URL. Only if a tested feed consistently serves AMP as the item link. |
| Consider | 5. Canonical | Add known trackers (`sc_src`, `sc_lid`) to drop list | Valid if conservative | Do not drop generic keys like `source` or `campaign_id` — those can be real CMS ids. |
| Consider | 6. Runtime | Domain 403 circuit breaker | Valid | Same lesson as HN. Stops wasted OG fetches against bot-blocked hosts. |
| Skip | 6. Runtime | Cap waitUntil OG from 12 items to 5–6 | Weak | Already under the 50-subrequest cap (concurrency 4). First visitor still does not get OG; later cache does. |
| Consider | 6. Runtime | OG `waitUntil` does not help the first visitor | Valid (missing from audit recs) | Richer JSON is written to cache after the response. Discuss whether that is acceptable before tuning caps. |
| Consider | 7. Frontend | Use Worker `meta.feedIcon` instead of Google s2/favicons | Valid | `feedIcon` is already in the payload. Client still calls Google. Small, no proxy needed. |
| Skip | 7. Frontend | Proxy and cache favicons on the Worker | Overkill | Extra subrequests and cache complexity for a chrome icon. Use `feedIcon`; skip if empty. |

---

## If we only pick a few

Rate-limit → image candidates → 403 host breaker → `feedIcon` on the client.

## Do not pick up

Browser HMAC. SimHash syndication. WASM/XML rewrite without failing feeds. AMP URL invention. Favicon proxy. Full scoring formula. Cap OG 12→6 as a cost project.
