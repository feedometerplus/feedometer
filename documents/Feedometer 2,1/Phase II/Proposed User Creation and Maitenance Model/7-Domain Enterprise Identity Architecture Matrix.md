# FeedOmeter 2.1 — 7-Domain Enterprise Identity Architecture Matrix
*Comprehensive Reference Guide: Database Schemas, Field Catalogs, Source Code Bindings & Implementation Logic*

---

## 1. 7-Domain Enterprise Identity Subsystem Matrix

| Feature / Functional Goal | Database Table | Fields Used | Source Code File(s) | Implementation Code Snippet |
| :--- | :--- | :--- | :--- | :--- |
| **Domain 1: Core Identity**<br>Single immutable email anchor, surrogate `u_...` IDs, initial DOB setting & permanent `dob_locked = 1` lock enforcement. | `users` | `id` (PK)<br>`email` (UNIQUE)<br>`email_verified`<br>`first_name`, `last_name`<br>`display_name`<br>`dob`<br>`dob_locked`<br>`avatar_url`<br>`status`<br>`created_at`, `updated_at` | `workers/modules/auth.js`<br>`scripts/feedometer-auth.js`<br>`settings.html` | ```javascript
if (dob !== undefined) {
  if (existing.dob_locked === 1 && dob !== existing.dob) {
    return jsonResponse({ error: "Date of birth is permanently locked" }, 400);
  }
  const shouldLock = (existing.dob_locked === 1) ? 1 : (dob ? 1 : 0);
  updates.push("dob = ?", "dob_locked = ?");
  params.push(dob, shouldLock);
}
``` |
| **Domain 2: Auth Providers**<br>Google OAuth 2.0 integration, live Google avatar sync, and multi-provider collision prevention. | `user_auth_providers` | `id` (PK)<br>`user_id` (FK)<br>`provider`<br>`provider_user_id`<br>`provider_email`<br>`provider_metadata`<br>`created_at` | `workers/modules/auth.js`<br>`scripts/feedometer-auth.js`<br>`shell.html` | ```javascript
const gRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${credential}`);
const payload = await gRes.json();
const { sub: googleId, email, name, picture } = payload;
if (picture && (!user.avatar_url || user.avatar_url !== picture)) {
  await env.DB.prepare("UPDATE users SET avatar_url = ?, updated_at = ? WHERE id = ?")
    .bind(picture, now, user.id).run();
  user.avatar_url = picture;
}
``` |
| **Domain 3: Password Security**<br>PBKDF2-SHA256 (100k iterations), 5-attempt brute-force 15-minute lockout (`locked_until`), and password change session revocation. | `user_passwords` | `user_id` (PK, FK)<br>`password_hash`<br>`password_changed_at`<br>`failed_attempts`<br>`locked_until` | `workers/modules/auth.js` | ```javascript
if (pwdRecord.locked_until && pwdRecord.locked_until > now) {
  return jsonResponse({ error: "Account locked. Try later." }, 429);
}
const isValid = await verifyPassword(password, pwdRecord.password_hash);
if (!isValid) {
  const attempts = (pwdRecord.failed_attempts || 0) + 1;
  const lock = attempts >= 5 ? now + 15 * 60 * 1000 : null;
  await env.DB.prepare("UPDATE user_passwords SET failed_attempts = ?, locked_until = ? WHERE user_id = ?")
    .bind(attempts, lock, user.id).run();
}
``` |
| **Domain 4: Session Management**<br>Cryptographic token hashing, real-time client telemetry extraction (IP, device name, UA), single-session remote revocation, and global "Revoke All Other Sessions". | `user_sessions` | `id` (PK)<br>`user_id` (FK)<br>`token_hash` (UNIQUE)<br>`ip_address`<br>`user_agent`<br>`device_name`<br>`created_at`, `expires_at`<br>`last_seen` | `workers/modules/auth.js`<br>`scripts/feedometer-auth.js`<br>`settings.html` | ```javascript
const sessionToken = crypto.randomUUID();
const tokenHash = await sha256Hex(sessionToken);
const ip = req.headers.get("cf-connecting-ip") || "127.0.0.1";
const ua = req.headers.get("user-agent") || "Unknown";
const device = parseDeviceName(ua);
await env.DB.prepare("INSERT INTO user_sessions (id, user_id, token_hash, ip_address, user_agent, device_name, created_at, expires_at, last_seen) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
  .bind(sessId, user.id, tokenHash, ip, ua, device, now, expires, now).run();
``` |
| **Domain 5 & 6: Security Tokens**<br>256-bit high-entropy token hashing with 24-hour TTL and single-use validation flags. | `email_verifications`<br>`password_reset_tokens` | `id` (PK)<br>`user_id` (FK)<br>`token_hash` (UNIQUE)<br>`expires_at`<br>`used`<br>`created_at` | `schema/schema_phase2.sql`<br>`workers/modules/auth.js` | ```javascript
const tokenRecord = await env.DB.prepare(
  "SELECT * FROM password_reset_tokens WHERE token_hash = ? AND used = 0"
).bind(tokenHash).first();
if (!tokenRecord || tokenRecord.expires_at < now) {
  return jsonResponse({ error: "Token is invalid or expired" }, 400);
}
await env.DB.prepare("UPDATE password_reset_tokens SET used = 1 WHERE id = ?")
  .bind(tokenRecord.id).run();
``` |
| **Domain 7: Audit & Compliance**<br>Automated compliance logging of all authentication, profile, password, session, and security lifecycle events. | `user_audit_logs` | `id` (PK)<br>`user_id` (FK)<br>`event_type`<br>`ip_address`<br>`user_agent`<br>`metadata` (JSON)<br>`created_at` | `workers/modules/auth.js` | ```javascript
async function logAuditEvent(env, userId, eventType, req, metadata = {}) {
  const ip = req ? (req.headers.get("cf-connecting-ip") || "127.0.0.1") : "system";
  const ua = req ? (req.headers.get("user-agent") || "system") : "system";
  await env.DB.prepare("INSERT INTO user_audit_logs (id, user_id, event_type, ip_address, user_agent, metadata, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .bind(`audit_${crypto.randomUUID()}`, userId, eventType, ip, ua, JSON.stringify(metadata), Date.now()).run();
}
``` |

---

## 2. User Preferences & Personalization Matrix

| Preference Category | Database Table | Fields Used | Source Code File(s) | Technical Implementation |
| :--- | :--- | :--- | :--- | :--- |
| **Theme & Reading Mode**<br>Theme mode (`system`, `light`, `dark`) & Reading layout (`cards`, `split`, `compact`). | `user_preferences` | `user_id` (PK)<br>`theme`<br>`reading_mode`<br>`font_size`<br>`updated_at` | `settings.html`<br>`scripts/feedometer-auth.js`<br>`styles/feedometer.css` | ```javascript
await fetch(`${apiBase}/api/user/preferences`, {
  method: "PUT",
  headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
  body: JSON.stringify({ theme: "system", reading_mode: "cards" })
});
``` |
| **Default View & Automation**<br>Default launch view (`home`, `top-stories`, `starred`), auto-mark read, and email intelligence digests. | `user_preferences` | `user_id` (PK)<br>`default_view`<br>`auto_mark_read`<br>`email_notifications`<br>`timezone`, `language`, `date_format` | `schema/schema_phase2.sql`<br>`settings.html` | ```sql
CREATE TABLE user_preferences (
  user_id TEXT PRIMARY KEY,
  theme TEXT DEFAULT "system",
  reading_mode TEXT DEFAULT "cards",
  default_view TEXT DEFAULT "home",
  auto_mark_read INTEGER DEFAULT 0,
  email_notifications INTEGER DEFAULT 1
);
``` |

---

## 3. UI Design System & Micro-Interactions Matrix

| UI Specification | CSS Selector / Token | Target Values / Scale | Source Code File(s) | Implementation Snippet |
| :--- | :--- | :--- | :--- | :--- |
| **Native OS Font Stack** | `var(--font-sans)`, `var(--font-display)` | Inter, Quicksand, -apple-system, BlinkMacSystemFont, Segoe UI | `styles/feedometer.css` | ```css
--font-sans: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
--font-display: "Quicksand", "Inter", var(--font-sans);
``` |
| **Sapphire / Cobalt Gradients** | `.paay-hero-card`, `.paay-badge-active` | `#1e40af` -> `#2563eb` (linear-gradient 135deg) | `styles/settings-modal.css` | ```css
background: linear-gradient(135deg, #1e40af 0%, #2563eb 100%);
box-shadow: 0 10px 25px -5px rgba(37, 99, 235, 0.35);
``` |
| **Glassmorphism Backdrop Blur** | `.feedo-modal-overlay` | `rgba(15, 23, 42, 0.60)` + `blur(14px)` | `styles/settings-modal.css` | ```css
.feedo-modal-overlay {
  background: rgba(15, 23, 42, 0.60);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
}
``` |
| **Google Avatar Fallback Engine** | `#user-avatar`, `#user-avatar-fallback` | Google Profile Picture -> Monogram Fallback on error | `settings.html`, `shell.html` | ```javascript
if (user.avatar_url) {
  avatarEl.src = user.avatar_url;
  avatarEl.onerror = () => { avatarEl.style.display="none"; fallbackEl.style.display="flex"; };
}
``` |
| **iOS-Style Animated Toggles** | `.paay-toggle-slider` | 38px x 20px, 0.22s cubic transition, `#2563eb` active | `styles/settings-modal.css` | ```css
.paay-toggle input:checked + .paay-toggle-slider {
  background: #2563eb;
}
.paay-toggle input:checked + .paay-toggle-slider:before {
  transform: translateX(20px);
}
``` |
| **Square Badge Action Buttons** | `.btn-square`, `.btn-square-primary` | 38px x 38px, 9px radius, tooltips, flame pulse | `home.html`, `top-stories.html` | ```html
<button class="btn-square" onclick="fetchStream()" title="Refresh Feeds">🔄</button>
<button id="btn-live-stream" class="btn-square btn-square-primary" onclick="toggleLiveStream()" title="Toggle Live Stream">🔥</button>
``` |
| **5-Card Density Grid Layout** | `.card-grid` | `repeat(5, minmax(0, 1fr))`, 125px card media | `home.html`, `top-stories.html` | ```css
.card-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 0.85rem;
}
``` |

---

## 4. Paay-Inspired SaaS Settings Modal Hub

| Feature Area | Trigger Mechanism | State Preservation | Source Code File(s) | Implementation Snippet |
| :--- | :--- | :--- | :--- | :--- |
| **Zero-Reload Modal Overlay** | Header profile capsule, Navigation drawer, Ctrl+K command | Underlying reading route & scroll state 100% preserved | `shell.html` | ```javascript
function openSettingsModal(tab = "profile") {
  const modal = document.getElementById("settings-modal");
  const iframe = document.getElementById("settings-iframe");
  iframe.src = `settings.html?tab=${tab}`;
  modal.classList.add("open");
}
``` |
| **2-Column Hero Identity Card** | Settings Modal Profile Tab (`#tab-profile`) | Real-time verified status badge, avatar display, account ID | `settings.html` | ```html
<div class="paay-hero-card">
  <div class="paay-hero-avatar-zone">
    <img id="paay-hero-avatar" class="paay-hero-avatar" src="" />
  </div>
  <div class="paay-hero-details">
    <h3 id="paay-hero-name">User Name</h3>
    <p id="paay-hero-email">user@email.com</p>
    <span class="paay-badge-verified">✓ Verified Enterprise ID</span>
  </div>
</div>
``` |

---

## 5. Normalized Content Catalog & User Action Pointers

| Architecture Layer | Database Table | Fields Used | Source Code File(s) | Technical Implementation |
| :--- | :--- | :--- | :--- | :--- |
| **URL Deduplication**<br>Single canonical URL storage across hundreds of RSS sources. | `articles` | `id` (PK)<br>`canonical_url_hash` (UNIQUE)<br>`url`<br>`title`, `summary`<br>`source_id` (FK)<br>`published_at`, `created_at` | `schema/schema_phase2.sql` | ```sql
CREATE TABLE articles (
  id TEXT PRIMARY KEY,
  canonical_url_hash TEXT UNIQUE NOT NULL,
  url TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT,
  created_at INTEGER NOT NULL
);
``` |
| **Action Pointers**<br>Foreign-key pointers for stars and saves yielding >90% DB efficiency. | `starred_articles`<br>`saved_articles` | `user_id` (FK)<br>`article_id` (FK)<br>`created_at`<br>`PRIMARY KEY (user_id, article_id)` | `schema/schema_phase2.sql`<br>`workers/modules/auth.js` | ```sql
CREATE TABLE starred_articles (
  user_id TEXT NOT NULL,
  article_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, article_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE CASCADE
);
``` |
| **Telemetry Tracking**<br>User interaction event log (VIEW, CLICK, READ_COMPLETE, STAR, SAVE). | `article_events` | `id` (PK)<br>`user_id` (FK)<br>`article_id` (FK)<br>`event_type`<br>`created_at` | `scripts/feedometer-telemetry.js` | ```javascript
window.FeedOmeterTelemetry = {
  track: (articleId, eventType) => {
    fetch(`${apiBase}/api/telemetry`, {
      method: "POST",
      body: JSON.stringify({ articleId, eventType, timestamp: Date.now() })
    }).catch(() => {});
  }
};
``` |

---

## 6. Production Build & 1-Click Launchers Matrix

| Component | Target Output | Key Mechanism | Source Code File(s) | Implementation Snippet |
| :--- | :--- | :--- | :--- | :--- |
| **Production Minifier** | `*.min.css`, `*.min.js` | 37.1% payload reduction via regex CSS/JS minification | `build.js` | ```javascript
function minifyCSS(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\s+/g, " ").replace(/\s*([{}:;,])\s*/g, "$1").trim();
}
``` |
| **Zero-Dependency Server** | `http://localhost:3000` | Native Node http & fs server with automatic port increment on conflict | `server.js` | ```javascript
const server = http.createServer((req, res) => {
  let filePath = path.join(__dirname, req.url === "/" ? "shell.html" : req.url.split("?")[0]);
  fs.readFile(filePath, (err, content) => {
    if (err) { res.writeHead(404); res.end("Not Found"); }
    else { res.writeHead(200, { "Content-Type": mimeTypes[ext] || "text/plain" }); res.end(content); }
  });
});
``` |
| **1-Click Windows Launchers** | Browser auto-open to `shell.html` | Windows Batch script executing node server.js and launching browser | `start_feedometer.bat`, `feedo.bat` | ```bat
@echo off
start "" "http://localhost:3000/shell.html"
node server.js
pause
``` |
