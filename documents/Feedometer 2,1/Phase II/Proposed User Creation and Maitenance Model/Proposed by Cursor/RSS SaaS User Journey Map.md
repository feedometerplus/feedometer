# FeedOmeter — RSS SaaS User Journey Map

**Document:** Complete user journey for a Feedly / Inoreader class RSS application  
**Author:** Cursor (product working session with Ravi)  
**Date:** 18 September 2026  
**Status:** Working product specification  
**Scope:** What a user does from first open through daily use, identity, paid plans, and exit  

---

## 1. Product rule

FeedOmeter is two journeys, not one:

| Actor | Access | Surfaces |
|---|---|---|
| **Guest** | Login-free | Public RSS Reader only (`index.html` / `viewer.html`) |
| **Owner (logged-in user)** | Account required | Home, streams, folders, star, read later, sources, settings, builder save |
| **Plan (future)** | Entitlement on top of Owner | Caps, refresh speed, alerts, AI, team seats |

Public = Reader. Authenticated = Owner. Plans attach later to Owner features, not to first open.

The product job is not “show RSS XML.” It is: **sample without friction, convert when they want to keep something, then become the place they open every morning instead of ten publisher sites.**

---

## 2. End-to-end sequence (14 stages)

| Stage | Actor | Job to be done | What they actually do | FeedOmeter now |
|---|---|---|---|---|
| **0 Arrive** | Guest | Google / shared URL / word of mouth | Land on public RSS Reader. Paste a feed URL. Read 3–10 cards. Leave or stay. | Today: `index.html` |
| **1 Sample** | Guest | Curiosity: does this beat Feedly for my blog? | Open a story, switch list/grid, refresh. No account. No personal data written. | Today: viewer only should stay free |
| **2 Hit a wall** | Guest → prompt | Want to keep this, follow it, or come back tomorrow | Star, Read later, Follow, Folder, or Open my briefing. Auth modal. | Today: mixed; should be the conversion gate |
| **3 Become a user** | Account | Google 1-click or email + password | Create `u_` identity, session, empty library, default preferences. | Today: register / login / Google |
| **4 First library** | Owner | Make the app mine in under 5 minutes | Pick 3 starter topics or search catalog. Follow 8–15 sources. Optional: paste blog URL / OPML. | Partial: find-sources; add-source stub |
| **5 Organize** | Owner | Too many feeds in one pile | Create folders (Work, AI, Markets). Assign sources. Open a folder stream. | Partial: folders API; watchlists UI weak |
| **6 Daily loop** | Habit | Morning scan in 8 minutes | Open Home / Top stories / Split reader. Skim. Open. Mark read. Star few. Save two for commute. | Partial: home + stream; unread counts thin |
| **7 Library** | Habit | I will need this later | Starred vault, Read later queue, history. Export a list. Unstar junk. | Today: star/save APIs + pages |
| **8 Discover more** | Growth | I outgrew the first 10 feeds | Catalog search, website-to-RSS, newsletter resolve, related sources, health of a feed. | Partial; builder still public |
| **9 Search & filters** | Power | Find that article from Tuesday | Boolean search across *my* feeds. Save as a smart feed. Mute keywords. | Later: Ctrl+K exists locally, not my-library search |
| **10 Identity & devices** | Trust | Phone + laptop, same brain | Profile, DOB lock, password, Google link, revoke stolen laptop, theme. | Today: settings hub |
| **11 Plan** | Revenue | Hit a limit or want alerts / AI | See Free vs Pro. Upgrade. Limits apply to folders, refresh rate, AI, team. | Not built |
| **12 Automate** | Power / paid | Do not miss a keyword | Rules, email/push digest, Slack, AI summary, shareable collection. | Later (phases 5–7) |
| **13 Keep or leave** | Lifecycle | Too noisy / switching tools | Mute, unfollow dead feeds, export OPML, pause, delete account for real. | Delete is fake today |

---

## 3. Stage-by-stage narrative

