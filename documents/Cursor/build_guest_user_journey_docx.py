# -*- coding: utf-8 -*-
"""Build Guest vs User Journey Word document (OOXML, no lxml)."""
import os
import zipfile
from xml.sax.saxutils import escape

OUT_DIR = r"E:\Cursor-feedometer\User Journey"
OUT_PATH = os.path.join(OUT_DIR, "FeedOmeter Guest vs User Journey.docx")

NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"


def p(text, style="Normal", bold=False, size=22, space_after=160, space_before=0):
    sz = str(int(size))
    rpr = f'<w:rPr><w:sz w:val="{sz}"/><w:szCs w:val="{sz}"/>'
    if bold:
        rpr += "<w:b/>"
    rpr += "</w:rPr>"
    lines = text.split("\n") if text else [""]
    runs = []
    for i, line in enumerate(lines):
        if i:
            runs.append("<w:r><w:br/></w:r>")
        runs.append(f"<w:r>{rpr}<w:t xml:space=\"preserve\">{escape(line)}</w:t></w:r>")
    sp = (
        f'<w:pPr><w:pStyle w:val="{style}"/>'
        f'<w:spacing w:before="{space_before}" w:after="{space_after}"/>'
        f"</w:pPr>"
    )
    return f"<w:p>{sp}{''.join(runs)}</w:p>"


def h1(t):
    return p(t, "Heading1", True, 32, 240, 360)


def h2(t):
    return p(t, "Heading2", True, 26, 200, 280)


def h3(t):
    return p(t, "Heading3", True, 24, 160, 200)


def body(t):
    return p(t, "Normal", False, 22, 140, 0)


def bullet(t, level=0):
    indent = 360 + level * 360
    sz = "22"
    rpr = f'<w:rPr><w:sz w:val="{sz}"/><w:szCs w:val="{sz}"/></w:rPr>'
    txml = escape(t)
    return (
        f'<w:p><w:pPr><w:ind w:left="{indent}" w:hanging="180"/>'
        f'<w:spacing w:after="80"/></w:pPr>'
        f'<w:r>{rpr}<w:t xml:space="preserve">• {txml}</w:t></w:r></w:p>'
    )


def quote(t):
    return p(t, "Quote", False, 20, 160, 80)


CONTENT = []

