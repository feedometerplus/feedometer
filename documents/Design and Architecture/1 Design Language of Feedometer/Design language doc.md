# FeedOmeter Enterprise Design System & Design Language Specification

**Document:** Universal Design Language, Master Tokens & Component Schema Blueprint  
**Version:** 1.0 (Master Enterprise Design Specification)  
**Date:** September 18, 2026  
**Status:** Approved Product & UI Architecture Standard  
**Target Codebase:** `C:\feedometer\styles\feedometer.css`  

---

## 1. Executive Summary & Design Philosophy

As FeedOmeter scales into new functional surfaces (Reader Views, Builder Studios, Custom Dashboards, and Feed Directories), maintaining **visual consistency**, **ergonomic readability**, and **rapid maintainability** requires a strict **Single-Point-of-Control Design System**.

### Core Tenets of the FeedOmeter Design Language:
1. **Single-Point-of-Control:** Any global adjustment to brand typography, button curvature, elevation shadows, or color schemes is made in **one single location** (`:root` in `styles/feedometer.css`) and automatically cascades across all pages, modals, and widgets.
2. **8-Point Spatial Grid:** All spacing, margins, paddings, and button heights conform strictly to a base-8 grid system (4px, 8px, 12px, 16px, 24px, 32px, 48px).
3. **Ergonomic Typography:** A carefully calibrated type scale optimized for high-density information architecture and effortless long-form article scanning.
4. **Zero Layout Shifts & 60fps Performance:** CSS-native transitions and hardware-accelerated transforms ensure instant, stutter-free interactions across desktop and mobile devices.

---

## 2. Master Design Tokens Schema (`:root`)

Every UI component in FeedOmeter is bound directly to central CSS Custom Properties:

