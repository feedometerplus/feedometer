# FeedoSimulator — Complete User Guide & Architectural Reference

## 1. Executive Summary & Purpose

**FeedoSimulator** (`feedosimulator.html`) is a standalone, client-grade validation and batch audit suite designed for the **Feedometer RSS Platform**. It solves the critical engineering challenge of testing, validating, and reading large collections of RSS and Atom feeds (from dozens to thousands of links) by **mimicking real online user interactions step-by-step**.

### Key Capabilities:
1. **Automated User-Mimic Engine:** Types each feed URL into a simulated browser address bar, triggers extraction, and visually evaluates the output just like a live user.
2. **Universal Dataset Importer:** Seamlessly loads feed datasets from Excel spreadsheets (`.xlsx`, `.xls`), comma-separated values (`.csv`), tab-delimited files (`.tsv`), or raw newline-delimited text (`.txt`).
3. **Multi-Tier Worker Integration:** Direct integration with the Feedometer Cloudflare Worker API (`https://feedometer-api.ancient-smoke-3af9.workers.dev`) featuring Tier 1 direct fetch, Tier 2 adaptive slash recovery, and Tier 3 anti-bot bypass proxies.
4. **Keyed Multi-Source Digest Reader:** Automatically extracts **1 representative article from each successful feed** and renders them in a dedicated, distraction-free reader window with publisher badges and instant search.
5. **One-Click Audit Exports:** Generates separate passed and failed link files (`.txt` and `.csv`) as well as full diagnostic audit logs with latency benchmarks and HTTP status codes.

---

## 2. Dashboard Layout & Visual Design

FeedoSimulator features a modern, clean dashboard layout inspired by high-productivity SaaS platforms (LoadLogic aesthetic):

```
+---------------------------------------------------------------------------------------------------------+
|  [⚡ FEEDO] FeedoSimulator Dashboard                      Worker API: [ https://feedometer-api... ]     |
+------------------------------------+--------------------------------------------------------------------+
|  LEFT SIDEBAR (Controls)           |  RIGHT MAIN DISPLAY                                                |
|                                    |                                                                    |
|  [📁 1. Load Dataset]              |  [ KPI Overview Cards: Total Queue | Passed | Failed | Latency ]   |
|   - Drag & Drop / File Picker      |  [ Progress Bar (0% - 100%) ]                                      |
|   - Manual Paste Textarea          |                                                                    |
|                                    |  [ Live User-Interaction Simulator (Online Mimic Active) ]         |
|  [⚡ 2. Simulator Execution]        |   - Simulated URL Input & Fetch Button                             |
|   - Pacing Delay Slider            |   - Real-time Output & Diagnostic Card                             |
|   - [▶ Mimic] [⏸] [⏹ Reset]        |                                                                    |
|                                    |  [ Live Execution Streaming Log (Orders-Style Table) ]             |
|  [✨ 3. Multi-Source Reader]       |   - Filter Tabs: [All] [Passed] [Failed]                           |
|   - [Open Reader Window →]         |   - Columns: # | URL | Channel Title | Items | Status | Error      |
|                                    |                                                                    |
|  [📥 4. File Exports]              |                                                                    |
|   - Failed (.txt / .csv)           |                                                                    |
|   - Passed (.txt / .csv)           |                                                                    |
|   - Comprehensive Audit (.csv)     |                                                                    |
+------------------------------------+--------------------------------------------------------------------+
```

---

## 3. Step-by-Step Operating Instructions

### Step 1: Loading a Feed Dataset

FeedoSimulator supports multiple import methods to ingest feeds from any source:

#### Option A: Drag & Drop / File Upload
1. Click anywhere inside the dashed **"Load Dataset"** box, or drag and drop a file from your computer.
2. Supported file formats:
   - **Excel Spreadsheets:** `.xlsx`, `.xls` (SheetJS automatically parses all rows and columns).
   - **CSV / TSV Files:** `.csv`, `.tsv` (PapaParse extracts links from any column header or cell).
   - **Plain Text:** `.txt` (Reads line-by-line or comma-separated lists).
3. The built-in URL extractor scans all matrix cells, filters for valid URLs, and automatically eliminates duplicates.

#### Option B: Manual Paste
1. Paste a list of URLs directly into the **"Or Paste Links"** text area (one link per line).
2. Click **"Load Pasted Feeds"**.

> **Note:** Upon loading, the KPI overview updates immediately with the total queue count, and the results table populates with all pending feeds.

---

### Step 2: Configuring Simulator Settings

Before running the simulation, you can customize execution parameters:

1. **Worker API Endpoint:**
   - Default: `https://feedometer-api.ancient-smoke-3af9.workers.dev`
   - You can edit this field in the top-right header to point to staging or local workers.
