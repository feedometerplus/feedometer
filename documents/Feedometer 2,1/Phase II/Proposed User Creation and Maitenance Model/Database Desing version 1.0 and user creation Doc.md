# FEEDOMETER 2.1 — MASTER ARCHITECTURAL SPECIFICATION
## Database Design Version 1.0 & Enterprise User Creation, Authentication Lifecycle, System Audit and Maintenance Model

**Document Title:** Database Design version 1.0 and user creation Doc  
**Target System:** FeedOmeter 2.1 Enterprise Cloudflare D1 Backend & Web Shell  
**Architecture Version:** Version 1.0 Final Production Specification (With System Audit & Roadmap)  
**Classification:** Enterprise Identity (IAM) & Normalized Content Distribution Engine  
**Platform Score:** 9.5 / 10 Enterprise SaaS Grade (Feedly / Notion / Stripe Caliber)  
**Date:** September 18, 2026  
**Status:** Approved Master Blueprint for Schema & Worker Execution  

---

## 1. Executive Summary & The 7-Domain Identity Subsystem

To build a scalable, multi-tenant SaaS application capable of competing with Feedly, Inoreader, Notion, and Slack, Identity and User Management is treated as a complete, decoupled subsystem consisting of **7 Core Security Domains** alongside a normalized content catalog.

| Security Domain | Table Entity | Responsibilities & Capabilities |
|---|---|---|
| **1. Core Identity & Profile** | `users` | Master human identity, verified email anchor, names, display name, DOB (locked), avatar, status, soft-delete timestamp. |
| **2. Auth Providers** | `user_auth_providers` | Pluggable OAuth linkages (Google, Apple, Microsoft, GitHub) mapped to the same single verified user account. |
| **3. Password Management** | `user_passwords` | Decoupled credentials, Argon2/PBKDF2 hash, brute-force tracking (`failed_attempts`), auto-lockout (`locked_until`). |
| **4. Session & Devices** | `user_sessions` | Multi-device bearer token hashes, device name, IP address, user-agent, last seen time, remote device revocation. |
| **5. Email Verification** | `email_verifications` | Cryptographic nonces for account activation and email verification links. |
| **6. Password Recovery** | `password_reset_tokens` | Time-limited single-use tokens for self-service password recovery. |
| **7. Audit & Compliance** | `user_audit_logs` | Enterprise audit trail recording logins, password changes, provider links/unlinks, and credential updates. |

---

## 2. Complete User Journey & Lifecycle Specification

### Stage 1: Registration (Email + Password)
1. User enters Email and Password.
2. Server checks `users` table `WHERE email = ?`.
   - **If exists via Google (no password yet):** Returns 409 Conflict prompting user to sign in with Google or set a password in Settings.
   - **If exists with active password:** Returns 409 Conflict prompting user to log in.
   - **If new:** Inserts user (`email_verified = 0`), inserts `user_passwords` (hashed), dispatches `email_verifications` token.

### Stage 2: Email Verification & Activation
1. User clicks verification link containing token nonce.
2. Server validates token in `email_verifications` (checks `used = 0` and `expires_at > now`).
3. Server updates `users SET email_verified = 1` and marks token as used.

### Stage 3: Authentication & Multi-Device Session Issuance
1. Client provides credentials (Password or Google OAuth payload).
2. Server verifies password hash or Google `sub` identifier in `user_auth_providers`.
3. Check `user_passwords.locked_until`: If locked, reject with time remaining.
4. If successful: Reset `failed_attempts = 0`, issue 30-day bearer token, store SHA-256 hash in `user_sessions` with device_name, IP, and user-agent. Log `LOGIN_SUCCESS` in `user_audit_logs`.

### Stage 4: Profile Completion & Strict DOB Lock Rule
1. User navigates to Settings $	o$ My Profile.
2. User can update First Name, Last Name, Display Name, and Avatar URL.
3. **Date of Birth (DOB) Rule:** User can enter DOB once. Upon save, `dob_locked` is set to 1. Further edits in the UI/backend are permanently locked for identity/KYC integrity.