```css
:root {
  /* ── 1. Color Palette & Theme Tokens ── */
  --bg-primary: #ffffff;
  --bg-secondary: #ffffff;
  --bg-card: #ffffff;
  --bg-card-hover: #f8f8f8;
  --bg-input: #ffffff;
  --border-color: #e6e6e6;
  --border-focus: #141414;
  --text-primary: #141414;
  --text-secondary: #545658;
  --text-muted: #757575;
  --accent: #0284c7;
  --accent-hover: #0369a1;
  --accent-glow: rgba(20, 20, 20, 0.12);
  --success: #059669;
  --warning: #d97706;
  --danger: #dc2626;

  /* ── 2. Master Typography Scale (H1 - H6 & Reading Text) ── */
  --font-sans: 'Inter', 'ReithSans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
  --font-display: 'Quicksand', 'Inter', var(--font-sans);
  --font-mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  
  --font-h1: clamp(1.75rem, 3.5vw, 2.25rem); /* 28px - 36px */
  --font-h2: clamp(1.35rem, 2.5vw, 1.65rem); /* 22px - 26px */
  --font-h3: 1.25rem;                        /* 20px */
  --font-h4: 1.05rem;                        /* 17px */
  --font-h5: 0.90rem;                        /* 14.5px */
  --font-h6: 0.75rem;                        /* 12px uppercase */
  --font-body: 0.95rem;                      /* 15px - standard reading text */
  --font-body-sm: 0.85rem;                   /* 13.5px */
  --font-caption: 0.75rem;                   /* 12px - metadata / badges */
  
  --line-height-heading: 1.25;
  --line-height-tight: 1.35;
  --line-height-body: 1.6;
  
  --font-weight-regular: 400;
  --font-weight-medium: 500;
  --font-weight-semibold: 600;
  --font-weight-bold: 700;

  /* ── 3. Master Button Schema Tokens ── */
  --btn-radius: 8px;
  --btn-radius-pill: 9999px;
  --btn-font-weight: 600;
  --btn-font-size: 0.875rem;
  --btn-padding-sm: 0.35rem 0.75rem;
  --btn-padding-md: 0.55rem 1.15rem;
  --btn-padding-lg: 0.75rem 1.50rem;
  --btn-height-sm: 32px;
  --btn-height-md: 40px;
  --btn-height-lg: 48px;
  
  --btn-primary-bg: #141414;
  --btn-primary-text: #ffffff;
  --btn-primary-hover-bg: #000000;
  --btn-primary-hover-shadow: 0 4px 14px rgba(0, 0, 0, 0.18);
  
  --btn-secondary-bg: #f3f4f6;
  --btn-secondary-text: #1f2937;
  --btn-secondary-hover-bg: #e5e7eb;
  
  --btn-outline-border: #d1d5db;
  --btn-outline-text: #374151;
  --btn-outline-hover-bg: #f9fafb;
  --btn-outline-hover-border: #9ca3af;
  
  --btn-accent-bg: #0cdbff;
  --btn-accent-text: #0f172a;
  --btn-accent-hover-bg: #00c7eb;
  
  --btn-danger-bg: #dc2626;
  --btn-danger-text: #ffffff;
  --btn-danger-hover-bg: #b91c1c;

  /* ── 4. Master Badge & Status Tag Schema Tokens ── */
  --badge-radius: 9999px;
  --badge-radius-square: 4px;
  --badge-font-size: 0.725rem;
  --badge-font-weight: 600;
  --badge-padding-sm: 0.20rem 0.55rem;
  --badge-padding-md: 0.35rem 0.85rem;
  
  --badge-default-bg: #f1f5f9;
  --badge-default-text: #334155;
  --badge-default-border: #e2e8f0;
  
  --badge-live-bg: #ffffff;
  --badge-live-text: #0f172a;
  --badge-live-border: #e2e8f0;
  
  --badge-accent-bg: #e0f2fe;
  --badge-accent-text: #0369a1;
  --badge-accent-border: #bae6fd;
  
  --badge-success-bg: #d1fae5;
  --badge-success-text: #065f46;
  --badge-success-border: #a7f3d0;
  
  --badge-warning-bg: #fef3c7;
  --badge-warning-text: #92400e;
  --badge-warning-border: #fde68a;

  /* ── 5. Master Form Controls Schema ── */
  --input-height: 42px;
  --input-radius: 8px;
  --input-border: #d1d5db;
  --input-focus-border: #141414;
  --input-focus-shadow: 0 0 0 3px rgba(20, 20, 20, 0.12);
  --input-font-size: 0.925rem;
  --input-padding: 0.55rem 0.85rem;

  /* ── 6. Unified Spacing Scale (8pt Grid System) ── */
  --space-1: 0.25rem;  /* 4px */
  --space-2: 0.50rem;  /* 8px */
  --space-3: 0.75rem;  /* 12px */
  --space-4: 1.00rem;  /* 16px */
  --space-5: 1.25rem;  /* 20px */
  --space-6: 1.50rem;  /* 24px */
  --space-8: 2.00rem;  /* 32px */
  --space-10: 2.50rem; /* 40px */
  --space-12: 3.00rem; /* 48px */

  /* ── 7. Radii & Surface Elevation ── */
  --radius-sm: 4px;
  --radius-md: 6px;
  --radius-lg: 10px;
  --radius-xl: 14px;
  --radius-2xl: 18px;
  --shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.02);
  --shadow-md: 0 4px 12px rgba(0, 0, 0, 0.06), 0 1px 3px rgba(0, 0, 0, 0.03);
  --shadow-lg: 0 8px 24px rgba(0, 0, 0, 0.08), 0 2px 6px rgba(0, 0, 0, 0.04);
  --shadow-xl: 0 16px 36px rgba(0, 0, 0, 0.12), 0 4px 12px rgba(0, 0, 0, 0.06);
}
```

---

## 3. Typography System Specification

Typography is governed by a fluid clamp scale ensuring seamless responsiveness between mobile viewports and large desktop monitors:

| Element / Class | Token Binding | Default Value | Line Height | Weight | Functional Role |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `h1`, `.h1` | `--font-h1` | `clamp(1.75rem, 3.5vw, 2.25rem)` | `1.25` | SemiBold (600) | Primary Page Title, Hero Headline |
| `h2`, `.h2` | `--font-h2` | `clamp(1.35rem, 2.5vw, 1.65rem)` | `1.25` | SemiBold (600) | Major Section Header, Modal Header |
| `h3`, `.h3` | `--font-h3` | `1.25rem` (20px) | `1.35` | SemiBold (600) | Card Title, Category Group Header |
| `h4`, `.h4` | `--font-h4` | `1.05rem` (17px) | `1.35` | Medium (500) | Article Headline, Sub-topic Title |
| `h5`, `.h5` | `--font-h5` | `0.90rem` (14.5px) | `1.35` | Medium (500) | Section Label, Secondary Header |
| `h6`, `.h6` | `--font-h6` | `0.75rem` (12px) | `1.35` | SemiBold (600) | Overline, Uppercase Metadata Header |
| `.text-body`, `p` | `--font-body` | `0.95rem` (15px) | `1.60` | Regular (400) | Standard Reading Text & Article Snippets |
| `.text-body-sm` | `--font-body-sm` | `0.85rem` (13.5px) | `1.35` | Regular (400) | Compact Card Summaries & Captions |
| `.text-caption` | `--font-caption` | `0.75rem` (12px) | `1.35` | Regular (400) | Timestamps, Byline Authors, Tags |