2. **Simulation Delay Slider:**
   - **Visual Mimic Mode (100ms – 1500ms delay):** Paces requests to let you visually observe the URL typing, simulated button interaction, and live card extraction.
   - **Turbo Mode (0ms delay):** Processes the queue at maximum network concurrency for high-speed batch audits.

---

### Step 3: Executing the Simulation

1. Click **`▶ Mimic Online`** to start the validator.
2. Observe real-time progress:
   - **Simulated Browser Bar:** Shows the current URL being typed and evaluated.
   - **Pulse Indicator:** Flashes green during active network requests.
   - **Real-Time KPIs:** Live counts of **Passed Feeds**, **Failed / Blocked**, and **Average Latency** in milliseconds.
   - **Streaming Table:** Streams live rows into the audit log with HTTP status badges (`200 OK`, `403 Forbidden`, `404 Not Found`, `504 Timeout`).
3. **Controls during execution:**
   - Click **`⏸ Pause`** to temporarily halt processing at any time. Click **`▶ Resume`** to continue.
   - Click **`⏹ Reset`** to clear the simulation state and re-enable configuration.

---

### Step 4: Multi-Source Reader Window (1 Story per Feed)

FeedoSimulator features a **Keyed Feed Digest Store** (`FeedDigestStore`) that captures exactly **1 representative article from each passed feed source**.

1. As soon as at least 1 feed passes verification, the **`Open Reader Window →`** button enables in the sidebar.
2. Clicking this button opens a clean, light-mode reader window:
   - **Publisher Identification:** Every story card displays a prominent **Source Pill** (e.g., `[🟢 TechCrunch]`, `[🟢 BBC News]`, `[🟢 Gizmodo]`) with the source index number.
   - **Article Card Layout:** Displays article thumbnail image, headline link, summary snippet, author name, publication date, and a direct **"Read Story ↗"** link.
   - **Live Instant Search Bar:** Filter all loaded stories across publisher titles, article headlines, and authors in real-time.
   - **Live Streaming Support:** If you keep the reader window open side-by-side while the simulator continues running, newly passed feed stories pop into the window automatically!

---

### Step 5: Exporting Audit Files & Reports

FeedoSimulator allows you to download clean, separated audit files with a single click:

| Export Button | File Name | Content Description |
| :--- | :--- | :--- |
| **❌ Failed (.txt)** | `failed_feeds.txt` | Plain text list of all failed/blocked URLs (one per line) for easy reprocessing. |
| **❌ Failed (.csv)** | `failed_feeds.csv` | Spreadsheet containing failed feed URLs, HTTP status codes, latency, and exact error diagnostics. |
| **✅ Passed (.txt)** | `passed_feeds.txt` | Plain text list of all verified, working RSS feed URLs. |
| **✅ Passed (.csv)** | `passed_feeds.csv` | Spreadsheet containing passed feed URLs, channel titles, extracted article counts, and latency. |
| **📊 Audit Report (.csv)** | `feed_audit_comprehensive_report.csv` | Complete end-to-end dataset audit containing every feed, status, response time, and error trace. |

---

## 4. Architectural & Engineering Highlights

### Modern Keyed Data Store (`FeedDigestStore`)
Instead of legacy flat arrays, FeedoSimulator uses an ES6 `Map<feedUrl, ArticleEntry>` store:
- **Deduplication:** Guarantees that even if duplicate feed URLs exist in the uploaded sheet, only 1 unique article card is generated per feed origin.
- **Window Broadcasting:** `streamToActiveWindow(entry)` communicates directly with any active popup window DOM using native browser window references.

### Resilient Fallbacks
- **Offline / Zero-CDN Safety:** Built-in `FileReader` text and regex parsers ensure CSV and TXT files parse immediately even if external CDNs are unavailable.
- **Full Transparent Overlay Trigger:** Native file input overlays the upload box (`position: absolute; width: 100%; height: 100%; opacity: 0; z-index: 20`), eliminating browser-level programmatic click suppression.

---

## 5. Diagnostic Error Reference

| HTTP Status | Error Reason in Table | Cause & Resolution |
| :--- | :--- | :--- |
| **200 OK** | `Clean Articles` | Feed parsed cleanly with valid items extracted. |
| **403 Forbidden** | `Cloudflare WAF / Anti-Bot` | Target server blocked datacenter IP. Handled automatically via Tier 3 syndication fallback. |
| **404 Not Found** | `Invalid Path / Missing Slash` | Target URL does not exist. Handled via Tier 2 slash variant recovery. |
| **301 / 302 Redirect** | `Protocol or Case Redirect` | Target feed redirected to canonical HTTPS or lowercase path. Handled automatically via Worker fetch redirect follow. |
| **504 Timeout** | `Connection timeout` | Publisher server took longer than 15,000ms to respond. |

---

*Document generated for the Feedometer Platform.*
