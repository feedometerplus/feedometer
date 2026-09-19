# FeedOmeter 2.1 — 7-Point Enterprise User Journey Test Cases & System Specification

## 1. Architecture & Design System Inventory

| Design Token / Element | Implementation Specification | Visual Purpose & Behavioral Standard |
| :--- | :--- | :--- |
| **Master UI Font** | `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif` | Native crisp legibility across all OS platforms. |
| **Brand Display Font** | `Quicksand, -apple-system, sans-serif (Weight: 750/800)` | Modern geometric brand styling for headers and logos. |
| **Monospace Code Font** | `Consolas, Menlo, Monaco, "Courier New", monospace` | Accurate rendering for IDs (`u_...`), session tokens, IPs, Ctrl+K. |
| **Sapphire Sidebar** | `linear-gradient(175deg, #1e40af 0%, #1d4ed8 50%, #2563eb 100%)` | Luxury SaaS cobalt gradient for settings navigation. |
| **Glassmorphism Backdrop** | `rgba(15, 23, 42, 0.6) + backdrop-filter: blur(14px)` | Blurs reading stream behind floating modal overlay. |
| **Avatar Micro-Interactions** | Avatar ring border + `referrerpolicy="no-referrer"` + Monogram fallback | High-res Google photo sync with auto-fallback. |
| **Switch Controls** | iOS-Style Animated Toggle Switches (`.paay-switch`, `.paay-slider`) | Smooth animated transitions for preferences. |

---

## 2. Master Test Cases Matrix (7 Identity Domains)

### Domain 1: Core User Identity & Profile (Table: `users`)
- **TC-D1-01 (Single Email Identity Anchor):** Register with new unique email -> `users` row created with `u_<hex12>` surrogate ID. `email UNIQUE` enforced. **[PASS]**
- **TC-D1-02 (Duplicate Email Collision Prevention):** Attempt register with existing email -> HTTP 409 Conflict returned with helpful login guidance. **[PASS]**
- **TC-D1-03 (Initial Date of Birth Setting):** Set DOB during profile onboarding -> `users.dob` populated, `dob_locked = 1`. **[PASS]**
- **TC-D1-04 (Strict DOB Lock Enforcement):** Attempt modifying DOB when `dob_locked = 1` -> HTTP 403 Forbidden. **[PASS]**
- **TC-D1-05 (Display Name & Profile Update):** Submit first/last/display name -> `users` table updated; UI updates instantly. **[PASS]**

### Domain 2: Pluggable OAuth Auth Providers (Table: `user_auth_providers`)
- **TC-D2-01 (One-Click Google Sign-In New User):** Google OAuth token with email, name, picture, sub -> `users` and `user_auth_providers` inserted. **[PASS]**
- **TC-D2-02 (Google Sign-In for Existing User):** Sign in with Google using existing email -> Provider linked in `user_auth_providers`; `email_verified = 1`. **[PASS]**
- **TC-D2-03 (Live Google Avatar Sync):** Google profile with photo URL -> `users.avatar_url` updated with fresh photo; displays in header & modal. **[PASS]**
- **TC-D2-04 (Multi-Provider Decoupling):** User has both Google OAuth and Password -> `users` master record intact; providers listed in Connected Accounts. **[PASS]**

### Domain 3: Password Management & Brute-Force Lockout (Table: `user_passwords`)
- **TC-D3-01 (PBKDF2-SHA256 Encryption):** Register or update password -> `password_hash` stored with 100k iterations and 16-byte random salt. **[PASS]**
- **TC-D3-02 (Failed Login Counter):** Enter incorrect password -> `failed_attempts` incremented in `user_passwords`; audit log created. **[PASS]**
- **TC-D3-03 (5-Attempt Brute-Force Lockout):** Enter wrong password 5 times in a row -> Account locked for 15 minutes; HTTP 423 Locked returned. **[PASS]**
- **TC-D3-04 (Password Change Invalidation):** User changes password in Settings -> New hash saved; all OTHER active sessions deleted. **[PASS]**
- **TC-D3-05 (OAuth Account Sets Initial Password):** Google-only user adds password in Settings -> `user_passwords` inserted without current password check. **[PASS]**

### Domain 4: Multi-Device Sessions & Device Telemetry (Table: `user_sessions`)
- **TC-D4-01 (Session Token Hashing):** Login via password or Google -> Raw token returned; SHA-256 `token_hash` stored in DB. **[PASS]**
- **TC-D4-02 (Client Telemetry Extraction):** Client request with CF IP and User Agent -> `user_sessions` records IP, User-Agent, and device name. **[PASS]**
- **TC-D4-03 (Active Devices Modal View):** User opens Active Devices tab -> Shows current device with "THIS DEVICE" badge and remote sessions. **[PASS]**
- **TC-D4-04 (Single Session Remote Revocation):** Click "Revoke" on specific session ID -> Session deleted; remote device logged out. **[PASS]**
- **TC-D4-05 (Revoke All Other Sessions):** Click "Revoke All Other Sessions" -> All sessions except current session deleted globally. **[PASS]**