---

## 4. Master Command Button Schema (`.btn`)

All interactive triggers, submit actions, modal dismissals, and launcher controls must extend the **Master Button Schema**.

### Button Architecture & Variants:
* **Base Component (`.btn`):** Handles CSS flex alignment, font sizing, active scale transform (`scale(0.98)`), and transition curves.
* **Variant Classes:**
  * `.btn-primary`: High-contrast dark action button (`var(--btn-primary-bg)` $	o$ `#141414`).
  * `.btn-secondary`: Subtle neutral button for auxiliary actions (`var(--btn-secondary-bg)` $	o$ `#f3f4f6`).
  * `.btn-outline`: Transparent background with border (`var(--btn-outline-border)` $	o$ `#d1d5db`).
  * `.btn-accent`: Cyan accent button for featured conversions (`var(--btn-accent-bg)` $	o$ `#0cdbff`).
  * `.btn-ghost`: Borderless button with hover background highlight.
  * `.btn-danger`: Red button for destructive operations (`var(--btn-danger-bg)` $	o$ `#dc2626`).
* **Size Modifiers:**
  * `.btn-sm`: Compact 32px height (`padding: 0.35rem 0.75rem`).
  * `.btn-lg`: Prominent 48px height (`padding: 0.75rem 1.50rem`).
* **Geometry Modifiers:**
  * `.btn-pill`: Fully rounded pill geometry (`border-radius: 9999px`).

---

## 5. Master Badge & Status Tag Schema (`.badge`)

Badges, category chips, live indicators, and content safety flags are unified under the **Master Badge Schema**.

### Badge Architecture & Variants:
* **Base Component (`.badge`):** Sets inline-flex centering, pill curvature (`9999px`), uppercase letter-spacing, and subtle borders.
* **Variant Classes:**
  * `.badge-live`: White pill with border and shadow for live status beacons.
  * `.badge-accent`: Soft cyan background for topic pills and publisher tags.
  * `.badge-success`: Soft green for online / active / valid states.
  * `.badge-warning`: Soft amber for sensitive news story warnings.
  * `.badge-danger`: Soft red for blocked or error feeds.
* **Size & Shape Modifiers:**
  * `.badge-md`: Medium badge padding for prominent headers.
  * `.badge-square`: Subtle 4px radius instead of full pill.

---

## 6. Spacing, Elevation & Surfaces

### Spatial System (8pt Grid):
All UI layouts, grid gaps, padding blocks, and margins strictly utilize the `--space-*` tokens:
* `--space-1`: 4px (Micro spacing, badge gaps)
* `--space-2`: 8px (Inner element margins, input gaps)
* `--space-3`: 12px (Card inner padding, button gaps)
* `--space-4`: 16px (Standard content padding, grid gaps)
* `--space-6`: 24px (Section spacing, modal padding)
* `--space-8`: 32px (Major layout blocks, hero padding)

### Surface Elevation & Shadows:
* `--shadow-sm`: Subtle elevation for buttons and input controls.
* `--shadow-md`: Floating cards, publisher pills, dropdown menus.
* `--shadow-lg`: Launcher modals, dialog windows, sticky headers.
* `--shadow-xl`: Master floating app window container (`.app-window`).

---

## 7. Development Guidelines for Future Pages & Modules

When creating new pages (e.g., RSS Builder Studio, User Preferences, History, or Analytics):

1. **Never Hardcode Pixels for Font Sizes or Colors:** Always use `var(--font-h*)`, `var(--btn-*)`, `var(--badge-*)`, and `var(--text-*)`.
2. **Reuse Master Classes First:** Use `.btn .btn-primary`, `.btn .btn-secondary`, and `.badge` before writing custom selectors.
3. **Recompile Production Assets:** After updating `styles/feedometer.css`, always run `node build.js` in `C:\feedometer` to regenerate `feedometer.min.css`.

---

## 8. Summary Checklist

* [x] **Master Design Tokens Declared in `:root`** (`styles/feedometer.css`)
* [x] **Typography Scale Standardized (H1 - H6, Body, Caption)**
* [x] **Master Command Button Schema Standardized (`.btn` + Variants)**
* [x] **Master Badge & Tag Schema Standardized (`.badge` + Variants)**
* [x] **Master Form Controls Schema Standardized (`--input-*`)**
* [x] **Production Assets Recompiled via `node build.js`** (`styles/feedometer.min.css`)
* [x] **Zero Layout Regressions on Existing Pages** (`index.html`, `builder.html`, `viewer.html`)
