# FEEDOMETER 2.1 — ARCHITECTURAL SPECIFICATION
## Enterprise Identity Architecture, User Creation Algorithms, Decoupled Provider Linking, and Profile Maintenance Model

**Document Title:** User Creation Algorithm & Profile Maintenance Architecture  
**Target System:** FeedOmeter 2.1 Cloudflare D1 Backend & Personal Web Shell  
**Classification:** Enterprise Identity & Access Management (IAM) Model  
**Architectural Rating:** Production-Grade (Tier-1 Enterprise Specification)  
**Date:** September 18, 2026  
**Status:** Approved Blueprint for Implementation  

---

## 1. Executive Summary & Core Identity Philosophy

Modern SaaS applications frequently suffer from **Identity Fragmentation**—a critical design defect where different authentication methods (e.g., Google OAuth vs. Email/Password registration) are incorrectly treated as distinct user accounts. This leads to duplicate profile creation, orphaned bookmarks/settings, account hijacking vulnerabilities, and severe user confusion.

The FeedOmeter 2.1 Identity Architecture establishes a fundamental separation between **User Identity** (who the human is) and **Authentication Credentials** (how the user proves their identity).

```
CORE IDENTITY ANCHOR:
  User Entity (Immutable Primary Key: id = u_xxxx)
  └── Verified Identity Anchor (email = user@example.com [UNIQUE])
       ├── Auth Credential #1: Google OAuth (provider_user_id = sub)
       ├── Auth Credential #2: Password (Argon2id/PBKDF2-SHA256 Hash)
       ├── Auth Credential #3: Future Providers (Apple, Microsoft, GitHub, SAML)
       └── Associated Data: Profile, DOB (Locked), Starred Feeds, Sessions, Audit Log
```

---

## 2. Comprehensive Strengths, Gaps & Architectural Resolutions

| Area / Component | Identified Failure Mode / Gap | Enterprise Resolution |
|---|---|---|
| **1. Primary Key Design** | Using email as the DB Primary Key breaks foreign keys when users update their email or use enterprise SSO. | Retain immutable surrogate key (`id TEXT PRIMARY KEY` e.g. `u_xxx`). Use `email TEXT UNIQUE NOT NULL` as the identity lookup anchor. |
| **2. Provider Extensibility** | A single `auth_provider` column (`'google'`, `'email'`, `'both'`) cannot scale to Microsoft, Apple, GitHub, or OIDC. | Create normalized `user_auth_providers` table storing individual linked provider credentials and remote `provider_user_id`. |
| **3. Account Hijacking Prevention** | Auto-linking Google accounts without verifying `email_verified` or checking provider ID collisions allows OAuth pre-hijacking. | Verify Google ID token claims server-side (`email_verified: true`) and enforce `UNIQUE(provider, provider_user_id)` constraint. |
| **4. Sensitive Profile Fields** | Unrestricted editing of Date of Birth (DOB) undermines KYC, age verification, and compliance integrity. | Implement `dob_locked` flag: DOB can be set once during onboarding/profile setup, then permanently locked against client updates. |
| **5. Password Reauthentication** | Allowing password changes solely with a 30-day session token allows stolen bearer tokens to permanently hijack an account. | Require `current_password` verification for password accounts, or fresh OAuth token verification for social accounts before changing/setting passwords. |
| **6. Email Verification Status** | Treating unverified email registrations as equal to OAuth-verified emails allows spoofed account creations. | Track `email_verified` flag (1 for Google, 0 for new email signups pending verification token confirmation). |
| **7. Multi-Device Sessions & Audit** | Lack of session device telemetry or audit logging leaves the system blind to credential compromise and unauthorized access. | Store `user_agent` and `ip_address` in `sessions` table with a "Revoke Other Sessions" endpoint, and log all sensitive actions to `user_audit_log`. |

---

## 3. Complete Production D1 Relational Schema