### Stages 0–1 — Public reader (no account)

The user googles “rss reader” or pastes a feed from a blog. They land on the **Reader**, not the app shell. They paste a URL (or tap a popular outlet), see cards, open one story, maybe copy XML. They do not follow, star, folder, or get a personalized home.

- **Success:** they understand the product in 30 seconds.
- **Failure:** we force signup before they have tasted a feed. That kills SEO and trial.

### Stage 2 — The wall (conversion)

They try to keep an article, follow a source, or open “my briefing.” That is the only honest time to ask for Google or email.

The line is: **“This is yours. It needs an account.”**

Conversion triggers:

- Star
- Read later
- Follow
- Create folder
- Open my Home / watchlists
- Save a built feed from the Builder

### Stages 3–5 — Become an owner

1. Create identity (Google or email).
2. Land in a first-run, not an empty desert: pick News / Tech / Markets / Science pills, follow a curated catalog, optionally paste a site URL or import OPML from Feedly/Inoreader.
3. Make 2–4 folders so the stream is scannable.

**Activation metric:** followed at least 5 sources and opened Home once within 24 hours. Registration alone is not activation.

### Stages 6–8 — The daily product

Morning: Home briefing (top of their sources). Live stream for “what just dropped.” Split reader for deep work.

Actions: open, mark read, star, save, unfollow noisy source, check feed health. Discovery when they feel gaps: catalog, add RSS, web-to-feed.

This loop is ~90% of lifetime value. Identity settings are rare. Plans should tax extras (speed, AI, alerts, seats), not the act of reading their own follows.

### Stages 9–10 — Power and trust

Search my library, saved queries, devices, password, Google link, revoke a phone, theme, default start page. Multi-device: same stars and folders on laptop and phone.

This is why login exists — not to wall off HTML pages.

### Stages 11–13 — Plans, automation, leave

- **Free Owner:** follow N sources, folders, star/save, daily read.
- **Pro:** more sources, faster refresh, keyword alerts, AI briefs, OPML/team.

They upgrade when a limit or a “don’t miss this” job appears — not at signup.

Exit path must be real: export OPML, download starred, delete account and all D1 rows. RSS power users will not stay if they feel trapped.

---

## 4. Two journeys, not one

### A. SEO visitor (never logs in)

Open Reader → paste feed → read → leave. May return via Google. Never sees Home, Starred, or Settings. This is how you acquire. Do not mix it with the logged-in shell.

### B. Subscriber (the SaaS user)

Hit wall → account → pick sources → folders → daily Home → star/save → discover more → (later) alerts/AI → (later) pay → manage devices → someday export or delete.

---

## 5. Screen order a new logged-in user should feel

| Order | Screen | Why it exists |
|---|---|---|
| 1 | Auth (Google / email) | Create the owner identity |
| 2 | Onboarding / Find sources | Fill the library or they bounce |
| 3 | Home briefing | Proof the follow list is working |
| 4 | Top stories / Split reader | Daily reading surfaces |
| 5 | Watchlists / folders | Control noise |
| 6 | Starred / Read later | Personal memory |
| 7 | Add source / Builder | Escape the catalog |
| 8 | Settings / devices | Trust and preference |
| 9 | Plan / billing (future) | Pay for limits and automation |

Mapped to FeedOmeter 2.1 nav: `home`, `top-stories`, `read-rss`, `starred`, `read-later`, `watchlists`, `find-sources`, `add-source`, `sources`, `settings` — plus public `index` / `viewer` as stages 0–1 only.

---

## 6. One-line sequence to remember

**Guest:** Arrive → sample a feed → leave or hit the wall.

**Owner:** Auth → pick sources → Home → read / star / save → folders → add more sources → settings → (later) plan.

---

## 7. Related working files

- Identity implementation report (canvas): identity architecture vs code
- Folder: `documents\Feedometer 2,1\Phase II\Proposed User Creation and Maitenance Model\`