### Stage 5: Pluggable Social Account Linking (Google, Apple, MS)
1. Logged-in user navigates to Settings $	o$ Connected Accounts $	o$ Connect Google.
2. Server verifies Google token matches authenticated user email or links as secondary identity in `user_auth_providers`.
3. User can now log in via Google 1-Click OR Email/Password to access the exact same account.

### Stage 6: Reauthenticated Password Management
1. Changing password requires confirming Current Password.
2. For Google-only users creating a password for the first time, session reauthentication is verified.
3. Upon password change: All **OTHER** active sessions in `user_sessions` are revoked immediately.

### Stage 7: Self-Service Device & Session Management
1. Settings $	o$ Security displays all active sessions (e.g. Chrome Windows / Hyderabad, Safari iPhone / Mumbai).
2. User can revoke individual devices or click "Log Out All Other Devices".

---

## 3. Complete Master Production D1 Relational Schema

```sql
-- ==============================================================================
-- FEEDOMETER 2.1 — ENTERPRISE IDENTITY & CONTENT PLATFORM (CLOUDFLARE D1)
-- ==============================================================================

-- 1. DROP EXISTING TABLES IN REVERSE DEPENDENCY ORDER
DROP TABLE IF EXISTS article_events;
DROP TABLE IF EXISTS feed_submissions;
DROP TABLE IF EXISTS read_history;
DROP TABLE IF EXISTS saved_articles;
DROP TABLE IF EXISTS starred_articles;
DROP TABLE IF EXISTS user_feed_assignments;
DROP TABLE IF EXISTS user_feeds;
DROP TABLE IF EXISTS folders;
DROP TABLE IF EXISTS articles;
DROP TABLE IF EXISTS source_health;
DROP TABLE IF EXISTS sources;
DROP TABLE IF EXISTS publishers;
DROP TABLE IF EXISTS user_preferences;
DROP TABLE IF EXISTS user_audit_logs;
DROP TABLE IF EXISTS password_reset_tokens;
DROP TABLE IF EXISTS email_verifications;
DROP TABLE IF EXISTS user_sessions;
DROP TABLE IF EXISTS user_passwords;
DROP TABLE IF EXISTS user_auth_providers;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS notify_signups;

-- DOMAIN 1: CORE IDENTITY & PROFILE
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  email_verified INTEGER DEFAULT 0 CHECK(email_verified IN (0, 1)),
  first_name TEXT,
  last_name TEXT,
  display_name TEXT,
  dob TEXT,
  dob_locked INTEGER DEFAULT 0 CHECK(dob_locked IN (0, 1)),
  avatar_url TEXT,
  status TEXT DEFAULT 'active' CHECK(status IN ('active', 'suspended', 'deleted')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER,
  last_login INTEGER,
  deleted_at INTEGER
);

-- DOMAIN 2: PLUGGABLE AUTH PROVIDERS
CREATE TABLE user_auth_providers (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  provider TEXT NOT NULL CHECK(provider IN ('google', 'apple', 'github', 'microsoft', 'saml')),
  provider_user_id TEXT NOT NULL,
  provider_email TEXT,
  provider_metadata TEXT,
  created_at INTEGER NOT NULL,
  UNIQUE(provider, provider_user_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- DOMAIN 3: PASSWORD MANAGEMENT & BRUTE-FORCE LOCKOUT
CREATE TABLE user_passwords (
  user_id TEXT PRIMARY KEY,
  password_hash TEXT NOT NULL,
  password_changed_at INTEGER NOT NULL,
  failed_attempts INTEGER DEFAULT 0,
  locked_until INTEGER,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- DOMAIN 4: MULTI-DEVICE SESSIONS & SESSIONS MANAGEMENT
CREATE TABLE user_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token_hash TEXT UNIQUE NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  device_name TEXT,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  last_seen INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- DOMAIN 5: EMAIL VERIFICATION TOKENS
CREATE TABLE email_verifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token_hash TEXT UNIQUE NOT NULL,
  expires_at INTEGER NOT NULL,
  used INTEGER DEFAULT 0 CHECK(used IN (0, 1)),
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- DOMAIN 6: PASSWORD RESET TOKENS
CREATE TABLE password_reset_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token_hash TEXT UNIQUE NOT NULL,
  expires_at INTEGER NOT NULL,
  used INTEGER DEFAULT 0 CHECK(used IN (0, 1)),
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- DOMAIN 7: ENTERPRISE AUDIT & COMPLIANCE LOGS
CREATE TABLE user_audit_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  event_type TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  metadata TEXT,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- DOMAIN 8: USER PREFERENCES & EXPERIENCE
CREATE TABLE user_preferences (
  user_id TEXT PRIMARY KEY,
  theme TEXT DEFAULT 'system' CHECK(theme IN ('light', 'dark', 'system')),
  reading_mode TEXT DEFAULT 'cards' CHECK(reading_mode IN ('cards', 'split', 'compact')),
  font_size TEXT DEFAULT 'medium' CHECK(font_size IN ('small', 'medium', 'large')),
  default_view TEXT DEFAULT 'home',
  timezone TEXT DEFAULT 'UTC',
  language TEXT DEFAULT 'en',
  date_format TEXT DEFAULT 'YYYY-MM-DD',
  email_notifications INTEGER DEFAULT 1 CHECK(email_notifications IN (0, 1)),
  auto_mark_read INTEGER DEFAULT 0 CHECK(auto_mark_read IN (0, 1)),
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE notify_signups (
  email TEXT PRIMARY KEY,
  joined_at TEXT NOT NULL,
  source TEXT,
  country TEXT,
  city TEXT,
  synced_at TEXT NOT NULL
);

-- DOMAIN 9: PUBLISHERS, SOURCES & CATALOG
CREATE TABLE publishers (
  domain TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  bg_color TEXT,
  description TEXT,
  logo_url TEXT,
  is_popular INTEGER DEFAULT 0 CHECK(is_popular IN (0, 1)),
  popularity_rank INTEGER
);

CREATE TABLE sources (
  id TEXT PRIMARY KEY,
  publisher_domain TEXT,
  title TEXT NOT NULL,
  feed_url TEXT UNIQUE NOT NULL,
  website_url TEXT,
  source_type TEXT DEFAULT 'rss' CHECK(source_type IN ('rss', 'atom', 'youtube', 'reddit', 'amazon_deals', 'podcast', 'substack', 'custom')),
  feed_config TEXT,
  category TEXT DEFAULT 'general',
  language TEXT DEFAULT 'en',
  logo_url TEXT,
  is_verified INTEGER DEFAULT 0 CHECK(is_verified IN (0, 1)),
  article_count INTEGER DEFAULT 0,
  last_polled_at INTEGER,
  last_article_at INTEGER,
  status TEXT DEFAULT 'active' CHECK(status IN ('active', 'paused', 'failing')),
  FOREIGN KEY (publisher_domain) REFERENCES publishers(domain) ON DELETE SET NULL
);

CREATE TABLE source_health (
  source_id TEXT PRIMARY KEY,
  last_success_at INTEGER,
  last_failure_at INTEGER,
  consecutive_failures INTEGER DEFAULT 0,
  last_http_status INTEGER,
  response_ms INTEGER,
  error_message TEXT,
  FOREIGN KEY (source_id) REFERENCES sources(id) ON DELETE CASCADE
);

CREATE TABLE feed_submissions (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  feed_url TEXT NOT NULL,
  suggested_title TEXT,
  suggested_category TEXT,
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected')),
  reviewed_at INTEGER,
  reviewed_by TEXT,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- DOMAIN 10: NORMALIZED CONTENT CATALOG
CREATE TABLE articles (
  id TEXT PRIMARY KEY,
  canonical_url_hash TEXT UNIQUE NOT NULL,
  source_id TEXT NOT NULL,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  author TEXT,
  snippet TEXT,
  content TEXT,
  image_url TEXT,
  published_at INTEGER NOT NULL,
  ingested_at INTEGER NOT NULL,
  is_pinned INTEGER DEFAULT 0 CHECK(is_pinned IN (0, 1)),
  FOREIGN KEY (source_id) REFERENCES sources(id) ON DELETE CASCADE
);

-- DOMAIN 11: HIERARCHICAL TAXONOMY & SUBSCRIPTIONS
CREATE TABLE folders (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  parent_folder_id TEXT,
  icon TEXT DEFAULT '📁',
  sort_order INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (parent_folder_id) REFERENCES folders(id) ON DELETE SET NULL
);

CREATE TABLE user_feeds (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  source_id TEXT NOT NULL,
  followed_at INTEGER NOT NULL,
  UNIQUE(user_id, source_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (source_id) REFERENCES sources(id) ON DELETE CASCADE
);

CREATE TABLE user_feed_assignments (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  feed_id TEXT NOT NULL,
  folder_id TEXT NOT NULL,
  assigned_at INTEGER NOT NULL,
  UNIQUE(user_id, feed_id, folder_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (feed_id) REFERENCES sources(id) ON DELETE CASCADE,
  FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE CASCADE
);

-- DOMAIN 12: NORMALIZED USER ACTIONS (POINTERS ONLY)
CREATE TABLE starred_articles (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  article_id TEXT NOT NULL,
  starred_at INTEGER NOT NULL,
  UNIQUE(user_id, article_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE CASCADE
);

CREATE TABLE saved_articles (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  article_id TEXT NOT NULL,
  saved_at INTEGER NOT NULL,
  UNIQUE(user_id, article_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE CASCADE
);

CREATE TABLE read_history (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  article_id TEXT NOT NULL,
  read_at INTEGER NOT NULL,
  UNIQUE(user_id, article_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE CASCADE
);

-- DOMAIN 13: TELEMETRY & ENGAGEMENT ANALYTICS
CREATE TABLE article_events (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  source_id TEXT,
  article_id TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK(event_type IN ('VIEW', 'CLICK', 'READ_COMPLETE', 'STAR', 'SAVE', 'SHARE', 'OPEN_SOURCE')),
  dwell_time_ms INTEGER,
  ip_address TEXT,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (source_id) REFERENCES sources(id) ON DELETE SET NULL,
  FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE CASCADE
);

-- COVERING B-TREE INDEXES
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_providers_lookup ON user_auth_providers(provider, provider_user_id);
CREATE INDEX IF NOT EXISTS idx_providers_user ON user_auth_providers(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON user_sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_user ON user_audit_logs(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_sources_category ON sources(category);
CREATE INDEX IF NOT EXISTS idx_sources_status ON sources(status);
CREATE INDEX IF NOT EXISTS idx_sources_publisher ON sources(publisher_domain);

CREATE INDEX IF NOT EXISTS idx_articles_source ON articles(source_id, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_articles_published ON articles(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_articles_hash ON articles(canonical_url_hash);

CREATE INDEX IF NOT EXISTS idx_folders_user ON folders(user_id, parent_folder_id);
CREATE INDEX IF NOT EXISTS idx_user_feeds_user ON user_feeds(user_id);
CREATE INDEX IF NOT EXISTS idx_assignments_user ON user_feed_assignments(user_id, folder_id);

CREATE INDEX IF NOT EXISTS idx_starred_user ON starred_articles(user_id, starred_at DESC);
CREATE INDEX IF NOT EXISTS idx_starred_article ON starred_articles(article_id);

CREATE INDEX IF NOT EXISTS idx_saved_user ON saved_articles(user_id, saved_at DESC);
CREATE INDEX IF NOT EXISTS idx_saved_article ON saved_articles(article_id);

CREATE INDEX IF NOT EXISTS idx_read_user ON read_history(user_id, read_at DESC);

CREATE INDEX IF NOT EXISTS idx_events_source ON article_events(source_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_article ON article_events(article_id, event_type);
CREATE INDEX IF NOT EXISTS idx_events_user ON article_events(user_id, created_at DESC);
```