```sql
-- ==============================================================================
-- FEEDOMETER 2.1 — PRODUCTION IDENTITY & AUTHENTICATION ENGINE (D1 / SQLITE)
-- ==============================================================================

-- 1. Core Users Table
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,                       -- Immutable internal ID (e.g. 'u_9a8f7c12d34e')
  email TEXT UNIQUE NOT NULL,                -- Verified unique identity identifier
  email_verified INTEGER DEFAULT 0,          -- 1 for Google/verified, 0 for unverified email
  first_name TEXT,                           -- User first name
  last_name TEXT,                            -- User last name
  dob TEXT,                                  -- Date of Birth (YYYY-MM-DD)
  dob_locked INTEGER DEFAULT 0,              -- 1 = locked after first entry
  picture TEXT,                              -- Profile / Avatar image URL
  password_hash TEXT,                        -- PBKDF2/SHA-256 or Argon2id (NULL if OAuth-only)
  created_at INTEGER NOT NULL,               -- Unix epoch timestamp ms
  last_login INTEGER,                        -- Unix epoch timestamp ms
  status TEXT DEFAULT 'active'               -- 'active', 'suspended', 'deleted'
);

-- 2. Pluggable Auth Providers Table
CREATE TABLE IF NOT EXISTS user_auth_providers (
  id TEXT PRIMARY KEY,                       -- 'prov_xxxxxxxxxxxx'
  user_id TEXT NOT NULL,                     -- References users(id)
  provider TEXT NOT NULL,                    -- 'google', 'apple', 'github', 'microsoft'
  provider_user_id TEXT NOT NULL,            -- Remote subject ID (e.g. Google sub)
  provider_email TEXT,                       -- Email provided by OAuth profile
  provider_metadata TEXT,                    -- JSON payload with raw OAuth profile attributes
  linked_at INTEGER NOT NULL,                -- Unix epoch timestamp ms
  UNIQUE(provider, provider_user_id),        -- Prevents 1 OAuth account linking to multiple users
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 3. Multi-Device Sessions Table
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,                       -- 'sess_xxxxxxxxxxxx'
  user_id TEXT NOT NULL,                     -- References users(id)
  token_hash TEXT UNIQUE NOT NULL,           -- SHA-256 hex of bearer token
  user_agent TEXT,                           -- Browser & OS user agent
  ip_address TEXT,                           -- Client IP address
  expires_at INTEGER NOT NULL,               -- Session expiration timestamp ms (30 days)
  created_at INTEGER NOT NULL,               -- Creation timestamp ms
  last_active_at INTEGER NOT NULL,           -- Last activity timestamp ms
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 4. Verification & Password Reset Tokens Table
CREATE TABLE IF NOT EXISTS auth_tokens (
  id TEXT PRIMARY KEY,                       -- 'tok_xxxxxxxxxxxx'
  user_id TEXT NOT NULL,                     -- References users(id)
  token_type TEXT NOT NULL,                  -- 'password_reset', 'email_verify'
  token_hash TEXT UNIQUE NOT NULL,           -- SHA-256 hash of random token
  expires_at INTEGER NOT NULL,               -- Token TTL (e.g. 1 hour)
  used_at INTEGER,                           -- Timestamp when redeemed (NULL if unredeemed)
  created_at INTEGER NOT NULL,               -- Issuance timestamp ms
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 5. Security Audit Log Table
CREATE TABLE IF NOT EXISTS user_audit_log (
  id TEXT PRIMARY KEY,                       -- 'aud_xxxxxxxxxxxx'
  user_id TEXT NOT NULL,                     -- References users(id)
  event_type TEXT NOT NULL,                  -- 'LOGIN_SUCCESS', 'PASSWORD_CHANGED', 'PROVIDER_LINKED'
  ip_address TEXT,                           -- IP address of request
  user_agent TEXT,                           -- User agent
  details TEXT,                              -- JSON string with event context
  created_at INTEGER NOT NULL,               -- Event timestamp ms
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 6. High-Performance B-Tree Indexes
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_providers_lookup ON user_auth_providers(provider, provider_user_id);
CREATE INDEX IF NOT EXISTS idx_providers_user ON user_auth_providers(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_audit_user ON user_audit_log(user_id, created_at DESC);
```

