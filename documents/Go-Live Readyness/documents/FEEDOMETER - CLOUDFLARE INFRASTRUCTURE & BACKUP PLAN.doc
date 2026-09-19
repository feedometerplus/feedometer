# FEEDOMETER - CLOUDFLARE INFRASTRUCTURE & BACKUP PLAN

===================================================

## GOAL
Maintain a clean, scalable, and low-cost Cloudflare architecture for Feedometer with:
- Production Environment
- Stage Environment
- Development Environment
- Automated Daily Backups
- Admin Dashboard
- Easy Restore Capability

---

## ARCHITECTURE
```
Cloudflare Account
│
├── D1 Database: feedometer-prod
├── D1 Database: feedometer-stage
├── D1 Database: feedometer-dev
│
├── Worker: feedometer-api-prod
├── Worker: feedometer-api-stage
├── Worker: feedometer-api-dev
│
├── R2 Bucket: feedometer-backups
│
└── Admin Dashboard
    ├── Feed Management
    ├── Analytics
    ├── SQL Console
    ├── Audit Logs
    ├── Backup Manager
    ├── Restore Manager
    └── Environment Switcher
```

---

## ENVIRONMENTS

### 1. PROD (Production)
- **Database:** `feedometer-prod`
- **Purpose:**
  - Live application
  - Real users
  - Real feeds
  - Real articles
- **Rules:**
  - No experimental changes
  - Only tested releases

### 2. STAGE (Pre-Production)
- **Database:** `feedometer-stage`
- **Purpose:**
  - Final testing
  - Migration testing
  - Release validation
  - Performance verification
- **Rules:**
  - Clone data from PROD when needed

### 3. DEV (Development)
- **Database:** `feedometer-dev`
- **Purpose:**
  - New features
  - Experiments
  - Development work
  - Bug fixes
- **Rules:**
  - Safe place to break things
  - No impact on production

---

## WHY NOT CREATE A BACKUP D1 DATABASE?

**NOT RECOMMENDED:** `feedometer-prod` ↓ `feedometer-backup`

### Reason:
- Double storage
- Additional reads
- Additional writes
- More usage consumption
- More maintenance

**Instead use SQL backups stored in R2.**

---

## RECOMMENDED BACKUP STRATEGY

### Daily Backup Workflow
1. Scheduler Trigger
2. Prod Database
3. Export SQL
4. Create Backup File
5. Store Backup in R2
6. Verify Backup
7. Log Result

### VISUAL FLOW
```
feedometer-prod
       ↓
   Export SQL
       ↓
backup-YYYY-MM-DD.sql
       ↓
   R2 Bucket
       ↓
 Backup History
```

### EXAMPLE
```
feedometer-prod
       ↓
backup-2026-09-15.sql
       ↓
R2 Bucket:
  backup-2026-09-15.sql
  backup-2026-09-14.sql
  backup-2026-09-13.sql
  backup-2026-09-12.sql
```

---

## RESTORE WORKFLOW

1. Select Backup
2. Confirm Restore
3. Import SQL File
4. Rebuild Database
5. Verify Results
6. System Ready

---

## ADMIN DASHBOARD

### Environment Selector
`[ PROD ▼ ] [ STAGE ] [ DEV ]`

### DATABASE MANAGEMENT
- `[ Backup Now ]`
- `[ Restore Backup ]`
- `[ Download Backup ]`
- `[ Delete Backup ]`
- `[ View Backups ]`
- `[ Open SQL Console ]`

### FEED MANAGEMENT
- `[ Add Feed ]`
- `[ Edit Feed ]`
- `[ Delete Feed ]`
- `[ View Feed ]`
- `[ Refresh Feed ]`
- `[ Test Feed ]`

#### Bulk Actions:
- `[ Bulk Activate ]`
- `[ Bulk Disable ]`
- `[ Bulk Delete ]`
- `[ Bulk Refresh ]`

### ANALYTICS

#### Dashboard Cards:
- Total Feeds
- Active Feeds
- Disabled Feeds
- Total Articles
- New Articles Today
- Fetch Failures

#### Charts:
- Feed Growth
- Articles Per Day
- Category Distribution
- Feed Health

---

## ADMIN OPERATIONS

### [ Clone PROD → STAGE ]
**Workflow:**
1. Export PROD
2. Import STAGE
3. Verification
4. Done

### [ Clone PROD → DEV ]
**Workflow:**
1. Export PROD
2. Clear DEV
3. Import DEV
4. Verification
5. Done

