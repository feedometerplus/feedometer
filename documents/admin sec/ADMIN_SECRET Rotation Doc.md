# FeedOmeter: ADMIN_SECRET Rotation Guide

**Document Title:** ADMIN_SECRET Rotation Doc  
**Target Path:** `C:\feedometer\documents\admin sec\ADMIN_SECRET Rotation Doc.md`  
**System:** FeedOmeter RSS Reader & Discovery Platform  
**Applies To:** Cloudflare Worker `feedometer-api`  
**Status:** Operational procedure (no code change required to rotate)

---

## 1. What this secret is

`ADMIN_SECRET` protects two Worker routes that expose waitlist data:

| Route | Method | Purpose |
|---|---|---|
| `/api/admin/waitlist` | GET | Export Notify signup emails (KV + D1 totals) |
| `/api/admin/waitlist-sync` | GET or POST | Copy waitlist KV records into D1 `notify_signups` |

Callers must send header:

```
X-Admin-Secret: <secret value>
```

If the header does not match, the Worker returns **401 Unauthorized**.

These routes are not used by the public Notify button. Notify only posts to `/api/waitlist`.

---

## 2. What “rotate” means

**Rotate** means: stop trusting any previously known password, store a **new random secret** on the production Worker, and use only that value from then on.

The Worker reads `env.ADMIN_SECRET` from Cloudflare. If that secret is **not** set, the code currently falls back to a hardcoded development string in `workers/feedometer-worker.js`. That fallback is in source control, so it is **not** a production secret. Anyone with the repo (or an old chat) can export the waitlist until Cloudflare has a real Secret set.

After rotation:

- The new Cloudflare Secret is the only value that works.
- The old / fallback string must return **401**.

Custom domain is not required for this. DNS / Hostinger / SMTP are unrelated.

---

## 3. How to implement (Cloudflare dashboard)

No code change is required if you only set the dashboard secret. The Worker already prefers `env.ADMIN_SECRET` over the fallback.

### 3.1 Create a new secret

- Use a long random string (32+ characters).
- Do **not** reuse the Hostinger mailbox password.
- Do **not** put it in `wrangler.toml`, Git, Slack, or screenshots.

Store it in a password manager only.

### 3.2 Save it on the production Worker

1. Open [Cloudflare Dashboard](https://dash.cloudflare.com).
2. Go to **Workers & Pages** → **`feedometer-api`**.
3. Open **Settings** → **Variables and Secrets**.
4. Click **Add**.
   - **Name:** `ADMIN_SECRET`
   - **Type:** **Secret** (encrypted, not a plain Variable)
   - **Value:** the new random string
5. Save. Deploy if the UI asks.

If `ADMIN_SECRET` already exists, **edit** it to the new value. That edit is the rotation.

Repeat on **`feedometer-api-stage`** if staging should be locked the same way.

### 3.3 Call the APIs with the new secret

Header:

```
X-Admin-Secret: <the new value>
```

Example:

```
GET https://feedometer-api.ancient-smoke-3af9.workers.dev/api/admin/waitlist
```

### 3.4 Verify rotation worked

1. Call `/api/admin/waitlist` with the **old / fallback** string → expect **401**.
2. Call `/api/admin/waitlist` with the **new** secret → expect **200** and the email list (`kvTotal`, `d1Total`).

---

## 4. What not to do

- Do not store `ADMIN_SECRET` as a plaintext **Variable** (use **Secret**).
- Do not commit the value to the repository.
- Do not share it in chat.
- Do not confuse this with `SMTP_PASS` (removed) or Hostinger mailbox credentials.

---

## 5. Optional later hardening (code)

When you next change Worker code, you can remove the hardcoded fallback so a missing `ADMIN_SECRET` means **deny all**, never “use the default.” That is extra hardening. Dashboard rotation already protects production as soon as the Secret is set.

---

## 6. Related waitlist behaviour (context)

- Live Notify signups are written to KV (`waitlist:email:<address>` on `FEEDS_KV`).
- D1 table `notify_signups` is the daily ledger (cron 13:00 UTC / 7:00 PM IST, or manual `/api/admin/waitlist-sync`).
- Rotating `ADMIN_SECRET` does not delete or move those emails. It only changes who can export or sync them.