---

## 4. End-to-End User Creation & Maintenance Algorithms

### Algorithm 1: Google OAuth Sign-In & Automatic Provider Linking
**Input:** OAuth profile payload containing `email`, `name`, `picture`, and unique subject ID `sub`.
**Execution Logic on Server (Cloudflare Worker):**
1. Validate incoming OAuth payload format and extract `email` and `sub`.
2. Query `user_auth_providers` for `(provider = 'google' AND provider_user_id = sub)`:
   - **Case A (Existing Google Connection):** Retrieve linked `user_id` from `user_auth_providers`.
   - **Case B (No Provider Connection Found):**
     - Query `users` table by `email` (case-insensitive).
     - If User Exists: Link Google to existing user account by inserting into `user_auth_providers`. Mark `email_verified = 1` if not already set.
     - If User Does Not Exist: Generate unique user ID (`u_xxxx`), insert new record into `users` (`email`, `first_name`, `last_name`, `picture`, `email_verified = 1`, `password_hash = NULL`). Then insert into `user_auth_providers`.
3. Generate a cryptographically secure 256-bit bearer token (`rawToken`) and calculate its SHA-256 hash (`tokenHash`).
4. Insert new session record into `sessions` table with a 30-day TTL (`expires_at = now + 30 days`), recording client `user_agent` and `ip_address`.
5. Record `LOGIN_SUCCESS` or `PROVIDER_LINKED` event in `user_audit_log`.
6. Return HTTP 200/201 with bearer token and sanitized user profile object.

---

### Algorithm 2: Email & Password Registration (Collision Protection)
**Input:** `email`, `password`, optional `first_name` and `last_name`.
**Execution Logic on Server:**
1. Sanitize `email` to lowercase; enforce format regex (minimum 1 "@" and 1 "."). Enforce minimum password length (8+ characters).
2. Query `users` table `WHERE email = ?`:
   - **If User Exists with Linked Google Provider (`password_hash IS NULL`):**  
     $ightarrow$ Return HTTP 409 Conflict: *"An account with this email already exists via Google Sign-In. Please sign in with Google or set a password in your account Settings."*
   - **If User Exists with Existing Password:**  
     $ightarrow$ Return HTTP 409 Conflict: *"An account with this email already exists. Please log in."*
3. Hash password using PBKDF2 with 100,000 iterations or Argon2id with unique salt.
4. Insert new record into `users` (`id`, `email`, `password_hash`, `first_name`, `last_name`, `email_verified = 0`, `created_at`, `status = 'active'`).
5. Issue 30-day bearer session token and log `REGISTRATION_SUCCESS` in `user_audit_log`.
6. Dispatch verification email nonce into `auth_tokens` table.

---

### Algorithm 3: Email & Password Login Verification
**Input:** `email`, `password`.
**Execution Logic on Server:**
1. Query `users` table for matching `email` and `status = 'active'`.
2. If user not found: Return HTTP 401 Unauthorized (*"Invalid email or password"*).
3. If user exists but `password_hash` is NULL (Google-only user):  
   $ightarrow$ Return HTTP 400 Bad Request: *"This account is registered via Google Sign-In. Please sign in with Google or use password recovery."*
4. Verify password hash using constant-time cryptographic comparison.
5. If valid: Update `last_login`, create session in `sessions`, log `LOGIN_SUCCESS` in `user_audit_log`, return bearer token.
6. If invalid: Log `LOGIN_FAILED` in `user_audit_log` with client IP. Return HTTP 401.

---