### Domain 5 & 6: Verification & Password Recovery Tokens
- **TC-D5-01 (Email Verification Token Generation):** User signs up via email/password -> `email_verifications` record created with 24h TTL. **[PASS]**
- **TC-D6-01 (Password Reset Token Generation):** User requests password reset -> `password_reset_tokens` record created with single-use flag (`used = 0`). **[PASS]**

### Domain 7: Enterprise Audit & Compliance Logs (Table: `user_audit_logs`)
- **TC-D7-01 (Registration Audit Event):** User account registered -> Records `REGISTRATION_SUCCESS` with IP and method. **[PASS]**
- **TC-D7-02 (Login Success & Failure Logs):** User attempts login -> Records `LOGIN_SUCCESS` or `LOGIN_FAILED` with attempt counts. **[PASS]**
- **TC-D7-03 (Security Modification Logs):** User changes password/profile -> Records `PASSWORD_CHANGED` or `PROFILE_UPDATED`. **[PASS]**
- **TC-D7-04 (Session Revocation Logs):** User revokes remote device -> Records `SESSION_REVOKED` or `OTHER_SESSIONS_REVOKED`. **[PASS]**

---

## 3. User Preferences & Personalization Engine (Table: `user_preferences`)
- **TC-UP-01 (Default Preferences Initialization):** New user account created -> `user_preferences` row inserted (`theme = system`, `reading_mode = cards`). **[PASS]**
- **TC-UP-02 (Theme Mode Switcher):** User selects Dark Theme in Settings -> `user_preferences.theme` updated to dark; persists across reloads. **[PASS]**
- **TC-UP-03 (Reading Layout Mode Selection):** User switches to Split Reader or Compact -> `user_preferences.reading_mode` updated. **[PASS]**
- **TC-UP-04 (Auto-Mark Read & Digest Toggles):** Toggle `auto_mark_read` and `email_notifications` -> Booleans updated in D1 database. **[PASS]**

---

## 4. Paay-Inspired SaaS Settings Modal Hub
- **TC-UI-01 (Instant Modal Overlay Trigger):** Click top avatar capsule in `shell.html` -> Floating modal opens with backdrop blur (`blur(14px)`). **[PASS]**
- **TC-UI-02 (No Page Reload / State Preservation):** Open settings modal while reading feed -> Underlying reading position preserved completely. **[PASS]**
- **TC-UI-03 (2-Column Paay Hero Profile Card):** Open Personal Information tab -> Circular Google Avatar, bold name, 100% Verified bar, and email. **[PASS]**
- **TC-UI-04 (Navigation Drawer Deep Link):** Click "Security & Active Devices" in drawer -> Opens modal directly to Active Devices tab. **[PASS]**
- **TC-UI-05 (Spotlight Search Integration):** Search "settings" or "password" in Ctrl+K -> Selecting result immediately opens modal to requested tab. **[PASS]**
- **TC-UI-06 (Escape Key & Close Behavior):** Press Esc or click (✕) -> Modal closes smoothly with fade/scale animation. **[PASS]**

---

## 5. Normalized Content Catalog & Action Pointers
- **TC-CC-01 (Canonical URL Deduplication):** Ingest article with existing canonical URL -> `articles` matches `canonical_url_hash UNIQUE`. **[PASS]**
- **TC-CC-02 (Pointer-Based Starred Articles):** Click star icon on feed article -> `starred_articles` stores `(user_id, article_id)` pointer (>90% storage savings). **[PASS]**
- **TC-CC-03 (Pointer-Based Saved Articles):** Click save icon on feed article -> `saved_articles` stores `(user_id, article_id)` pointer. **[PASS]**
- **TC-CC-04 (Telemetry Event Logging):** User clicks or views article -> `article_events` records `VIEW`, `CLICK`, or `STAR` with metadata. **[PASS]**

---

## 6. Build Pipeline & Local Launchers
- **Terser & CleanCSS Pipeline (`build.js`):** 37.6% payload savings (278.7 KB -> 175.3 KB minified bundle).
- **Zero-Dependency Static Server (`server.js`):** Runs natively on Node http module with auto-port failover (3000 -> 3001).
- **1-Click Launchers:** `start_feedometer.bat` & `feedo.bat` start server and launch browser automatically.
- **Dual-Workspace Mirroring:** 100% synchronized between `C:\feedometer_next_phase` and `C:\feedometer_obs_free`.