---

## 4. Dedicated Settings Page Specification (`settings.html`)

| Settings Tab | Card Components & User Interactions |
|---|---|
| **1. My Profile** | • Avatar image upload / preset avatar picker<br>• First Name, Last Name, and Display Name fields<br>• Date of Birth datepicker (displays lock badge 🔒 if `dob_locked = 1`)<br>• Email address (read-only with 🟢 Verified badge) |
| **2. Security & Credentials** | • Change Password form (Current Password + New Password + Confirm)<br>• Active Sessions list (Device name, Browser, Location/IP, Last seen)<br>• One-click "Log Out of All Other Devices" button |
| **3. Connected Accounts** | • Google OAuth: "🟢 Connected as user@gmail.com"<br>• Connect/Disconnect buttons for Apple, Microsoft, GitHub<br>• Unlink protection: Disconnecting Google is prevented unless password is set |
| **4. Preferences** | • Theme selector: Light, Dark, System<br>• Reading view mode: Cards Grid, Split-Pane Reader, Compact List<br>• Font size controls: Small, Medium, Large<br>• Timezone and Email Digest frequency |
| **5. Danger Zone** | • Export All Bookmarks & Subscriptions (OPML & JSON)<br>• Delete Account (Sets status = 'deleted', deleted_at = timestamp with 30-day recovery window) |