### Algorithm 4: Reauthenticated Password Setting & Updating
**Endpoint:** `POST /api/auth/password` (Authenticated with Bearer Token)  
**Execution Logic on Server:**
1. Authenticate calling session token against `sessions` and `users`.
2. Check current user credential status:
   - **Existing Password User:** Require `current_password` in request payload. Verify `current_password` against stored `password_hash`. If mismatch, return HTTP 403 Forbidden.
   - **Social-Only User (`password_hash IS NULL`):** Validate calling active session or require recent OAuth re-verification before accepting the initial `new_password`.
3. Hash `new_password` and execute: `UPDATE users SET password_hash = ? WHERE id = ?`.
4. Revoke all **OTHER** active sessions for this user (`DELETE FROM sessions WHERE user_id = ? AND id != current_session_id`) to eliminate compromised legacy sessions.
5. Record `PASSWORD_CHANGED` event in `user_audit_log`.
6. Return HTTP 200 Success.

---

### Algorithm 5: Profile Maintenance & Strict DOB Lock Rule
**Endpoint:** `POST /api/auth/profile` (Authenticated with Bearer Token)  
**Execution Logic on Server:**
1. Authenticate user session. Extract `first_name`, `last_name`, `dob`, `picture` from payload.
2. Date of Birth (DOB) Validation:
   - If `user.dob_locked = 1` and `payload.dob != user.dob`:  
     $ightarrow$ Reject DOB change with HTTP 403 Forbidden: *"Date of Birth has already been verified and locked. Please contact support for assistance."*
   - If `user.dob_locked = 0` and `payload.dob` is provided:  
     $ightarrow$ Validate ISO format (`YYYY-MM-DD`), check that age $ge 13$, and set `dob = payload.dob`, `dob_locked = 1`.
3. Update `first_name`, `last_name`, `picture` in `users` table.
4. Record `PROFILE_UPDATED` in `user_audit_log`.
5. Return updated profile object to client.

---

## 5. Dedicated Settings Page UX & Component Architecture

| Settings Component | Features & Security Behaviors |
|---|---|
| **1. Personal Profile Card** | • Avatar preview with live upload/URL picker<br>• First Name & Last Name inputs<br>• Date of Birth datepicker (displays lock badge 🔒 if `dob_locked = 1`)<br>• Email display (read-only with 🟢 Verified badge) |
| **2. Security & Credentials Card** | • Adaptive Password Form:<br>  - For Google-only users: *"Set a password to enable email/password sign-in"*<br>  - For Password users: Requires Current Password + New Password + Confirm<br>• Client-side password strength meter with server-side validation |
| **3. Connected Accounts Card** | • Google OAuth: *"🟢 Connected as user@gmail.com"*<br>• Unlink protection: Unlinking Google is disabled unless an active password has been set<br>• Ready placeholders for Apple, GitHub, and Microsoft sign-in |
| **4. Device & Session Hub** | • Lists all active sessions with device name, browser, IP, and last active time<br>• Highlights "Current Device"<br>• One-click "Log Out of All Other Devices" button (calls `DELETE /api/auth/sessions/other`) |

---

## 6. Implementation & Deployment Roadmap

- **Phase 1: Database Migration (Cloudflare D1)**
  - [ ] Execute clean drop & recreate on `users`, `sessions`, `user_auth_providers`, `auth_tokens`, and `user_audit_log` in `schema/schema_phase2.sql`.
- **Phase 2: Backend Cloudflare Worker Refactoring**
  - [ ] Implement normalized provider lookup and automatic linking in `workers/modules/auth.js`.
  - [ ] Add endpoints: `POST /api/auth/profile`, `POST /api/auth/password`, `GET /api/auth/sessions`, and `DELETE /api/auth/sessions/other`.
  - [ ] Enforce DOB lock rule and password reauthentication.
- **Phase 3: Settings View & Client Auth Integration**
  - [ ] Create `settings.html` with Profile, Security, Connected Accounts, and Session cards.
  - [ ] Link "Profile & Settings" in `shell.html` navigation drawer and top profile capsule.
  - [ ] Run production build (`node build.js`) and mirror to `C:\feedometer_obs_free\`.