CONTENT += [
    h1("FeedOmeter — Guest vs User Journey"),
    body("Document type: Product + implementation record"),
    body("Prepared from the Cursor working session on 20 September 2026."),
    body("Owner: Ravi (Product). Workspace: C:\\feedometer_next_phase. Live D1: feedometer-db."),
    body(
        "Purpose: lock Guest vs Account behaviour, record the full discussion, "
        "and list SQL and code changes made after agreement."
    ),
    body(
        "This document does not introduce RBAC. Guest is a demo session. "
        "An account is a users row that owns data in D1."
    ),
    h1("1. Decisions locked"),
    h2("1.1 Authentication (who are you)"),
    bullet("Guest = no users record. Browser window only. Cannot write the database."),
    bullet("User / Account = users record exists (email password or Google). Owns user_feeds and tray data."),
    bullet("Do not call this “guest login”. Preferred labels: Continue as guest / End guest session."),
    bullet("ravindran.kompel@gmail.com (Google) is not a guest. isGuest() is false when a session token and profile exist."),
    bullet("Not everyone is in guest mode. There are three identities: guest, signed-in account, logged-out."),
    h2("1.2 Persistence"),
    bullet("Source of truth for accounts: D1 tables (users, user_feeds, sources, articles), not localStorage."),
    bullet("Guest follows live in sessionStorage for this window only."),
    bullet("End of guest session, close window, open again, or come back later: empty Following and empty tray."),
    bullet("Guest cannot save follows or articles to the database."),
    h2("1.3 Guest → Account upgrade (Version 1)"),
    bullet("Guest follows are discarded on sign-up / Google sign-in."),
    bullet("New account starts with empty Following and empty tray."),
    bullet("Import of guest follows onto an account is deferred."),
    h2("1.4 Returning accounts"),
    bullet("Google or email users keep follows from past sessions in D1."),
    bullet("Login from another device, browser, or location loads the same follow list and tray."),
    h2("1.5 Tray"),
    bullet("Tray = Trending / Intelligence Briefing (home / brief page)."),
    bullet("New guest or new account: empty tray. No public news-desk mix-in."),
    bullet("After follows exist: latest 50 fused articles from those sources."),
    bullet("Stream URL list for guests is capped at 20 feeds."),
    h2("1.6 Roles vs plan"),
    bullet("Do not create roles or user_roles tables now."),
    bullet("Do not treat Guest vs User as RBAC."),
    bullet("Add users.plan (free / pro / premium), default free, for future billing."),
    bullet("Admin / analyst / moderator authorization is future work only."),
    h1("2. Separate these three ideas"),
    h2("2.1 Authentication — who are you?"),
    body("Guest vs User. Implemented as: no users row vs users row."),
    h2("2.2 Subscription — what product tier?"),
    body("Free vs Pro vs Premium. Implemented as users.plan. Not used to gate features yet."),
    h2("2.3 Authorization — what admin powers? (future)"),
    body("Admin, Analyst, Moderator, Support. Would need roles + user_roles. Not in this version."),
    h1("3. User states"),
    body("State | users row | plan | data persisted"),
    body("Guest | No | N/A | No (window only)"),
    body("Registered Free | Yes | free | Yes"),
    body("Registered Pro | Yes | pro | Yes (same product until gating exists)"),
    body("Registered Premium | Yes | premium | Yes (same until gating exists)"),
    body("Suspended | Yes | any | Blocked via users.status"),
    body("Deleted | Soft deleted | any | Hidden via users.status / deleted_at"),
    h1("4. Sequential journeys (agreed)"),
    h2("Sequence 1 — Guest, first visit"),
    body("1. Opens FeedOmeter and continues as guest (no account)."),
    body("2. Following is empty. Tray is empty. No public feeds mixed in."),
    body("3. They follow one or more sources."),
    body("4. They go to the tray and see latest articles from those sources only (cap 50)."),
    body("5. In the same window they can move between Find Feeds, Following, and Trending and it still works."),
    h2("Sequence 2 — Guest leaves and comes back"),
    body("6. They end the session, close the window, close the browser, or open FeedOmeter again later."),
    body("7. Guest storage is gone. No leftover follow list on that machine."),
    body("8. Empty Following and empty tray — same as first open."),
    body("9. They can demo again from scratch. Still nothing in the database."),
    h2("Sequence 3 — Guest upgrades to an account (now)"),
    body("10. From a guest session they sign in with Google or email."),
    body("11. Demo follows are not copied to the database."),
    body("12. They land as a new account: empty Following, empty tray."),
    body("13. From this point they follow Sequence 4, not guest rules."),
    h2("Sequence 4 — New account, first real use"),
    body("14. First login: empty Following, empty tray."),
    body("15. They follow sources. Each follow is written to user_feeds → sources."),
    body("16. Tray loads latest 50 articles from those sources."),
    body("17. Logout does not delete D1. It only ends the browser session."),
    h2("Sequence 5 — Returning account (any device)"),
    body("18. They log in again with the same Google or email, any browser or location."),
    body("19. Following shows exactly what is in D1 for that user — not a leftover guest list."),
    body("20. Tray shows latest 50 from those followed sources."),
    body("21. Follow / unfollow updates D1; next login anywhere matches that."),
    h2("Sequence 6 — Next person on the same computer"),
    body("22. Previous guest or account logs out or closes."),
    body("23. Next person is not shown the previous person’s follows or tray."),
    body("24. Guest = empty. Other account = only that account’s D1 data."),
    h2("What each person sees"),
    body("Guest, first open → Following empty, tray empty."),
    body("Guest, after follow, same window → those feeds, articles from those feeds."),
    body("Guest, new window / come back → empty, empty."),
    body("Guest becomes new Google/email → empty, empty."),
    body("Account, first login → empty, empty."),
    body("Account, after follow → D1 follows, latest 50."),
    body("Account, login elsewhere → same D1 follows, latest 50."),
    h2("Out of scope for this version"),
    bullet("Copying guest follows onto an account at upgrade."),
    bullet("Remembering a guest after close/reopen."),
    bullet("Filling an empty tray with public/default news desks."),
    bullet("roles / user_roles tables."),
    bullet("Stripe / user_subscriptions billing table (deferred; plan column is enough for now)."),
    h1("5. Full discussion record (this chat)"),
    body(
        "The following is the Guest vs User thread in order, including the empty-tray "
        "investigation that started the conversation. Wording is condensed but complete on decisions."
    ),
    h2("Turn 1 — Symptom (Ravi)"),
    body(
        "Ravi reported that ravindran.kompel is following two sources (Cricinfo and Sky Sports). "
        "After logout and login, Trending / briefing showed no articles from those sources. "
        "Navigating to Following still showed the two feeds saved there. "
        "Instruction: look into it, do not fix, return with root cause for discussion."
    ),
    h2("Turn 2 — Root cause (assistant)"),
    body(
        "Following and Trending were not reading the same list. Following.html loaded "
        "GET /api/subscriptions (D1) and then always merged localStorage feedometer_guest_subscriptions. "
        "Logout cleared the session token and guest_mode flag but did not clear that guest list. "
        "Following a starter feed while logged in also wrote the guest key."
    ),
    body(
        "Home / Trending, after the empty-library fix, counted GET /api/subscriptions only. "
        "If that count was 0 it showed “Your stream is empty” and never called /api/stream. "
        "So Following could show two sports cards from the browser while Home asked D1 and got empty."
    ),
    body(
        "Secondary path: D1 really has two rows but stream fusion returns 0 items (bad RSS URL, "
        "fetch fail, or filters). Following never fetches RSS so cards still appear. "
        "The empty-state copy indicated the count = 0 path had run."
    ),
    body("How to confirm: Network on Trending — empty subscriptions vs personal stream with 0 items."),
    h2("Turn 3 — Requirement (Ravi)"),
    quote(
        "Ideally if we are using databases we wanted the source of truth to be tables. "
        "ravindran.kompel@gmail.com is not in guest mode right? Need clarification — "
        "is it like for now everyone is logged in as in guest mode?"
    ),
    body(
        "Requirement stated: if a new user logs in, tray is empty — guest, registered, or Gmail. "
        "Once they follow feeds, logout and login from a different device/browser/location, "
        "the tray must have articles from feeds they follow. If too many, cutoff so they see latest. "
        "Tray = trending or brief page. Do not start fixing; discuss further."
    ),
    h2("Turn 4 — Clarification (assistant)"),
    body(
        "Yes: for anyone with an account, D1 is source of truth. Guest is only a browser scratchpad. "
        "ravindran is not guest if they logged in with Google. isGuest() is not authenticated AND guest flag. "
        "Everyone is not a guest. Three identities: guest, registered/Google, logged out."
    ),
    body(
        "What looked like guest was leftover localStorage mixed into Following even when signed in. "
        "A follow while logged in could succeed in the UI (localStorage) even if POST /api/subscriptions failed."
    ),
    body(
        "Proposed cutoff: N = 50 fused items, newest first. Optional later per-feed cap. "
        "Proposed signed-in rule: Following, Trending, Reader — D1 only. Guest: local/session only. "
        "Login: previously merge guest into user_feeds; that was later reversed for Version 1."
    ),
    h2("Turn 5 — Guest cannot save (Ravi)"),
    quote(
        "The guest would follow a few feeds and when he comes back to trending he will see articles. "
        "However once he logs off everything will be erased including the following. "
        "When he logs in the next time he will see an empty tray again. "
        "Guest can only see how things work but cannot save things to database."
    ),
    body("Ask: put this in better terms so we can discuss before implementing."),
    h2("Turn 6 — Restated guest spec (assistant)"),
    body("Guest is a demo session, not an account. Product lets them try follow → tray fills. Nothing in D1."),
    bullet("Empty on arrival."),
    bullet("Follow is real for this session only."),
    bullet("Tray works in-session."),
    bullet("End of session wipes everything."),
    bullet("Next guest visit is a new person."),
    bullet("Guest never writes the database."),
    body("Two open decisions posed:"),
    body("A. What counts as log off for a guest? End session only vs close tab vs close browser. Strictest: sessionStorage plus wipe on End session."),
    body("B. Upgrade path: throw away demo follows, or one-time keep these feeds on my account? Ravi had said guest cannot save — that implied throw away unless they opt in later."),
    h2("Turn 7 — A and B answered (Ravi)"),
    quote(
        "For A: end of session, closing the window... anything when he opens the window again or comes back, "
        "he will see an empty tray only. For B: if he is upgrading to logged-in user, let him have the empty tray as of now; "
        "we will think about it in future. People logging in with Google id or user id would be supported by their "
        "database saves from past sessions. Put this user initial journey into perspective and as points in sequence."
    ),
    h2("Turn 8 — Sequential journey draft (assistant)"),
    body("The six sequences in Section 4 of this document were written for review. Ravi did not reject them."),
    h2("Turn 9 — Roles tables? (Ravi)"),
    quote("Do we have roles tables created in the database? Check and come back. Don’t create anything. Let’s discuss first."),
    h2("Turn 10 — Schema check (assistant)"),
    body(
        "No roles table. No users.role column in schema_phase2.sql or Worker inserts. "
        "users.status is lifecycle (active / suspended / deleted), not guest vs registered. "
        "An older Phase 2 summary document mentioned users.role admin/analyst/user — leftover docs, not live D1. "
        "Guest vs account does not need a roles table."
    ),
    h2("Turn 11 — Plan field, not roles (Ravi + recommendation text)"),
    body(
        "Ravi: let’s not hurry into creating roles tables; it can be managed by an additional field. "
        "Look at the comments and give a fresh plan and solution we would be implementing. "
        "Cloudflare access already given; structure changes allowed as needed."
    ),
    body("The pasted recommendation (agreed in implementation) was:"),
    bullet("Keep Guest vs Account exactly as defined — authentication/state, not a role."),
    bullet("Option A (chosen): ALTER TABLE users ADD COLUMN plan TEXT DEFAULT 'free'."),
    bullet("Do not create roles / user_roles now — current questions are login and free vs paid, not admin screens."),
    bullet("Do not build user_subscriptions / Stripe yet; plan column is the minimal path."),
    bullet("Version 1 upgrade: Guest follows → sign up → empty account."),
    h2("Turn 12 — Implementation (assistant)"),
    body(
        "Implemented Option A, session-only guest follows, D1-only Following for accounts, "
        "empty tray without public mix-in, no guest merge on login. Worker deployed. "
        "Live D1 note: Sky Sports and Cricinfo user_feeds exist for ravindran.kompel@gmail.com. "
        "ravi.kompel@gmail.com had no follows. Two similar Gmail identities can look like the original bug."
    ),
    h2("Turn 13 — This document (Ravi)"),
    quote(
        "Update whatever you mentioned above as Guest vs User doc in E:\\Cursor-feedometer\\User Journey. "
        "Save as Word. List database SQL and code changes at the end. "
        "The document must contain all our chat conversation regarding guest and user journey."
    ),
    h1("6. Database SQL changes"),
    body("No roles, user_roles, or user_subscriptions tables were created."),
    h2("6.1 New file: schema/alter_users_plan.sql"),
    body("ALTER TABLE users ADD COLUMN plan TEXT DEFAULT 'free';"),
    body("UPDATE users SET plan = 'free' WHERE plan IS NULL;"),
    body(
        "Applied remotely on feedometer-db (ca5fb7fa-600e-456a-b904-080229328089). "
        "Wrangler reported success. Verified SELECT id, email, plan, status FROM users: "
        "ravindran.kompel@gmail.com, ravi.kompel@gmail.com, sportsrip.admin@gmail.com all plan=free."
    ),
    h2("6.2 Edited: schema/schema_phase2.sql (CREATE TABLE users)"),
    body("Added at end of users: plan TEXT DEFAULT 'free' CHECK(plan IN ('free', 'pro', 'premium'))."),
    body("Existing production table was altered (6.1), not rebuilt. CHECK is on new-install CREATE only."),
    h2("6.3 Tables that remain the account source of truth (unchanged structure)"),
    bullet("users — identity + status + now plan."),
    bullet("user_auth_providers / user_passwords / user_sessions — how they sign in."),
    bullet("user_feeds + sources — follow list for accounts."),
    bullet("articles — tray content for followed sources (fused, limit 50)."),
    h2("6.4 Live follow rows observed while investigating"),
    body("ravindran.kompel@gmail.com (u_7706fa91bbefbb04c6529987):"),
    bullet("SkySports | News — http://www.skysports.com/rss/0,20514,11095,00.xml"),
    bullet("Cricket news from Cricinfo.com — http://www.cricinfo.com/rss/content/story/feeds/0.xml"),
    body("ravi.kompel@gmail.com: no user_feeds rows in that query."),
    h1("7. Code changes"),
    h2("7.1 Worker / API"),
    bullet("workers/lib/session.js — include users.plan on session user; fallback SELECT if column missing."),
    bullet("workers/modules/auth/credentials.js — login SELECT *; register/login/reset responses include plan: 'free' (or row value)."),
    bullet("workers/modules/auth/google.js — Google auth user payload includes plan."),
    bullet("workers/modules/auth/preferences.js — profile update response includes plan."),
    bullet("workers/modules/streams.js — /api/stream?urls= only http(s) URLs, max 20, scope urls (guest tray). Default fuse limit already 50."),
    bullet("Worker deployed: https://feedometer-api.feedometer.workers.dev version 9576dfc3-ccca-4dc9-b81e-323fb114a496."),
    bullet("dist/worker/feedometer-worker.bundle.js rebuilt (~200 KB) for dashboard paste if needed."),
    h2("7.2 Auth client — scripts/feedometer-auth.js"),
    bullet("Guest follows key still named feedometer_guest_subscriptions but stored in sessionStorage, not localStorage."),
    bullet("clearGuestDemo() removes sessionStorage and leftover localStorage."),
    bullet("getGuestFollows() / setGuestFollows() — empty when authenticated; never write D1."),
    bullet("login, register, loginWithGoogle: clearGuestDemo() instead of mergeGuestSubscriptions() copying URLs into user_feeds."),
    bullet("mergeGuestSubscriptions() is now a wipe-only alias (no D1 import)."),
    bullet("_setSession and _clearSession call clearGuestDemo()."),
    bullet("getStream({ urls }) passes urls query param for guest tray."),
    bullet("Minified: scripts/feedometer-auth.min.js and feedometer.bundle.min.js via node build.js."),
    h2("7.3 Following — following.html"),
    bullet("Signed in: load GET /api/subscriptions only. Do not merge guest storage."),
    bullet("Guest: session follows only."),
    bullet("saveGuestSubscriptions writes sessionStorage only when not authenticated; clears guest demo when signed in."),
    h2("7.4 Tray — home.html"),
    bullet("No localStorage briefing hydrate (prevents leftover public/guest tray)."),
    bullet("Signed in with 0 D1 follows: empty tray, no /api/stream public catalog."),
    bullet("Guest with 0 session follows: empty tray."),
    bullet("Guest with follows: getStream limit 20 then 50 with urls=..."),
    bullet("Reject stream_scope public. Empty copy is “Your stream is empty” for guest and account."),
    h2("7.5 Find Feeds — find-feeds.html"),
    bullet("Followed-URL set: D1 if signed in, else getGuestFollows(). No localStorage merge."),
    bullet("Unfollow/follow guest path uses setGuestFollows. Toast: this window only."),
    h2("7.6 Other UI"),
    bullet("navbar/navbar.js — Following badge from cached D1 count or session guest list, not localStorage guest list."),
    bullet("scripts/feedometer-add-source.js — guest save only if not authenticated; session follows, not localStorage; failed account save no longer fakes guest success."),
    bullet("top-stories.html — no unauthenticated public /api/stream fallback; guest uses urls stream; account uses personal stream."),
    h2("7.7 What we explicitly did not change"),
    bullet("No roles tables."),
    bullet("No user_subscriptions billing table."),
    bullet("No guest-follow import on Google/email sign-in."),
    bullet("Paid feature gating is not wired; plan is stored only."),
    h1("8. How to verify after a hard refresh"),
    body("1. Guest, no follows → empty tray. Follow two feeds → tray fills in this window. New window → empty."),
    body("2. Sign in as a brand-new Google/email → empty tray; guest follows not imported."),
    body("3. Sign in as ravindran.kompel@gmail.com → Following from D1 (Sky Sports + Cricinfo); tray is personal stream."),
    body("4. Confirm you are not signed into ravi.kompel@gmail.com if you expect those two sports feeds."),
    h1("9. Future (explicitly deferred)"),
    bullet("Optional: Guest follows → sign up → Import guest follows."),
    bullet("Optional: user_subscriptions + Stripe customer/subscription ids when billing is real."),
    bullet("Optional: roles + user_roles when internal admin users exist."),
    bullet("Optional: per-feed cap so one noisy source does not fill the tray of 50."),
    body("End of document."),
]


