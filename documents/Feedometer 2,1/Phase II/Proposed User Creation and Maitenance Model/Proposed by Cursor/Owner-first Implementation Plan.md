# FeedOmeter — Owner-first implementation plan

**Date:** 18 September 2026  
**Rule:** Public RSS Reader stays login-free. Everything in the app shell is per user.  
**Progress:** ⚪ not started · 🟡 in progress · 🟢 done

| Light | ID | Task |
|---|---|---|
| 🟢 | T0 | Publish this plan |
| 🟢 | T1 | PBKDF2-SHA256 password hashing (keep legacy SHA-256 verify) |
| 🟢 | T2 | Verify Google access token on the Worker |
| 🟢 | T3 | Real account delete (explicit cleanup) |
| 🟢 | T4 | Owner helpers on `FeedOmeterAuth` (stream, follow, folders) |
| 🟢 | T5 | Gate `shell.html` — require login; Reader stays public |
| 🟢 | T6 | Wire Find Sources + Add Source to `POST /api/subscriptions` |
| 🟢 | T7 | Home / Top Stories / Split Reader use personal `/api/stream` |
| 🟢 | T8 | Star / save / read via article pointer APIs |
| 🟢 | T9 | Watchlists uses folders API |
| 🟢 | T10 | Add `folder_id` FK on `user_feed_assignments` in schema |

Not in this pass (no tables yet): plans, alerts, AI, saved searches.

## How to try it

1. Keep using `index.html` / `viewer.html` without login (public reader).
2. Open `shell.html` — you must sign in (Google or email).
3. Find Sources → Subscribe, or Add Source with a feed URL.
4. Home should load **your** follows. Empty state links to discovery.
5. Star / Read later persist in D1. Starred and Read Later pages load from the API.
6. Watchlists → create folder → Open Stream uses `folder_id`.
7. Danger Zone delete removes the user and personal rows.

Deploy the Worker (`wrangler deploy`) so T1–T3 and personal stream 401-without-token are live.