---

## LOGGING & AUDIT

Track every action:
- Feed Added
- Feed Updated
- Feed Deleted
- Backup Created
- Backup Restored
- SQL Executed
- User Login
- Configuration Changed

---

## RECOMMENDED INITIAL SETUP

### D1 Databases:
- `feedometer-prod`
- `feedometer-stage`
- `feedometer-dev`

### R2 Buckets:
- `feedometer-backups`

### Workers:
- `feedometer-api-prod`
- `feedometer-api-stage`
- `feedometer-api-dev`

### Dashboard:
- `admin.feedometer.com`

---

## FINAL RECOMMENDATION

**Use:**
- `feedometer-prod`
- `feedometer-stage`
- `feedometer-dev`

**For backups:**
```
feedometer-prod
       ↓
   Export SQL
       ↓
backup-YYYY-MM-DD.sql
       ↓
   R2 Storage
```

### Benefits:
- ✓ Clean architecture
- ✓ Lower operational cost
- ✓ Easy disaster recovery
- ✓ Historical backups
- ✓ One-click restore
- ✓ Safe development environment
- ✓ Safe staging environment
- ✓ No duplicate live backup database
- ✓ Scales with Feedometer growth
- ✓ Industry-standard deployment model

---
---

# 📊 DETAILED ARCHITECTURAL ANALYSIS & QUOTA VERIFICATION

## 1. Cloudflare Free Plan Quota & Stress Analysis

| Cloudflare Service | Free Tier Allowance | Feedometer Usage (Prod + Stage + Dev) | Stress Level |
| :--- | :--- | :--- | :---: |
| **D1 Databases** | **Up to 50,000 DBs**<br>5 GB Total Storage | **3 DBs** (`prod`, `stage`, `dev`).<br>~10 MB – 50 MB total storage. | **0.01%** (Ultra Low) |
| **D1 Reads** | **5,000,000 rows / day** | ~10k – 50k rows / day.<br>*(User reads served from Edge Cache; D1 is only queried for new feeds and admin audits).* | **< 1%** (Completely Safe) |
| **D1 Writes** | **100,000 rows / day** | ~100 – 1,000 writes / day.<br>*(Duplicates are skipped in <0.1ms; only new distinct feeds consume write quota).* | **1%** (Safe) |
| **Cloudflare Workers** | **100,000 reqs / day**<br>(Shared across all workers) | Prod (~5k–20k reqs/day), Stage/Dev (<100 reqs/day).<br>Worker quantity is unlimited; only total requests count. | **10–20%** (Safe) |
| **R2 Backup Storage** | **10 GB / month FREE** | 30 daily backups $\times$ 5 MB = **~150 MB total**. | **1.5%** (Virtually Zero) |
| **R2 Write Operations** | **1,000,000 writes / month** | 30 automated backup uploads / month. | **0.003%** (Zero Stress) |
| **R2 Egress (Bandwidth)** | **100% UNLIMITED & FREE** | $0 egress fees forever on Cloudflare R2. | **0%** |
| **Cloudflare Pages** | **Unlimited Bandwidth** | Hosts the Reader & Admin Dashboard. | **0%** |

---

## 2. Key Gaps Identified & Exact Technical Solutions

```
                      ┌────────────────────────────────────────┐
                      │ Cloudflare Zero Trust (SSO Protected)  │
                      └──────────────────┬─────────────────────┘
                                         ▼
                      ┌────────────────────────────────────────┐
                      │    Unified Admin Dashboard UI          │
                      │    (Environment Switcher: P/S/D)       │
                      └────┬──────────────┬──────────────┬─────┘
                           │              │              │
             ┌─────────────┘              │              └─────────────┐
             ▼                            ▼                            ▼
   ┌───────────────────┐        ┌───────────────────┐        ┌───────────────────┐
   │ PROD ENVIRONMENT  │        │ STAGE ENVIRONMENT │        │  DEV ENVIRONMENT  │
   │ Worker: api-prod  │        │ Worker: api-stage │        │ Worker: api-dev   │
   │ D1: feedometer-prod│       │ D1:feedometer-stage│       │ D1: feedometer-dev│
   └─────────┬─────────┘        └───────────────────┘        └───────────────────┘
             │ (Daily 2 AM Cron)
             ▼
   ┌───────────────────┐
   │ R2 Bucket Storage │
   │ 30-Day Auto Prune │
   └───────────────────┘
```