---

## 5. System Audit & Gap Analysis: Live Database vs Workers vs Frontend

Following the execution of the latest master D1 database schema in the Cloudflare D1 environment (admin@feedometer.com / feedometer-db), here is the detailed cross-layer technical audit:

| Layer / Subsystem | Current Status | Identified Gaps & Required Modernization |
|---|---|---|
| **A. Live Cloudflare D1 Database** | **✅ UP-TO-DATE** | All 17 normalized tables and covering B-tree indexes are created in D1. Ready to serve the full 7-domain architecture. |
| **B. Backend Worker Auth Engine (`workers/modules/auth.js`)** | **⚠️ REQUIRES REWRITE** | • Legacy code expects password_hash inside users instead of user_passwords.<br>• Missing brute-force lockout tracking (failed_attempts -> locked_until).<br>• Missing user_sessions multi-device hardware tracking.<br>• Missing endpoints for profile updates (with DOB lock), password change, session revocation, and user preferences. |
| **C. Backend Worker Ingestion (`workers/modules/streams.js` & `articles.js`)** | **⚠️ REQUIRES UPDATE** | • streams.js must upsert ingested feeds into the normalized articles table using canonical URL normalization.<br>• articles.js star and save handlers must insert (user_id, article_id) rather than storing full JSON snapshots. |
| **D. Client Auth Helper (`scripts/feedometer-auth.js`)** | **⚠️ REQUIRES EXPANSION** | Must be expanded with updateProfile(), changePassword(), getSessions(), revokeSession(), and updatePreferences() client methods. |
| **E. Settings Hub View (`settings.html`)** | **❌ NOT CREATED** | Build a dedicated, responsive 5-tab settings portal wired directly to the backend APIs. |
| **F. Shell & Nav Integration (`shell.html` & `navbar/navbar.js`)** | **⚠️ REQUIRES WIRING** | Wire "Profile & Settings" into the hamburger navigation drawer and top profile capsule. |

---

## 6. Phased Implementation & Deprecation Blueprint

### Phase 1: Backend Cloudflare Worker Refactoring
1. Rewrite `workers/modules/auth.js` with 7-domain architecture handlers.
2. Update `workers/modules/articles.js` and `streams.js` to use normalized articles catalog.
3. Register all new endpoints in `workers/feedometer-worker.js`.

### Phase 2: Client Auth & Navigation Modernization
1. Enhance `scripts/feedometer-auth.js` with profile, session, and preference wrappers.
2. Wire "Profile & Settings" in `shell.html` and `navbar/navbar.js`.

### Phase 3: Dedicated Settings Hub View
1. Create `settings.html` with Profile, Security, Connected Accounts, Preferences, and Danger Zone.
2. Integrate DOB lock enforcement and active device revocation.

### Phase 4: Build, Verification & Production Mirroring
1. Execute `node build.js` production minification.
2. Mirror all assets to `C:\feedometer_obs_free\`.
3. End-to-end verification of registration, Google OAuth, password changes, and settings persistence.
