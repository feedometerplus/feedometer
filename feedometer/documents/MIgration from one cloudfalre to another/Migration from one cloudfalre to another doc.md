# FeedOmeter: Cloudflare Account Migration Blueprint

**Document Title:** Migration from one cloudfalre to another doc  
**Target Path:** `C:\feedometer\documents\MIgration from one cloudfalre to another\Migration from one cloudfalre to another doc.md`  
**Source Account:** `admin@peopledottech.com`  
**Target Account:** `admin@feedometer.com`  
**System:** FeedOmeter RSS Reader & Discovery Platform (Workers, D1, KV, Pages, DNS)  
**Status:** Architectural Migration Specification & Execution Runbook  

---

## 1. Executive Summary

This document specifies the end-to-end migration procedure to transfer all FeedOmeter Cloudflare cloud infrastructure, databases, KV namespaces, serverless edge workers, secrets, and front-end Cloudflare Pages deployments from the source Cloudflare account (`admin@peopledottech.com`) to the dedicated brand account (`admin@feedometer.com`).

Because FeedOmeter follows an Infrastructure-as-Code and Git-driven architecture, the migration is non-destructive, zero-downtime, and preserves all database records and configurations.

---

## 2. Architecture Migration Mapping

```
SOURCE ACCOUNT (admin@peopledottech.com)         TARGET ACCOUNT (admin@feedometer.com)
┌─────────────────────────────────────┐         ┌─────────────────────────────────────┐
│ 1. D1 Database (feedometer-db)      │ ──SQL──►│ 1. New D1 Database + Imported Data  │
│ 2. KV Namespaces (FEEDS_KV)         │ ───►───►│ 2. New KV Namespaces (FEEDS, WAIT)  │
│ 3. Worker Code (feedometer-api)     │ ──Code─►│ 3. Deployed Worker + Secrets (SMTP) │
│ 4. Cloudflare Pages (feedometer)    │ ──Git──►│ 4. Pages linked to GitHub Repo      │
│ 5. Domain & DNS (feedometer.com)    │ ──DNS──►│ 5. Domain Zone & Hostinger Records  │
└─────────────────────────────────────┘         └─────────────────────────────────────┘
```

---

## 3. Step-by-Step Migration Execution Plan

### Step 1: Backup & Export Existing Data (from Source Account)
1. **D1 Database SQL Export:**
   Export all cataloged feeds, categories, and cached database records into a portable SQL dump:
   ```bash
   npx wrangler d1 export feedometer-db --output ./backup-db.sql
   ```
2. **KV / Waitlist Export:**
   Export any existing subscriber records via the admin waitlist endpoint (`GET /api/admin/waitlist`).

---

### Step 2: Switch Wrangler Authentication to Target Account
1. Log out of the old account in Wrangler:
   ```bash
   npx wrangler logout
   ```
2. Log into the new account:
   ```bash
   npx wrangler login
   ```
3. Authorize the browser popup using **`admin@feedometer.com`**.
4. Confirm active account connection:
   ```bash
   npx wrangler whoami
   ```

---

### Step 3: Provision D1 Database & KV Namespaces in Target Account
1. **Create New D1 Database:**
   ```bash
   npx wrangler d1 create feedometer-db
   ```
   *(Record the newly generated `database_id`)*

2. **Import SQL Backup into New D1:**
   ```bash
   npx wrangler d1 execute feedometer-db --file ./backup-db.sql
   ```

3. **Create New KV Namespaces:**
   ```bash
   npx wrangler kv:namespace create FEEDS_KV
   npx wrangler kv:namespace create WAITLIST
   ```
   *(Record the newly generated `id` for both namespaces)*

---

### Step 4: Update `wrangler.toml` & Deploy Worker to Target Account
1. Open `wrangler.toml` and update the database and KV IDs:
   ```toml
   [[env.production.d1_databases]]
   binding = "DB"
   database_name = "feedometer-db"
   database_id = "<NEW_DATABASE_ID>"

   [[env.production.kv_namespaces]]
   binding = "FEEDS_KV"
   id = "<NEW_FEEDS_KV_ID>"

   [[env.production.kv_namespaces]]
   binding = "WAITLIST"
   id = "<NEW_WAITLIST_KV_ID>"
   ```

2. **Set Encrypted Secrets in New Account:**
   * Set Hostinger email password:
     ```bash
     npx wrangler secret put SMTP_PASS
     ```
   * Set admin API secret:
     ```bash
     npx wrangler secret put ADMIN_SECRET
     ```

3. **Deploy Worker to Production:**
   ```bash
   npx wrangler deploy --env production
   ```
   *(Note the new worker endpoint: `https://feedometer-api.<new-subdomain>.workers.dev`)*

4. **Update Frontend Worker Base URL:**
   Update `PRODUCTION_API` in `scripts/feedometer-config.js` with the new worker endpoint.

---

### Step 5: Connect Cloudflare Pages (Frontend Repository)
1. Log into **[dash.cloudflare.com](https://dash.cloudflare.com)** as `admin@feedometer.com`.
2. Navigate to **Workers & Pages ➔ Create application ➔ Pages ➔ Connect to Git**.
3. Select your GitHub repository for FeedOmeter.
4. Set:
   * **Project Name:** `feedometer`
   * **Production Branch:** `main`
   * **Build output directory:** `/` (root)
5. Click **Save and Deploy**. Cloudflare Pages will build and deploy the live site under the new account.

---

### Step 6: Domain & DNS Configuration (Hostinger & feedometer.com)
1. In the target Cloudflare account (`admin@feedometer.com`), navigate to **Websites ➔ Add a Site** and enter **`feedometer.com`**.
2. Cloudflare will provide 2 new nameservers (e.g. `ns1.cloudflare.com`, `ns2.cloudflare.com`).
3. Update nameservers in your Hostinger domain control panel.
4. **Preserve Hostinger Email DNS Records:**
   Ensure MX records (`mx1.hostinger.com`, `mx2.hostinger.com`) and SPF/DKIM TXT records are present in Cloudflare DNS so `admin@feedometer.com` email delivery continues without interruption.
5. In Cloudflare Pages, link the custom domain `feedometer.com` and `www.feedometer.com`.

---

## 4. Migration Verification Checklist

* [ ] D1 SQL backup exported and verified.
* [ ] Wrangler logged in as `admin@feedometer.com`.
* [ ] New D1 database created and populated with schema/data.
* [ ] `FEEDS_KV` and `WAITLIST` namespaces created.
* [ ] `wrangler.toml` updated with new IDs.
* [ ] `SMTP_PASS` and `ADMIN_SECRET` configured via wrangler secret.
* [ ] Worker deployed to production on new account.
* [ ] `scripts/feedometer-config.js` updated with new worker URL.
* [ ] Cloudflare Pages connected to GitHub repository.
* [ ] Custom domain `feedometer.com` active with SSL/TLS.
* [ ] Test feed fetch & waitlist email notification verified in Hostinger inbox.
