# FeedOmeter: Pre-Launch Gap Analysis & Production Deployment Roadmap

**Document Title:** Pre-Launch Gap doc Analysis  
**Target Path:** `C:\feedometer\documents\Go-Live Readyness\Pre-Launch Gap doc Analysis.md`  
**System:** FeedOmeter RSS Reader & Discovery Platform  
**Target Infrastructure:** Cloudflare (Pages, Workers, KV, WAF, DNS, Web Analytics)  
**Status:** Strategic Pre-Launch Audit & Operational Action Plan  

---

## 1. Executive Overview

This document provides a comprehensive operational and infrastructure gap analysis for **FeedOmeter** prior to public launch. While the application source code (front-end reader, edge parser, SSRF protection, content moderation, and bolt-on telemetry) is 100% complete and verified, several Cloudflare cloud bindings, security controls, and deployment settings must be configured to ensure high availability, abuse prevention, and legal compliance.

---

## 2. Prioritized Gap Matrix

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                               FEEDOMETER PRE-LAUNCH GAPS                               │
├──────────────────────────────┬─────────────────────────────┬───────────────────────────┤
│ 🔴 HIGH PRIORITY (Functional)│ 🟡 MEDIUM PRIORITY (Config) │ 🟢 LOW PRIORITY (Polish)  │
├──────────────────────────────┼─────────────────────────────┼───────────────────────────┤
│ • Missing WAITLIST KV Binding│ • Set ADMIN_SECRET in CF    │ • Privacy Policy Section  │
│   in wrangler.toml           │ • Cloudflare WAF Rate Limit │ • Social Share Card Image │
│ • Custom Domain Alignment    │ • Cloudflare Web Analytics  │ • Sitemap & robots.txt    │
└──────────────────────────────┴─────────────────────────────┴───────────────────────────┘
```

---

## 3. Detailed Gap Breakdown

### 3.1 🔴 High Priority Gaps (Functional Dependencies)

#### Gap 1.1: Missing `WAITLIST` KV Namespace Binding in `wrangler.toml`
* **Current State:** `feedometer-worker.js` (lines 1911 & 1932) persists email submissions into `env.WAITLIST`. However, `wrangler.toml` only defines `binding = "FEEDS_KV"`.
* **Risk:** When users click the **"Notify Me"** button and submit their email address, the Worker returns `503 Waitlist storage not configured`.
* **Remediation Action:**
  1. Create the KV namespace in Cloudflare: `npx wrangler kv:namespace create WAITLIST`
  2. Bind the namespace in `wrangler.toml`:
     ```toml
     [[env.production.kv_namespaces]]
     binding = "WAITLIST"
     id = "<YOUR_WAITLIST_KV_ID>"
     ```

#### Gap 1.2: Custom Domain & Canonical URL Alignment
* **Current State:** `index.html`, `sitemap.xml`, and `feedometer-config.js` point to the default staging targets (`feedometer.pages.dev` and `ancient-smoke-3af9.workers.dev`).
* **Risk:** Search engines will index the staging `.pages.dev` domain rather than your primary brand domain (e.g., `feedometer.app` or `feedometer.com`), causing canonical link fragmentation.
* **Remediation Action:**
  1. Attach your custom domain in Cloudflare Pages and configure DNS CNAME/A records.
  2. Update canonical URLs, OpenGraph URLs, and JSON-LD schema in `index.html`.
  3. Map the worker API route (e.g. `api.feedometer.app/*`) to `feedometer-api`.

---

### 3.2 🟡 Medium Priority Gaps (Security & Quota Protection)

#### Gap 2.1: Cloudflare WAF Rate Limiting on `/api/*`
* **Current State:** The Cloudflare Free Worker tier provides 100,000 requests/day. An automated scraping script or continuous bot loop could exhaust this quota rapidly.
* **Risk:** Denial of service / 429 quota exhaustion for legitimate readers.
* **Remediation Action:**
  * Configure a Rate Limiting Rule in the Cloudflare Dashboard (**Security ➔ WAF ➔ Rate Limiting**):
    * **Matching Rule:** `URI Path starts with "/api/"`
    * **Rate Threshold:** `60 requests per 1 minute per IP`
    * **Action:** `Block with HTTP 429`

#### Gap 2.2: Set `ADMIN_SECRET` Environment Secret
* **Current State:** `/api/admin/waitlist` exports all waitlist emails in JSON format. If `ADMIN_SECRET` is not configured via encrypted secrets, it falls back to the default development secret (`feedometer-admin-2026`).
* **Risk:** Unauthorized access to waitlist emails if someone guesses the default token.
* **Remediation Action:**
  * Set a strong private token using Wrangler CLI:
    ```bash
    npx wrangler secret put ADMIN_SECRET
    ```

#### Gap 2.3: Enable Cloudflare Web Analytics (Layer 1 Telemetry)
* **Current State:** Frontend uses the bolt-on `feedometer-telemetry.js` for session dwell time and engagement.
* **Remediation Action:**
  * Toggle **Cloudflare Web Analytics** in Cloudflare Dashboard (**Analytics & Logs ➔ Web Analytics**) for automated, bot-filtered global visitor counts, country distribution, and Core Web Vitals speed metrics with zero cookies.

---

### 3.3 🟢 Low Priority Gaps (Legal & Brand Polish)

#### Gap 3.1: Explicit Privacy Policy Section
* **Current State:** The footer contains a "Terms & Conditions" modal.
* **Remediation Action:**
  * Add a dedicated Privacy Policy section (or tab inside the Terms modal) explicitly detailing:
    * No personal tracking cookies used.
    * No selling of user data or cross-site tracking.
    * Telemetry data is anonymized and aggregated at the edge.

#### Gap 3.2: Social Share Card Banner (`og:image`)
* **Current State:** `index.html` points to `favicon.svg` for OpenGraph sharing.
* **Remediation Action:**
  * Generate and deploy a dedicated 1200x630px social banner (`og-preview.png`) showcasing the mechanical odometer and executive briefing interface for viral sharing on Twitter/X, LinkedIn, and Reddit.

---

## 4. Pre-Launch Execution Runbook

| Step | Task | Tool / Interface | Est. Time |
|---|---|---|---|
| **1** | Bind `WAITLIST` KV namespace in `wrangler.toml` | Code Editor / Wrangler | 3 mins |
| **2** | Add Privacy Policy text to `index.html` | Code Editor | 3 mins |
| **3** | Set `ADMIN_SECRET` in Cloudflare | Wrangler CLI | 1 min |
| **4** | Deploy Cloudflare Worker to Production | `npx wrangler deploy --env production` | 2 mins |
| **5** | Deploy Cloudflare Pages | Cloudflare Dashboard / Git | 3 mins |
| **6** | Enable Cloudflare WAF Rate Limiting (60 req/min) | Cloudflare Dashboard | 2 mins |
| **7** | Enable Cloudflare Web Analytics | Cloudflare Dashboard | 1 min |
| **8** | End-to-End Live Verification (Fetch RSS + Waitlist email) | Live Browser | 2 mins |