def document_xml():
    body_xml = "".join(CONTENT)
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        f'<w:document xmlns:w="{NS}">'
        f"<w:body>{body_xml}"
        "<w:sectPr><w:pgSz w:w=\"12240\" w:h=\"15840\"/>"
        "<w:pgMar w:top=\"1440\" w:right=\"1440\" w:bottom=\"1440\" w:left=\"1440\"/>"
        "</w:sectPr></w:body></w:document>"
    )


def styles_xml():
    return f'''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="{NS}">
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal">
    <w:name w:val="Normal"/>
    <w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:sz w:val="22"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading1">
    <w:name w:val="heading 1"/><w:basedOn w:val="Normal"/>
    <w:rPr><w:b/><w:sz w:val="32"/><w:color w:val="0F172A"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading2">
    <w:name w:val="heading 2"/><w:basedOn w:val="Normal"/>
    <w:rPr><w:b/><w:sz w:val="26"/><w:color w:val="1E293B"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading3">
    <w:name w:val="heading 3"/><w:basedOn w:val="Normal"/>
    <w:rPr><w:b/><w:sz w:val="24"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Quote">
    <w:name w:val="Quote"/><w:basedOn w:val="Normal"/>
    <w:pPr><w:ind w:left="360"/></w:pPr>
    <w:rPr><w:i/><w:color w:val="334155"/></w:rPr>
  </w:style>
</w:styles>'''


def content_types():
    return '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>'''


def rels():
    return '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>'''


def doc_rels():
    return '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>'''


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    if os.path.exists(OUT_PATH):
        os.remove(OUT_PATH)
    with zipfile.ZipFile(OUT_PATH, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("[Content_Types].xml", content_types())
        z.writestr("_rels/.rels", rels())
        z.writestr("word/document.xml", document_xml())
        z.writestr("word/_rels/document.xml.rels", doc_rels())
        z.writestr("word/styles.xml", styles_xml())
    print(OUT_PATH)
    print("bytes", os.path.getsize(OUT_PATH))


if __name__ == "__main__":
    main()