### Gap 1: Automated Daily Backup Execution Mechanism in Workers
- **Issue:** D1 does not automatically export files to R2 by itself without a trigger.
- **Solution:** Add a scheduled Cron trigger (`crons = ["0 2 * * *"]` — 2 AM UTC daily) to the production worker. The worker reads the active tables, serializes a compressed SQL snapshot, and uploads it to R2 via `env.BACKUP_BUCKET.put('backup-YYYY-MM-DD.sql', data)`.

### Gap 2: R2 Backup Accumulation (Retention Policy)
- **Issue:** Daily backups accumulating over years could eventually grow.
- **Solution:** Configure an **R2 Lifecycle Rule** directly on the `feedometer-backups` bucket to automatically delete backup objects older than **30 days** (or 60 days). This keeps storage permanently under 200 MB ($<2\%$ of the 10 GB free tier).

### Gap 3: Admin Dashboard Security & Authentication
- **Issue:** The Admin Dashboard includes sensitive operations (`Restore Database`, `SQL Console`, `Clone PROD → DEV`).
- **Solution:**
  1. Protect the dashboard with **Cloudflare Zero Trust / Access** (100% free for up to 50 users — prompts for email OTP login before loading).
  2. Protect all admin API worker endpoints with a cryptographically secure `X-Admin-Secret` header.

### Gap 4: Safety Guard Against Accidental Overwrite on PROD
- **Issue:** An accidental click on "Restore" or "Clone DEV → PROD" could wipe live user data.
- **Solution:**
  - Hardcode a safety rule in the database engine: **PROD can only be a clone *Source*, never an automated *Target*.**
  - Any restore operation targeting PROD must require typing the exact confirmation phrase `"RESTORE-PRODUCTION-DATA"`.

### Gap 5: Local Offline Testing for Dev
- **Issue:** Running `npx wrangler dev` without flags can make remote calls to your Cloudflare account.
- **Solution:** In local development, use `npx wrangler dev --local` to test against a local SQLite file offline without consuming any Cloudflare quota.

---

## 3. Production Multi-Environment `wrangler.toml` Specification

```toml
name = "feedometer-api"
main = "workers/feedometer-worker.js"
compatibility_date = "2024-09-01"

# -------------------------------------------------------------
# 1. DEVELOPMENT ENVIRONMENT (Default / Local / Dev Cloud)
# -------------------------------------------------------------
[vars]
ENVIRONMENT = "development"
WORKER_PUBLIC_URL = "http://localhost:8787"

[[d1_databases]]
binding = "DB"
database_name = "feedometer-dev"
database_id = "<DEV_D1_DATABASE_ID>"

[[r2_buckets]]
binding = "BACKUP_BUCKET"
bucket_name = "feedometer-backups"

# -------------------------------------------------------------
# 2. STAGING ENVIRONMENT (Pre-Production)
# -------------------------------------------------------------
[env.staging]
name = "feedometer-api-stage"
[env.staging.vars]
ENVIRONMENT = "staging"
WORKER_PUBLIC_URL = "https://feedometer-api-stage.<your-account>.workers.dev"

[[env.staging.d1_databases]]
binding = "DB"
database_name = "feedometer-stage"
database_id = "<STAGE_D1_DATABASE_ID>"

[[env.staging.r2_buckets]]
binding = "BACKUP_BUCKET"
bucket_name = "feedometer-backups"

# -------------------------------------------------------------
# 3. PRODUCTION ENVIRONMENT (Live Users)
# -------------------------------------------------------------
[env.production]
name = "feedometer-api-prod"
[env.production.vars]
ENVIRONMENT = "production"
WORKER_PUBLIC_URL = "https://feedometer-api.ancient-smoke-3af9.workers.dev"

[[env.production.d1_databases]]
binding = "DB"
database_name = "feedometer-prod"
database_id = "e25f4a17-8f70-40ea-95dd-3a5d22a60be0"

[[env.production.r2_buckets]]
binding = "BACKUP_BUCKET"
bucket_name = "feedometer-backups"

# Scheduled Daily Backup (Runs at 02:00 UTC on Production)
[env.production.triggers]
crons = ["0 2 * * *"]
```

---

## 4. Multi-Environment Deployment Commands

```bash
# Deploy to Development
npx wrangler deploy

# Deploy to Staging
npx wrangler deploy --env staging

# Deploy to Live Production
npx wrangler deploy --env production
```
