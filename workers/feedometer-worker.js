/**
 * Feedometer API & Edge Worker
 * Stateless Cloudflare Worker for Feedometer (Free Online RSS Reader & Builder)
 * 
 * Features:
 * - 0 KV Storage operations (Unlimited, 100% Free Edge Cache API)
 * - /api/view     -> Fast RSS/Atom XML fetcher & normalizer with 15-min Edge SWR Caching
 * - /api/build    -> Web-to-RSS generator (HTML semantic article scraper -> RSS 2.0 XML)
 * - /api/og       -> Instant OpenGraph metadata & thumbnail extractor
 * - /api/waitlist -> Launch notify signup (stored until email provider is wired)
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, HEAD',
  'Access-Control-Allow-Headers': 'Content-Type, Cache-Control, x-requested-with, X-Admin-Secret',
  'Access-Control-Max-Age': '86400'
};

const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const FEEDOMETER_BOT_UA = 'Mozilla/5.0 (compatible; FeedometerBot/1.0; +https://feedometer.pages.dev)';

function fetchHeadersForFeed(tier = 1, targetUrl = '') {
  if (tier === 2) {
    return {
      'User-Agent': BROWSER_UA,
      'Accept': 'application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, text/html;q=0.8, */*;q=0.1',
      'Accept-Language': 'en-US,en;q=0.9'
    };
  }
  return {
    'User-Agent': FEEDOMETER_BOT_UA,
    'Accept': 'application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9'
  };
}

function fetchHeadersForHtml(targetUrl) {
  let origin = '';
  try { origin = new URL(targetUrl).origin; } catch (e) {}
  return {
    'User-Agent': BROWSER_UA,
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Referer': origin || targetUrl,
    'Upgrade-Insecure-Requests': '1'
  };
}

function jsonResponse(data, status = 200, cacheSeconds = 0) {
  const headers = new Headers(CORS_HEADERS);
  headers.set('Content-Type', 'application/json; charset=utf-8');
  if (cacheSeconds > 0) {
    headers.set('Cache-Control', `public, max-age=${cacheSeconds}, s-maxage=${cacheSeconds}, stale-while-revalidate=86400`);
  } else {
    headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  }
  return new Response(JSON.stringify(data), { status, headers });
}

/**
 * Popular feeds pre-cached every 12 hours.
 * These are served instantly from Edge Cache when users click the quick-access pills.
 */
const POPULAR_FEEDS = [
  'https://news.ycombinator.com/rss',           // Hacker News
  'https://www.theverge.com/rss/index.xml',      // The Verge
  'https://rss.nytimes.com/services/xml/rss/nyt/World.xml', // NYT World
  'https://www.sciencedaily.com/rss/top/science.xml', // ScienceDaily
  'https://feeds.bbci.co.uk/news/rss.xml',       // BBC News
  'https://www.nasa.gov/rss/dyn/breaking_news.rss' // NASA
];

const POPULAR_FEED_CACHE_TTL = 21600; // 6 hours
const ORGANIC_FEED_CACHE_TTL = 86400; // 24 hours
const BUILD_CACHE_TTL = 1800; // 30 minutes
const SCHEMA_VERSION = 1;

const FEED_TRACKING_PARAMS = new Set([
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'utm_id',
  'fbclid', 'gclid', 'gclsrc', 'dclid', 'msclkid', 'mc_cid', 'mc_eid',
  'igshid', 'si', 'spm', 'sc_src', 'sc_lid'
]);

const ARTICLE_TRACKING_PARAMS = new Set([
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'utm_id',
  'fbclid', 'gclid', 'gclsrc', 'dclid', 'msclkid', 'mc_cid', 'mc_eid',
  'igshid', 'si', 'spm', 'ref', 'ref_src', 'sc_src', 'sc_lid'
]);

/** Isolate-lifetime: skip OG fetches for hosts that already 403/429. */
const ogBlockedHosts = new Set();

const DEFAULT_WORKER_PUBLIC_URL = 'https://feedometer-api.ancient-smoke-3af9.workers.dev';

function getWorkerPublicOrigin(env, request) {
  if (env && env.WORKER_PUBLIC_URL) {
    return String(env.WORKER_PUBLIC_URL).replace(/\/$/, '');
  }
  if (request && request.url) {
    return new URL(request.url).origin;
  }
  return DEFAULT_WORKER_PUBLIC_URL;
}

export default {
  async fetch(request, env, ctx) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    const url = new URL(request.url);
    const pathname = url.pathname;

    // Health check
    if (pathname === '/' || pathname === '/health' || pathname === '/api/health') {
      return jsonResponse({
        status: 'ok',
        service: 'feedometer-api',
        version: '1.0.0',
        engine: 'Cloudflare Edge Worker',
        features: ['view', 'build', 'og', 'warm-cache'],
        popularFeeds: POPULAR_FEEDS.length,
        timestamp: new Date().toISOString()
      });
    }

    try {
      // 1. ROUTE: /api/view (Fetch & normalize RSS/Atom feed)
      if (pathname === '/api/view' || pathname === '/api/fetch-feed') {
        return await handleViewFeed(request, url, ctx, env);
      }

      // 2. ROUTE: /api/build (Web-to-RSS generator)
      if (pathname === '/api/build') {
        return await handleBuildFeed(request, url, ctx);
      }

      // 3. ROUTE: /api/og (OpenGraph thumbnail extractor)
      if (pathname === '/api/og' || pathname === '/api/og-image') {
        return await handleOgExtract(request, url, ctx);
      }

      // 5. ROUTE: /api/warm-cache, /api/cache/refresh (Re-warm / refresh Edge Cache)
      if (pathname === '/api/warm-cache' || pathname === '/api/cache/refresh' || pathname === '/api/cache/warm') {
        return await handleCacheRefresh(request, url, ctx);
      }

      // 6. ROUTE: /api/purge-cache, /api/cache/purge (Purge selective feeds from Edge Cache)
      if (pathname === '/api/purge-cache' || pathname === '/api/cache/purge') {
        return await handlePurgeCache(request, url);
      }

      // 7. ROUTE: /api/cache/purge-all, /api/purge-all (Purge all popular feeds & global edge cache)
      if (pathname === '/api/cache/purge-all' || pathname === '/api/purge-all') {
        return await handlePurgeAllCache(request, url);
      }

      // 8. ROUTE: /api/cache/status, /api/cache/inspect (Inspect Edge Cache state for feeds)
      if (pathname === '/api/cache/status' || pathname === '/api/cache/inspect') {
        return await handleCacheStatus(request, url);
      }

      // 9. ROUTE: /api/waitlist (POST — save email & notify admin@feedometer.com)
      if (pathname === '/api/waitlist') {
        return await handleWaitlist(request, env, ctx);
      }

      // 10. ROUTE: /api/admin/waitlist (GET — export KV + D1 waitlist)
      if (pathname === '/api/admin/waitlist') {
        return await handleAdminWaitlist(request, env);
      }

      // 10b. ROUTE: /api/admin/waitlist-sync (POST — copy KV waitlist into D1 now)
      if (pathname === '/api/admin/waitlist-sync') {
        return await handleAdminWaitlistSync(request, env);
      }

      // 11. ROUTE: /api/telemetry, /api/event (POST — lightweight analytics beacon)
      if (pathname === '/api/telemetry' || pathname === '/api/event') {
        return await handleTelemetry(request, env);
      }

      return jsonResponse({ error: 'Endpoint not found', available: ['/api/view', '/api/build', '/api/og', '/api/cache/refresh', '/api/cache/purge', '/api/cache/purge-all', '/api/cache/status', '/api/waitlist', '/api/telemetry'] }, 404);

    } catch (err) {
      console.error('Worker error:', err);
      return jsonResponse({ ok: false, error: err.message || 'Internal Server Error' }, 500);
    }
  },

  /**
   * Cron: warm popular feeds every 4 hours, copy waitlist KV → D1 daily at 13:00 UTC (7:00 PM IST).
   */
  async scheduled(event, env, ctx) {
    if (event.cron === '0 13 * * *') {
      console.log(`[Feedometer] Scheduled waitlist KV→D1 sync at ${new Date().toISOString()}`);
      ctx.waitUntil(syncWaitlistKvToD1(env));
      return;
    }
    const origin = getWorkerPublicOrigin(env);
    console.log(`[Feedometer] Scheduled warm-cache at ${new Date().toISOString()} → ${origin}`);
    ctx.waitUntil(warmPopularFeeds(origin));
  }
};

/**
 * Route: /api/view?url=...
 * Fetch → parse → normalize → canonicalize → dedupe → Layer A images → cache → JSON.
 * User response is returned IMMEDIATELY.
 * OG gap-fill and D1 Database Deduplicated Cataloging run in background via ctx.waitUntil.
 */
async function handleViewFeed(request, url, ctx, env) {
  const rawTarget = url.searchParams.get('url');
  const noCache = url.searchParams.get('nocache') === '1';

  if (!rawTarget) {
    return jsonResponse({ ok: false, error: 'Missing ?url= parameter' }, 400);
  }

  let canonical;
  try {
    canonical = canonicalizeFeedUrl(rawTarget);
  } catch (e) {
    if (e && e.message === 'ssrf_blocked') {
      return jsonResponse({
        ok: false,
        code: 'ssrf_blocked',
        error: 'Access to private or restricted network addresses is prohibited.'
      }, 403);
    }
    return jsonResponse({ ok: false, error: 'Invalid feed URL' }, 400);
  }

  const cache = caches.default;
  const cacheKey = viewCacheKey(url.origin, canonical);

  if (!noCache) {
    const cachedResponse = await cache.match(cacheKey);
    if (cachedResponse) {
      const resp = new Response(cachedResponse.body, cachedResponse);
      resp.headers.set('X-Feedometer-Cache', 'HIT');
      return resp;
    }
  }

  let targetUrl = canonical;
  let feedRes = null;
  let rawXml = '';

  // Tier 1: Primary FeedometerBot 1.0 Fetch
  try {
    feedRes = await fetch(targetUrl, {
      headers: fetchHeadersForFeed(1, targetUrl),
      redirect: 'follow',
      signal: AbortSignal.timeout(8000)
    });
    if (feedRes.ok && feedRes.status !== 202) {
      rawXml = await feedRes.text().catch(() => '');
    }
  } catch (e1) {}

  // Tier 2: Adaptive Resilient Fallback (Browser Profile + HTTPS Upgrade + Slash Recovery)
  if (!looksLikeFeedXml(rawXml)) {
    try {
      // Step A: Try HTTPS upgrade on targetUrl
      const httpsUrl = targetUrl.replace(/^http:\/\//i, 'https://');
      let fallbackRes = await fetch(httpsUrl, {
        headers: fetchHeadersForFeed(2, httpsUrl),
        redirect: 'follow',
        signal: AbortSignal.timeout(10000)
      });
      if (fallbackRes.ok && fallbackRes.status !== 202) {
        const fallbackXml = await fallbackRes.text().catch(() => '');
        if (looksLikeFeedXml(fallbackXml)) {
          rawXml = fallbackXml;
          feedRes = fallbackRes;
          targetUrl = httpsUrl;
        }
      }

      // Step B: Adaptive Slash Variant Recovery (flips trailing slash for strict route/directory servers)
      if (!looksLikeFeedXml(rawXml)) {
        const slashVariant = getSlashVariantUrl(targetUrl);
        if (slashVariant && slashVariant !== targetUrl) {
          const slashRes = await fetch(slashVariant, {
            headers: fetchHeadersForFeed(2, slashVariant),
            redirect: 'follow',
            signal: AbortSignal.timeout(10000)
          });
          if (slashRes.ok && slashRes.status !== 202) {
            const slashXml = await slashRes.text().catch(() => '');
            if (looksLikeFeedXml(slashXml)) {
              rawXml = slashXml;
              feedRes = slashRes;
              targetUrl = slashVariant;
            }
          }
        }
      }
    } catch (e2) {}
  }

  // Tier 2.5: Dedicated RSS Autodiscovery Engine (Discovers embedded <link rel="alternate" type="application/rss+xml"> on HTML webpages)
  if (!looksLikeFeedXml(rawXml) && rawXml && /<(?:!doctype\s+html|html|head)\b/i.test(rawXml)) {
    const discoveredFeedUrl = discoverFeedUrlFromHtml(rawXml, targetUrl);
    if (discoveredFeedUrl && discoveredFeedUrl !== targetUrl) {
      try {
        const discRes = await fetch(discoveredFeedUrl, {
          headers: fetchHeadersForFeed(2, discoveredFeedUrl),
          redirect: 'follow',
          signal: AbortSignal.timeout(10000)
        });
        if (discRes.ok && discRes.status !== 202) {
          const discXml = await discRes.text().catch(() => '');
          if (looksLikeFeedXml(discXml)) {
            rawXml = discXml;
            feedRes = discRes;
            targetUrl = discoveredFeedUrl;
          }
        }
      } catch (eDisc) {}
    }
  }

  // Tier 3: Resilient Fallback Reader Engine (Bypasses Datacenter IP 403 / WAF blocks)
  let parsedFromTier3 = null;
  if (!looksLikeFeedXml(rawXml)) {
    // Step A: Dedicated RSS-to-JSON Syndication Proxy (feed2json)
    try {
      const f2jRes = await fetch('https://feed2json.org/convert?url=' + encodeURIComponent(targetUrl), {
        headers: { 'Accept': 'application/json', 'User-Agent': BROWSER_UA },
        signal: AbortSignal.timeout(10000)
      });
      if (f2jRes.ok) {
        const f2jJson = await f2jRes.json().catch(() => null);
        const f2jParsed = parseJsonFeed(f2jJson, canonical);
        if (f2jParsed && f2jParsed.items && f2jParsed.items.length > 0) {
          parsedFromTier3 = f2jParsed;
        }
      }
    } catch (e3a) {}

    // Step B: Semantic Reader Proxy (Jina)
    if (!parsedFromTier3) {
      try {
        const jinaRes = await fetch('https://r.jina.ai/' + targetUrl, {
          headers: { 'Accept': 'text/plain, text/html, */*', 'User-Agent': BROWSER_UA },
          signal: AbortSignal.timeout(12000)
        });
        if (jinaRes.ok) {
          const jinaText = await jinaRes.text();
          if (looksLikeFeedXml(jinaText)) {
            rawXml = jinaText;
          } else if (jinaText && jinaText.length > 200) {
            const resTier3 = scrapeArticlesFromJinaMarkdown(jinaText, targetUrl);
            if (resTier3.items && resTier3.items.length > 0) {
              parsedFromTier3 = resTier3;
            }
          }
        }
      } catch (e3b) {}
    }
  }

  let parsed;
  if (parsedFromTier3) {
    parsed = parsedFromTier3;
  } else if (looksLikeFeedXml(rawXml)) {
    parsed = parseFeedXml(rawXml, canonical);
  } else {
    if (feedRes && (feedRes.status === 429 || feedRes.status === 503)) {
      return jsonResponse({
        ok: false,
        code: 'origin_rate_limited',
        error: `Target feed server returned HTTP ${feedRes.status} (Rate Limited). Try again later.`
      }, feedRes.status);
    }
    const statusMsg = feedRes && !feedRes.ok ? `Target server returned HTTP ${feedRes.status}` : 'Could not reach this feed or not valid XML.';
    return jsonResponse({ ok: false, error: statusMsg }, (feedRes && feedRes.status) || 504);
  }
  const lastFetched = new Date().toISOString();
  let items = (parsed.items || []).map((raw) => canonicalizeArticle(raw, parsed.meta, canonical));
  items = dedupeItems(items);

  const isPopular = isPopularFeed(canonical);
  const moderationResult = moderateFeedItems(items, isPopular);
  if (moderationResult.blocked) {
    return jsonResponse({
      ok: false,
      code: 'content_blocked',
      error: 'This feed stream cannot be displayed because it contains prohibited hate speech, extremist, or unsafe material.'
    }, 403);
  }
  items = moderationResult.items;

  const cacheTtl = isPopular ? POPULAR_FEED_CACHE_TTL : ORGANIC_FEED_CACHE_TTL;

  const isDiscovered = targetUrl !== canonical;
  const feedDisplayUrl = isDiscovered ? targetUrl : canonical;
  const homeDisplayUrl = isDiscovered ? canonical : (parsed.meta.link || canonical);

  const payload = {
    ok: true,
    schemaVersion: SCHEMA_VERSION,
    feedUrl: feedDisplayUrl,
    discoveredFrom: isDiscovered ? canonical : undefined,
    meta: {
      title: parsed.meta.title || '',
      description: parsed.meta.description || '',
      link: homeDisplayUrl,
      url: feedDisplayUrl,
      feedTitle: parsed.meta.title || '',
      feedHomeUrl: homeDisplayUrl,
      feedIcon: parsed.meta.feedIcon || '',
      lastFetched
    },
    items,
    total: items.length,
    cached: isPopular ? '6h' : '24h'
  };

  const finalResponse = jsonResponse(payload, 200, cacheTtl);
  finalResponse.headers.set('X-Feedometer-Cache', 'MISS');
  finalResponse.headers.set('X-Feedometer-Fetched', lastFetched);
  if (isPopular) finalResponse.headers.set('X-Feedometer-Popular', 'true');

  if (ctx && ctx.waitUntil) {
    // 1. Asynchronous Edge Cache & OpenGraph Enrichment (Non-blocking)
    ctx.waitUntil((async () => {
      try {
        await cache.put(cacheKey, finalResponse.clone());
        const forOg = items.map((item) => Object.assign({}, item));
        await enrichItemsMissingHeroImages(forOg, 12);
        const richer = jsonResponse(Object.assign({}, payload, { items: forOg }), 200, cacheTtl);
        richer.headers.set('X-Feedometer-Cache', 'MISS');
        richer.headers.set('X-Feedometer-Fetched', lastFetched);
        if (isPopular) richer.headers.set('X-Feedometer-Popular', 'true');
        await cache.put(cacheKey, richer);
      } catch (e) {
        console.warn('view cache/og follow-up failed', e && e.message);
      }
    })());

    // 2. Asynchronous D1 Database Cataloging (Non-blocking: skips duplicates, saves only new feeds)
    ctx.waitUntil(persistFeedToD1IfNew(env, feedDisplayUrl, payload.meta, items.length));
  }

  return finalResponse;
}

/**
 * In-memory LRU cache to skip redundant D1 checks within the same worker isolate
 */
const processedFeedsCache = new Set();

/**
 * Background Asynchronous D1 Persist
 * - Serves user output first with 0ms latency impact
 * - Checks if feed_url already exists in D1 (via UNIQUE constraint)
 * - If already exists: skipped in < 0.1ms (0 wasted writes)
 * - If new: inserts into feedometer-db
 */
async function persistFeedToD1IfNew(env, feedUrl, meta, itemCount) {
  if (!env || !env.DB || !feedUrl) return;

  const normalized = String(feedUrl).trim();
  if (processedFeedsCache.has(normalized)) return;

  try {
    let publisher = 'General';
    let hostname = '';
    try {
      const u = new URL(normalized);
      hostname = u.hostname.replace(/^www\./i, '');
      publisher = meta && meta.title ? meta.title.split(/[-–|·:]/)[0].trim() : hostname;
    } catch {}

    const feedName = (meta && (meta.title || meta.feedTitle)) || hostname || 'Untitled Feed';

    // Atomic SQLite INSERT OR IGNORE:
    // If the feed_url already exists in D1 (UNIQUE index), SQLite ignores it in < 0.1ms with 0 duplicate rows created.
    // If it is a new feed, it is cleanly cataloged into feedometer-db.
    await env.DB.prepare(`
      INSERT OR IGNORE INTO feeds (
        category_id, publisher, feed_name, feed_url, status, article_count, validation_details
      ) VALUES (
        1, ?, ?, ?, 'Valid', ?, ?
      )
    `).bind(
      publisher || 'General',
      feedName,
      normalized,
      itemCount || 0,
      JSON.stringify({ autoCataloged: true, lastFetched: new Date().toISOString() })
    ).run();

    processedFeedsCache.add(normalized);
    if (processedFeedsCache.size > 2000) {
      const first = processedFeedsCache.values().next().value;
      processedFeedsCache.delete(first);
    }
  } catch (err) {
    // Non-blocking: background database errors never interrupt or impact user feeds
    console.warn('[D1 Catalog Background Save Error]:', err && err.message);
  }
}

function viewCacheKey(origin, canonicalFeedUrl) {
  const u = new URL('/api/view', origin);
  u.searchParams.set('url', canonicalFeedUrl);
  return new Request(u.toString(), { method: 'GET' });
}

function isPopularFeed(canonical) {
  return POPULAR_FEEDS.some((u) => {
    try {
      return canonicalizeFeedUrl(u) === canonical;
    } catch (e) {
      return u === canonical;
    }
  });
}

const DISALLOWED_HOST_PATTERNS = [
  /^localhost$/i,
  /^127\.\d+\.\d+\.\d+$/,
  /^10\.\d+\.\d+\.\d+$/,
  /^192\.168\.\d+\.\d+$/,
  /^172\.(1[6-9]|2[0-9]|3[0-1])\.\d+\.\d+$/,
  /^169\.254\.\d+\.\d+$/, // Cloud metadata IP
  /^0\.0\.0\.0$/,
  /\.internal$/i,
  /\.local$/i
];

function isDisallowedHost(hostname) {
  const h = String(hostname || '').toLowerCase();
  for (const pattern of DISALLOWED_HOST_PATTERNS) {
    if (pattern.test(h)) return true;
  }
  return false;
}

const BLOCKED_EXTREMISM_REGEX = /\b(white\s+supremac|neo-?nazi|holocaust\s+denial|isis\s+propaganda|al-?qaeda\s+official|child\s+abuse\s+material|child\s+pornography)\b/i;
const SENSITIVE_NEWS_REGEX = /\b(mass\s+shooting|suicide\s+attack|war\s+crimes|genocide|graphic\s+violence|execution\s+video)\b/i;

function moderateFeedItems(items, isWhitelistedPopular = false) {
  let isEntireFeedBlocked = false;
  const processed = [];

  for (const item of items) {
    const textBlob = `${item.title || ''} ${item.description || ''} ${item.summary || ''} ${item.content || ''}`;

    // Tier 1: Absolute Hate/Extremist Block (skips whitelisted curated publishers to avoid false positives)
    if (!isWhitelistedPopular && BLOCKED_EXTREMISM_REGEX.test(textBlob)) {
      isEntireFeedBlocked = true;
      break;
    }

    // Tier 2: Sensitive News Tagging
    const isSensitive = SENSITIVE_NEWS_REGEX.test(textBlob);

    processed.push(Object.assign({}, item, {
      isSensitive,
      safety: {
        status: isSensitive ? 'sensitive' : 'clean',
        isSensitive
      }
    }));
  }

  if (isEntireFeedBlocked) {
    return { blocked: true, items: [] };
  }

  return { blocked: false, items: processed };
}

function canonicalizeFeedUrl(raw) {
  let input = String(raw || '').trim();
  if (!input) throw new Error('empty');
  if (!/^https?:\/\//i.test(input)) input = 'https://' + input;

  let parsed;
  try {
    parsed = new URL(input);
  } catch (e) {
    throw new Error('invalid');
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') throw new Error('protocol');
  parsed.hostname = parsed.hostname.toLowerCase();
  if (isDisallowedHost(parsed.hostname)) {
    throw new Error('ssrf_blocked');
  }
  if ((parsed.protocol === 'https:' && parsed.port === '443') ||
      (parsed.protocol === 'http:' && parsed.port === '80')) {
    parsed.port = '';
  }

  const host = parsed.hostname.replace(/^www\./, '');
  if (host === 'bbc.co.uk' || host === 'bbc.com') {
    return 'https://feeds.bbci.co.uk/news/rss.xml';
  }
  if (host === 'nasa.gov' && (parsed.pathname === '/' || parsed.pathname === '')) {
    return 'https://www.nasa.gov/rss/dyn/breaking_news.rss';
  }

  const drop = [];
  parsed.searchParams.forEach((_, key) => {
    if (FEED_TRACKING_PARAMS.has(key.toLowerCase())) drop.push(key);
  });
  drop.forEach((key) => parsed.searchParams.delete(key));

  const entries = [];
  parsed.searchParams.forEach((value, key) => entries.push([key, value]));
  entries.sort((a, b) => a[0].localeCompare(b[0]));
  parsed.search = '';
  entries.forEach(([k, v]) => parsed.searchParams.append(k, v));

  // Preserve user path structure while normalizing duplicate consecutive slashes
  let path = parsed.pathname || '/';
  path = path.replace(/\/{2,}/g, '/');
  parsed.pathname = path;
  let out = parsed.toString();
  out = out.replace(/%2A/gi, '*');
  return out;
}

/**
 * Generates alternate slash variant URL (flips trailing slash on non-root paths).
 * Used by the Resilient Fetch Engine for adaptive 404/403 recovery on strict routing endpoints.
 */
function getSlashVariantUrl(rawUrl) {
  try {
    const u = new URL(rawUrl);
    if (u.pathname.length <= 1) return null;
    if (u.pathname.endsWith('/')) {
      u.pathname = u.pathname.replace(/\/+$/, '');
    } else {
      u.pathname = u.pathname + '/';
    }
    return u.toString();
  } catch (e) {
    return null;
  }
}

function canonicalizeArticleUrl(raw, baseUrl) {
  if (!raw) return '';
  let href = String(raw).trim();
  if (!href || href === '#') return '';
  try {
    const parsed = new URL(href, baseUrl || undefined);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return '';
    parsed.hash = '';
    parsed.hostname = parsed.hostname.toLowerCase();
    if ((parsed.protocol === 'https:' && parsed.port === '443') ||
        (parsed.protocol === 'http:' && parsed.port === '80')) {
      parsed.port = '';
    }
    const drop = [];
    parsed.searchParams.forEach((_, key) => {
      if (ARTICLE_TRACKING_PARAMS.has(key.toLowerCase())) drop.push(key);
    });
    drop.forEach((key) => parsed.searchParams.delete(key));
    if (parsed.pathname.length > 1) {
      parsed.pathname = parsed.pathname.replace(/\/+$/, '');
    }
    return parsed.toString();
  } catch (e) {
    return '';
  }
}

function toIsoUtc(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  return d.toISOString();
}

function displayDate(isoOrRaw) {
  if (!isoOrRaw) return '';
  const d = new Date(isoOrRaw);
  if (isNaN(d.getTime())) return String(isoOrRaw);
  return d.toUTCString();
}

function simpleHash(str) {
  let h = 5381;
  const s = String(str || '');
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h) + s.charCodeAt(i);
  }
  return (h >>> 0).toString(16);
}

function normalizeWhitespace(text) {
  return String(text || '').replace(/\s+/g, ' ').trim();
}

function titleKeyForDedupe(title) {
  let t = normalizeWhitespace(title || '');
  t = t.replace(/^\[Live Updates\]\s*/i, '');
  t = t.replace(/^WATCH:\s*/i, '');
  t = t.replace(/^Breaking:\s*/i, '');
  return t.toLowerCase();
}

function canonicalizeArticle(raw, meta, feedUrl) {
  const title = normalizeWhitespace(cleanText(stripHtml(raw.title || 'Untitled'))) || 'Untitled';
  const url = canonicalizeArticleUrl(raw.link || raw.guid, feedUrl || raw.link);
  const publishedAt = toIsoUtc(raw.publishedAt || raw.pubDate || '');
  const updatedAt = toIsoUtc(raw.updatedAt || '') || publishedAt;
  const guid = normalizeWhitespace(raw.guid || '');
  const id = guid || url || simpleHash(titleKeyForDedupe(title) + '|' + publishedAt + '|' + (meta && meta.title || feedUrl));
  const summary = normalizeWhitespace(cleanText(stripHtml(raw.description || ''))).slice(0, 400);
  let image = raw.image && isUsableHeroImage(raw.image) ? raw.image : '';
  if (image) {
    try { image = new URL(image, url || feedUrl).href; } catch (e) {}
    if (!isUsableHeroImage(image)) image = '';
  }
  return {
    id,
    title,
    url: url || raw.link || '',
    link: url || raw.link || '',
    publishedAt,
    updatedAt,
    pubDate: displayDate(publishedAt || raw.pubDate),
    author: normalizeWhitespace(cleanText(stripHtml(raw.author || ''))),
    summary,
    description: summary,
    image,
    source: (meta && meta.title) || 'RSS'
  };
}

function dedupeItems(items) {
  const seen = new Set();
  const out = [];
  for (const item of items) {
    const urlKey = (item.url || item.link || '').replace(/\/+$/, '').toLowerCase();
    const titleDay = titleKeyForDedupe(item.title);
    const keys = [
      item.id,
      urlKey,
      item.id ? '' : simpleHash(titleDay + '|' + (item.publishedAt || '')),
      titleDay.length >= 12 ? titleDay + '|' + (item.publishedAt || '').slice(0, 10) : ''
    ].filter(Boolean);
    let dup = false;
    for (const k of keys) {
      if (seen.has(k)) { dup = true; break; }
    }
    if (dup) continue;
    keys.forEach((k) => seen.add(k));
    out.push(item);
    if (out.length >= 50) break;
  }
  return out;
}

/**
 * Pre-warms the Edge Cache for all popular feeds.
 * Called by the scheduled handler every 6 hours, and optionally via /api/warm-cache.
 */
async function warmPopularFeeds(workerOrigin) {
  const results = [];
  for (const feedUrl of POPULAR_FEEDS) {
    try {
      const warmUrl = `${workerOrigin}/api/view?url=${encodeURIComponent(feedUrl)}&nocache=1`;
      const res = await fetch(warmUrl, { signal: AbortSignal.timeout(20000) });
      const status = res.ok ? 'warmed' : `failed-${res.status}`;
      results.push({ feed: feedUrl, status });
      console.log(`[Feedometer] Warm-cache ${status}: ${feedUrl}`);
    } catch (e) {
      results.push({ feed: feedUrl, status: `error: ${e.message}` });
      console.error(`[Feedometer] Warm-cache error for ${feedUrl}:`, e.message);
    }
  }
  return results;
}

/**
 * Extracts target URL list from GET query params or POST JSON payload.
 */
async function extractTargetUrlsFromRequest(request, url) {
  const targets = new Set();
  const qUrl = url.searchParams.get('url');
  if (qUrl) targets.add(qUrl.trim());

  const qUrls = url.searchParams.get('urls');
  if (qUrls) {
    qUrls.split(',').map(s => s.trim()).filter(Boolean).forEach(u => targets.add(u));
  }

  if (request.method === 'POST') {
    try {
      const body = await request.clone().json();
      if (body.url && typeof body.url === 'string') targets.add(body.url.trim());
      if (Array.isArray(body.urls)) {
        body.urls.forEach(u => {
          if (u && typeof u === 'string' && u.trim()) targets.add(u.trim());
        });
      }
    } catch (e) {}
  }
  return Array.from(targets);
}

/**
 * Route: /api/purge-cache or /api/cache/purge
 * Delete Worker Cache API entries for single or multiple feed/site URLs (view + build + og).
 */
async function handlePurgeCache(request, url) {
  const rawUrls = await extractTargetUrlsFromRequest(request, url);
  if (!rawUrls.length) {
    return jsonResponse({ ok: false, error: 'Missing feed URL(s). Provide ?url=, ?urls=, or POST { urls: [...] }' }, 400);
  }

  const cache = caches.default;
  const origin = url.origin;
  const results = [];
  let totalPurgedKeys = 0;

  for (const rawTarget of rawUrls) {
    const deleted = [];
    let feedUrl = '';
    let siteUrl = '';

    try { feedUrl = canonicalizeFeedUrl(rawTarget); } catch (e) {}
    try { siteUrl = canonicalizeSiteUrl(rawTarget); } catch (e) {}

    if (feedUrl) {
      const viewKey = viewCacheKey(origin, feedUrl);
      const ok = await cache.delete(viewKey);
      if (ok) {
        deleted.push('view');
        totalPurgedKeys++;
      }
    }

    if (siteUrl) {
      const buildUrl = new URL('/api/build', origin);
      buildUrl.searchParams.set('url', siteUrl);
      if (await cache.delete(new Request(buildUrl.toString(), { method: 'GET' }))) {
        deleted.push('build');
        totalPurgedKeys++;
      }
      buildUrl.searchParams.set('format', 'xml');
      if (await cache.delete(new Request(buildUrl.toString(), { method: 'GET' }))) {
        deleted.push('build-xml');
        totalPurgedKeys++;
      }
    }

    // Also purge OpenGraph cache if exists
    const ogUrl = new URL('/api/og', origin);
    ogUrl.searchParams.set('url', rawTarget);
    if (await cache.delete(new Request(ogUrl.toString(), { method: 'GET' }))) {
      deleted.push('og');
      totalPurgedKeys++;
    }

    results.push({
      url: rawTarget,
      canonical: feedUrl || siteUrl || rawTarget,
      purged: deleted.length > 0,
      deletedKeys: deleted,
      status: deleted.length > 0 ? 'PURGED' : 'NOT_FOUND_IN_CACHE'
    });
  }

  return jsonResponse({
    ok: true,
    action: 'purge',
    totalRequested: rawUrls.length,
    totalPurgedKeys,
    results,
    timestamp: new Date().toISOString()
  });
}

/**
 * Route: /api/cache/purge-all or /api/purge-all
 * Flushes all popular feeds and any provided targets from Cloudflare Edge Cache.
 */
async function handlePurgeAllCache(request, url) {
  const extraUrls = await extractTargetUrlsFromRequest(request, url);
  const cache = caches.default;
  const origin = url.origin;
  const targetSet = new Set([...POPULAR_FEEDS, ...extraUrls]);
  const results = [];
  let totalPurgedKeys = 0;

  for (const feedUrl of targetSet) {
    const deleted = [];
    try {
      const canonical = canonicalizeFeedUrl(feedUrl);
      const viewKey = viewCacheKey(origin, canonical);
      if (await cache.delete(viewKey)) {
        deleted.push('view');
        totalPurgedKeys++;
      }
    } catch (e) {}

    results.push({
      url: feedUrl,
      purged: deleted.length > 0,
      deletedKeys: deleted
    });
  }

  return jsonResponse({
    ok: true,
    action: 'purge-all',
    message: `Successfully flushed edge cache for ${targetSet.size} registered feed targets.`,
    totalFeeds: targetSet.size,
    totalPurgedKeys,
    popularFeedsCount: POPULAR_FEEDS.length,
    timestamp: new Date().toISOString()
  });
}

/**
 * Route: /api/warm-cache or /api/cache/refresh
 * Re-fetches upstream live feed content (bypassing cache) and repopulates Edge Cache.
 */
async function handleCacheRefresh(request, url, ctx) {
  const rawUrls = await extractTargetUrlsFromRequest(request, url);
  const targetUrls = rawUrls.length ? rawUrls : POPULAR_FEEDS;
  const isSync = url.searchParams.get('sync') === '1' || targetUrls.length <= 25;
  const origin = url.origin;

  if (!isSync) {
    if (ctx && ctx.waitUntil) {
      ctx.waitUntil((async () => {
        for (const feedUrl of targetUrls) {
          try {
            const warmUrl = `${origin}/api/view?url=${encodeURIComponent(feedUrl)}&nocache=1`;
            await fetch(warmUrl, { signal: AbortSignal.timeout(25000) });
          } catch (e) {}
        }
      })());
    }
    return jsonResponse({
      ok: true,
      action: 'refresh-async',
      message: `Re-warming ${targetUrls.length} feeds in background at Cloudflare Edge.`,
      total: targetUrls.length,
      timestamp: new Date().toISOString()
    });
  }

  const results = [];
  const concurrency = 4;
  let cursor = 0;

  async function workerPool() {
    while (cursor < targetUrls.length) {
      const idx = cursor++;
      const feedUrl = targetUrls[idx];
      const start = Date.now();
      try {
        const warmUrl = `${origin}/api/view?url=${encodeURIComponent(feedUrl)}&nocache=1`;
        const res = await fetch(warmUrl, {
          headers: { 'User-Agent': 'Feedometer-CacheAdmin/1.0' },
          signal: AbortSignal.timeout(25000)
        });
        const latencyMs = Date.now() - start;
        let data = null;
        try { data = await res.json(); } catch (e) {}

        results.push({
          url: feedUrl,
          ok: res.ok && data && data.ok === true,
          status: res.status,
          title: (data && data.meta && data.meta.title) || (data && data.meta && data.meta.feedTitle) || '',
          itemCount: (data && data.items && data.items.length) || (data && data.total) || 0,
          latencyMs,
          cachedTtl: (data && data.cached) || '24h',
          error: (!res.ok || (data && !data.ok)) ? ((data && data.error) || `HTTP ${res.status}`) : null
        });
      } catch (err) {
        results.push({
          url: feedUrl,
          ok: false,
          status: 0,
          latencyMs: Date.now() - start,
          error: err.message || 'Fetch timeout'
        });
      }
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, targetUrls.length) }, () => workerPool());
  await Promise.all(workers);

  const successful = results.filter(r => r.ok).length;

  return jsonResponse({
    ok: true,
    action: 'refresh',
    total: targetUrls.length,
    successful,
    failed: targetUrls.length - successful,
    results,
    timestamp: new Date().toISOString()
  });
}

/**
 * Route: /api/cache/status or /api/cache/inspect
 * Inspects whether one or more URLs are currently cached in Cloudflare Edge Cache.
 */
async function handleCacheStatus(request, url) {
  const rawUrls = await extractTargetUrlsFromRequest(request, url);
  if (!rawUrls.length) {
    return jsonResponse({ ok: false, error: 'Missing feed URL(s). Provide ?url= or ?urls=' }, 400);
  }

  const cache = caches.default;
  const origin = url.origin;
  const results = [];

  for (const rawTarget of rawUrls) {
    let canonical = '';
    try { canonical = canonicalizeFeedUrl(rawTarget); } catch (e) {}

    if (!canonical) {
      results.push({ url: rawTarget, valid: false, cached: false, error: 'Invalid feed URL' });
      continue;
    }

    const cacheKey = viewCacheKey(origin, canonical);
    const cachedResponse = await cache.match(cacheKey);

    if (cachedResponse) {
      let data = null;
      try {
        const cloned = cachedResponse.clone();
        data = await cloned.json();
      } catch (e) {}

      results.push({
        url: rawTarget,
        canonical,
        cached: true,
        cacheHeader: cachedResponse.headers.get('X-Feedometer-Cache') || 'HIT',
        lastFetched: cachedResponse.headers.get('X-Feedometer-Fetched') || (data && data.meta && data.meta.lastFetched) || null,
        title: (data && data.meta && data.meta.title) || '',
        itemCount: (data && data.items && data.items.length) || 0,
        cacheControl: cachedResponse.headers.get('Cache-Control') || ''
      });
    } else {
      results.push({
        url: rawTarget,
        canonical,
        cached: false,
        status: 'CACHE_MISS'
      });
    }
  }

  return jsonResponse({
    ok: true,
    action: 'status',
    total: rawUrls.length,
    cachedCount: results.filter(r => r.cached).length,
    results,
    timestamp: new Date().toISOString()
  });
}

/**
 * Route: /api/build?url=...
 * Fetch HTML on the Worker, extract articles, canonicalize, emit RSS 2.0 JSON+XML.
 */
async function handleBuildFeed(request, url, ctx) {
  const targetUrl = url.searchParams.get('url');
  if (!targetUrl) {
    return jsonResponse({ ok: false, error: 'Missing ?url= parameter' }, 400);
  }

  let formattedUrl;
  try {
    formattedUrl = canonicalizeSiteUrl(targetUrl);
  } catch (e) {
    if (e && e.message === 'ssrf_blocked') {
      return jsonResponse({
        ok: false,
        code: 'ssrf_blocked',
        error: 'Access to private or restricted network addresses is prohibited.'
      }, 403);
    }
    return jsonResponse({ ok: false, error: 'Invalid site URL' }, 400);
  }

  const cache = caches.default;
  const cacheUrl = new URL('/api/build', url.origin);
  cacheUrl.searchParams.set('url', formattedUrl);
  if (url.searchParams.get('format') === 'xml') {
    cacheUrl.searchParams.set('format', 'xml');
  }
  const cacheKey = new Request(cacheUrl.toString(), { method: 'GET' });
  const noCache = url.searchParams.get('nocache') === '1';

  if (!noCache) {
    const cached = await cache.match(cacheKey);
    if (cached) {
      const resp = new Response(cached.body, cached);
      resp.headers.set('X-Feedometer-Cache', 'HIT');
      return resp;
    }
  }

  let html = '';
  let fromJina = false;
  try {
    const htmlRes = await fetch(formattedUrl, {
      headers: fetchHeadersForHtml(formattedUrl),
      redirect: 'follow',
      signal: AbortSignal.timeout(12000)
    });
    if (htmlRes.status === 429 || htmlRes.status === 503) {
      return jsonResponse({
        ok: false,
        code: 'capacity',
        error: 'Free builder is busy. Try again in a few hours.'
      }, htmlRes.status);
    }
    if (htmlRes.ok) html = await htmlRes.text();
  } catch (e) {}

  if (!html || html.length < 500) {
    try {
      const jinaRes = await fetch('https://r.jina.ai/' + formattedUrl, {
        headers: { 'Accept': 'text/html, text/plain, */*', 'User-Agent': BROWSER_UA },
        signal: AbortSignal.timeout(12000)
      });
      if (jinaRes.ok) {
        html = await jinaRes.text();
        fromJina = true;
      }
    } catch (e2) {}
  }

  if (!html || html.length < 100) {
    return jsonResponse({
      ok: false,
      error: 'Could not access this website. The site may be blocking automated requests.'
    }, 403);
  }

  let parsed;
  if (fromJina || looksLikeJinaMarkdown(html)) {
    parsed = scrapeArticlesFromJinaMarkdown(html, formattedUrl);
    if (!parsed.items.length) {
      parsed = scrapeArticlesFromHtml(html, formattedUrl);
    }
  } else {
    parsed = scrapeArticlesFromHtml(html, formattedUrl);
    if (parsed.items.length < 3 && looksLikeJinaMarkdown(html)) {
      parsed = scrapeArticlesFromJinaMarkdown(html, formattedUrl);
    }
  }

  let items = (parsed.items || []).map((raw) => canonicalizeArticle(raw, parsed.meta, formattedUrl));
  items = dedupeItems(items).slice(0, 25);

  if (!items.length) {
    return jsonResponse({
      ok: false,
      error: 'No articles or blog posts could be automatically detected on this webpage.'
    }, 422);
  }

  const xmlString = constructRssXml(parsed.meta, items);
  const payload = {
    ok: true,
    schemaVersion: SCHEMA_VERSION,
    siteUrl: formattedUrl,
    meta: parsed.meta,
    items,
    xml: xmlString,
    total: items.length
  };

  const asXml = url.searchParams.get('format') === 'xml';
  let finalResponse;
  if (asXml) {
    finalResponse = new Response(xmlString, {
      status: 200,
      headers: {
        ...CORS_HEADERS,
        'Content-Type': 'application/rss+xml; charset=utf-8',
        'Cache-Control': `public, max-age=${BUILD_CACHE_TTL}, s-maxage=${BUILD_CACHE_TTL}`
      }
    });
  } else {
    finalResponse = jsonResponse(payload, 200, BUILD_CACHE_TTL);
  }
  finalResponse.headers.set('X-Feedometer-Cache', 'MISS');

  if (ctx && ctx.waitUntil) {
    ctx.waitUntil(cache.put(cacheKey, finalResponse.clone()));
  }

  return finalResponse;
}

function canonicalizeSiteUrl(raw) {
  let input = String(raw || '').trim();
  if (!input) throw new Error('empty');
  if (!/^https?:\/\//i.test(input)) input = 'https://' + input;
  let parsed;
  try {
    parsed = new URL(input);
  } catch (e) {
    throw new Error('invalid');
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') throw new Error('protocol');
  parsed.hostname = parsed.hostname.toLowerCase();
  if (isDisallowedHost(parsed.hostname)) {
    throw new Error('ssrf_blocked');
  }
  if ((parsed.protocol === 'https:' && parsed.port === '443') ||
      (parsed.protocol === 'http:' && parsed.port === '80')) {
    parsed.port = '';
  }
  const host = parsed.hostname.replace(/^www\./, '');
  if (host === 'bbc.co.uk' || host === 'bbc.com') {
    return 'https://www.bbc.com/';
  }
  const drop = [];
  parsed.searchParams.forEach((_, key) => {
    if (FEED_TRACKING_PARAMS.has(key.toLowerCase())) drop.push(key);
  });
  drop.forEach((key) => parsed.searchParams.delete(key));
  parsed.hash = '';
  let path = parsed.pathname || '/';
  if (path.length > 1) path = path.replace(/\/+$/, '');
  parsed.pathname = path || '/';
  return parsed.toString();
}

function looksLikeJinaMarkdown(text) {
  if (!text) return false;
  if (/Title:\s*.+/i.test(text.slice(0, 400))) return true;
  if ((text.match(/\]\(https?:\/\//g) || []).length >= 5 && !/<article[\s>]/i.test(text)) return true;
  return false;
}

/**
 * Route: /api/og?url=...
 * Extract OpenGraph image & description
 */
async function handleOgExtract(request, url, ctx) {
  const targetUrl = url.searchParams.get('url');
  if (!targetUrl) {
    return jsonResponse({ ok: false, error: 'Missing ?url=' }, 400);
  }

  const cache = caches.default;
  const cacheKey = new Request(url.toString(), request);
  const cached = await cache.match(cacheKey);
  if (cached) return cached;

  try {
    const res = await fetch(targetUrl, {
      headers: fetchHeadersForHtml(targetUrl),
      redirect: 'follow',
      signal: AbortSignal.timeout(10000)
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const html = await res.text();
    const finalUrl = res.url || targetUrl;
    const ogImage = extractBestHeroImageFromHtml(html, finalUrl);
    const ogTitle = extractMetaTag(html, 'og:title') || extractMetaTag(html, 'title') || '';
    const ogDesc = extractMetaTag(html, 'og:description') || extractMetaTag(html, 'description') || '';

    const resp = jsonResponse({
      ok: true,
      url: targetUrl,
      image: ogImage,
      title: ogTitle,
      description: ogDesc
    }, 200, 21600); // 6-hour cache

    if (ctx && ctx.waitUntil) ctx.waitUntil(cache.put(cacheKey, resp.clone()));
    return resp;
  } catch (e) {
    return jsonResponse({ ok: false, error: e.message }, 200, 300);
  }
}

/* ========================================================================= */
/* SECTION: RSS AUTODISCOVERY ENGINE (HTML Webpages -> Embedded RSS Feeds)   */
/* Scans HTML <head> for <link rel="alternate" type="application/rss+xml">   */
/* ========================================================================= */

function discoverFeedUrlFromHtml(html, pageUrl) {
  if (!html || typeof html !== 'string') return null;
  const headCut = html.indexOf('</head>');
  const searchArea = headCut !== -1 ? html.slice(0, headCut + 7) : html.slice(0, 120000);
  const linkRe = /<link\b[^>]*?>/gi;
  let match;
  const candidates = [];

  while ((match = linkRe.exec(searchArea)) !== null) {
    const tag = match[0];
    const rel = (extractAttrFromTag(tag, 'rel') || '').toLowerCase();
    const type = (extractAttrFromTag(tag, 'type') || '').toLowerCase();
    const href = extractAttrFromTag(tag, 'href');

    if (!href || href === '#' || href.startsWith('javascript:')) continue;

    const isAlternateOrFeed = /\b(alternate|feed)\b/i.test(rel);
    if (!isAlternateOrFeed && !type.includes('rss') && !type.includes('atom')) continue;

    if (
      type === 'application/rss+xml' ||
      type === 'application/atom+xml' ||
      type === 'application/feed+json' ||
      type === 'application/json' ||
      type === 'application/xml' ||
      type === 'text/xml'
    ) {
      const resolved = resolveUrl(href, pageUrl);
      if (resolved) {
        const priority = (type.includes('rss') || type.includes('atom')) ? 1 : 2;
        candidates.push({ url: resolved, priority });
      }
    }
  }

  if (candidates.length > 0) {
    candidates.sort((a, b) => a.priority - b.priority);
    return candidates[0].url;
  }
  return null;
}

// ── Feedometer Engine 2.0: Universal Namespace-Agnostic XML Parser ──

function looksLikeFeedXml(text) {
  if (!text) return false;
  return /<\s*(?:[a-zA-Z0-9_-]+:)?(?:rss|feed|RDF)\b/i.test(text);
}

function xmlBeforeItems(xml) {
  const cut = String(xml || '').search(/<\s*(?:[a-zA-Z0-9_-]+:)?(?:item|entry)\b/i);
  return cut === -1 ? xml : xml.slice(0, cut);
}

function titleFromHost(baseUrl) {
  try {
    let host = new URL(baseUrl).hostname.replace(/^www\./i, '');
    host = host.replace(/^(feeds?|rss|atom|syndication|xml)\./i, '');
    host = host.replace(/\.(co|com|org|net|gov|ac)\.[a-z]{2}$/i, '');
    host = host.replace(/\.[a-z]{2,}$/i, '');
    if (host) return host;
  } catch (e) {}
  return '';
}

function titlesAreSame(a, b) {
  const x = normalizeWhitespace(String(a || '')).toLowerCase();
  const y = normalizeWhitespace(String(b || '')).toLowerCase();
  return !!(x && y && x === y);
}

function resolveFeedTitle(channelTitle, items, baseUrl, homeLink) {
  let t = cleanText(stripHtml(channelTitle || ''));
  const first = items[0] && items[0].title;
  if (!t || titlesAreSame(t, first)) {
    const fromHost = titleFromHost(homeLink || baseUrl);
    if (fromHost) t = fromHost.charAt(0).toUpperCase() + fromHost.slice(1);
    else if (titlesAreSame(t, first)) t = '';
  }
  return t || 'RSS Feed';
}

function parseJsonFeed(json, fallbackUrl) {
  if (!json || typeof json !== 'object') return null;
  const meta = {
    title: json.title || '',
    description: json.description || '',
    link: json.home_page_url || fallbackUrl,
    url: json.feed_url || fallbackUrl,
    feedTitle: json.title || '',
    feedHomeUrl: json.home_page_url || fallbackUrl,
    feedIcon: json.icon || json.favicon || ''
  };

  const rawItems = Array.isArray(json.items) ? json.items : [];
  if (!rawItems.length) return null;

  const items = rawItems.map(item => {
    let authorName = '';
    if (typeof item.author === 'string') authorName = item.author;
    else if (item.author && item.author.name) authorName = item.author.name;
    else if (Array.isArray(item.authors) && item.authors[0] && item.authors[0].name) authorName = item.authors[0].name;

    return {
      title: item.title || 'Untitled',
      link: item.url || item.id || '',
      url: item.url || item.id || '',
      guid: item.id || item.guid || item.url || '',
      description: item.summary || item.content_text || item.content_html || '',
      pubDate: item.date_published || item.date_modified || '',
      publishedAt: item.date_published || item.date_modified || '',
      updatedAt: item.date_modified || item.date_published || '',
      author: authorName,
      image: item.image || item.banner_image || ''
    };
  });

  return { meta, items };
}

function parseFeedXml(xml, baseUrl) {
  const isAtom = /<\s*(?:[a-zA-Z0-9_-]+:)?feed\b/i.test(xml) && !/<\s*(?:[a-zA-Z0-9_-]+:)?rss\b/i.test(xml);
  const head = xmlBeforeItems(xml);
  let meta = { title: '', description: '', link: baseUrl };
  let items = [];

  if (isAtom) {
    meta.title = cleanText(stripHtml(extractTagContent(head, 'title'))) || titleFromHost(baseUrl) || 'Atom Feed';
    meta.description = cleanText(stripHtml(extractTagContent(head, 'subtitle'))) || '';
    const rawFeedLink = extractAttr(head, 'link', 'href') || baseUrl;
    meta.link = rawFeedLink.startsWith('/') ? resolveUrl(rawFeedLink, baseUrl) : rawFeedLink;
    meta.feedIcon = pickFeedIcon(head, baseUrl);

    const entryRegex = /<\s*(?:[a-zA-Z0-9_-]+:)?entry\b[\s\S]*?<\/\s*(?:[a-zA-Z0-9_-]+:)?entry>/gi;
    let match;
    while ((match = entryRegex.exec(xml)) !== null && items.length < 80) {
      const entryXml = match[0];
      const title = extractTagContent(entryXml, 'title') || 'Untitled';
      const rawLink = extractAttr(entryXml, 'link', 'href') || extractTagContent(entryXml, 'id') || '#';
      const link = rawLink.startsWith('/') ? resolveUrl(rawLink, meta.link || baseUrl) : rawLink;
      const summary = extractTagContent(entryXml, 'summary') || '';
      const content = extractTagContent(entryXml, 'content') || '';
      const published = extractTagContent(entryXml, 'published') || '';
      const updated = extractTagContent(entryXml, 'updated') || '';
      const guid = extractTagContent(entryXml, 'id') || '';
      const author = extractTagContent(entryXml, 'name') || '';
      const entryLink = link;
      const image = extractItemImage(entryXml, summary + '\n' + content, entryLink);

      items.push({
        title: cleanText(title),
        link,
        guid,
        author,
        description: cleanText(stripHtml(summary || content)).slice(0, 400),
        pubDate: published || updated,
        publishedAt: published || updated,
        updatedAt: updated,
        image
      });
    }
  } else {
    meta.title = cleanText(stripHtml(extractTagContent(head, 'title'))) || titleFromHost(baseUrl) || 'RSS Feed';
    meta.description = cleanText(stripHtml(extractTagContent(head, 'description'))) || '';
    const rawFeedLink = extractTagContent(head, 'link') || baseUrl;
    meta.link = rawFeedLink.startsWith('/') ? resolveUrl(rawFeedLink, baseUrl) : rawFeedLink;

    meta.feedIcon = pickFeedIcon(head, baseUrl);

    const itemRegex = /<\s*(?:[a-zA-Z0-9_-]+:)?item\b[\s\S]*?<\/\s*(?:[a-zA-Z0-9_-]+:)?item>/gi;
    let match;
    while ((match = itemRegex.exec(xml)) !== null && items.length < 80) {
      const itemXml = match[0];
      const title = extractTagContent(itemXml, 'title') || 'Untitled';
      const rawLink = extractTagContent(itemXml, 'link') || extractTagContent(itemXml, 'guid') || '#';
      const itemLink = rawLink.startsWith('/') ? resolveUrl(rawLink.trim(), meta.link || baseUrl) : rawLink.trim();
      const guid = extractTagContent(itemXml, 'guid') || '';
      const desc = extractTagContent(itemXml, 'description') || '';
      const encoded = extractTagContent(itemXml, 'content:encoded') || '';
      const pubDate = extractTagContent(itemXml, 'pubDate') || extractTagContent(itemXml, 'dc:date') || '';
      const author = extractTagContent(itemXml, 'dc:creator') || extractTagContent(itemXml, 'author') || '';
      const image = extractItemImage(itemXml, encoded || desc, itemLink);

      items.push({
        title: cleanText(title),
        link: itemLink,
        guid,
        author,
        description: cleanText(stripHtml(desc || encoded)).slice(0, 400),
        pubDate,
        publishedAt: pubDate,
        updatedAt: '',
        image
      });
    }
  }

  meta.title = resolveFeedTitle(meta.title, items, baseUrl, meta.link);
  return { meta, items };
}

function scrapeArticlesFromHtml(html, baseUrl) {
  let title = extractMetaTag(html, 'og:site_name') || extractTagContent(html, 'title') || '';
  try { if (!title) title = new URL(baseUrl).hostname; } catch (e) { title = 'Feed'; }
  let description = extractMetaTag(html, 'og:description') || extractMetaTag(html, 'description') || `RSS Feed for ${baseUrl}`;

  const items = [];
  const seenLinks = new Set();

  function pushItem(link, titleText, snippet, img, pubDate) {
    const abs = canonicalizeArticleUrl(link, baseUrl) || resolveUrl(link, baseUrl);
    if (!abs || abs.startsWith('#') || /^javascript:/i.test(abs)) return;
    if (/\.(png|jpe?g|webp|gif|svg)(\?|$)/i.test(abs)) return;
    if (/\/(terms|privacy|cookies|contact)(\/|$)/i.test(abs)) return;
    const key = abs.replace(/\/+$/, '').toLowerCase();
    if (seenLinks.has(key)) return;
    seenLinks.add(key);
    const heading = cleanText(stripHtml(titleText || '')).slice(0, 180);
    if (heading.length < 6) return;
    items.push({
      title: heading,
      link: abs,
      description: cleanText(stripHtml(snippet || '')).slice(0, 280),
      image: img ? resolveUrl(img, baseUrl) : '',
      pubDate: pubDate || new Date().toUTCString()
    });
  }

  const articleRegex = /<article[\s\S]*?<\/article>/gi;
  let match;
  while ((match = articleRegex.exec(html)) !== null && items.length < 25) {
    const artHtml = match[0];
    const linkMatch = artHtml.match(/<a\s+(?:[^>]*?\s+)?href=["']([^"']+)["']/i);
    const titleMatch = artHtml.match(/<h[1-4][^>]*>([\s\S]*?)<\/h[1-4]>/i);
    const pMatch = artHtml.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
    const timeMatch = artHtml.match(/<time[^>]*(?:datetime=["']([^"']+)["'])?[^>]*>([\s\S]*?)<\/time>/i);
    if (linkMatch) {
      const img = extractImgSrc(artHtml, baseUrl);
      pushItem(
        linkMatch[1],
        titleMatch ? titleMatch[1] : '',
        pMatch ? pMatch[1] : '',
        img && isUsableHeroImage(img) ? img : '',
        timeMatch ? (timeMatch[1] || timeMatch[2]) : ''
      );
    }
  }

  if (items.length < 3) {
    const headingLinkRe = /<h[1-3][^>]*>\s*<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
    while ((match = headingLinkRe.exec(html)) !== null && items.length < 25) {
      pushItem(match[1], match[2], '', '', '');
    }
  }

  return { meta: { title: cleanText(stripHtml(title)), description: cleanText(stripHtml(description)), link: baseUrl }, items };
}

function scrapeArticlesFromJinaMarkdown(markdown, baseUrl) {
  const titleMatch = markdown.match(/Title:\s*(.+)/i);
  let pageTitle = titleMatch ? titleMatch[1].trim() : '';
  try { if (!pageTitle) pageTitle = new URL(baseUrl).hostname; } catch (e) { pageTitle = 'Feed'; }
  const meta = {
    title: pageTitle,
    description: `RSS feed for ${pageTitle} generated via Feedometer`,
    link: baseUrl
  };
  const items = [];
  const seenLinks = new Set();
  const linkRegex = /\[([^\]]{10,180})\]\((https?:\/\/[^\s\)]+)\)/g;
  let match;
  while ((match = linkRegex.exec(markdown)) !== null && items.length < 25) {
    const title = match[1].trim();
    const link = match[2].trim();
    if (title.startsWith('!') || title.startsWith('Image ')) continue;
    if (/\.(png|jpe?g|webp|gif|svg)/i.test(link)) continue;
    if (/\/(terms|privacy|cookies|contact)/i.test(link)) continue;
    const key = link.replace(/\/+$/, '').toLowerCase();
    if (seenLinks.has(key)) continue;
    seenLinks.add(key);
    items.push({
      title: cleanText(title),
      link,
      description: `Article from ${pageTitle}: ${title}`,
      image: '',
      pubDate: new Date().toUTCString()
    });
  }
  return { meta, items };
}

function constructRssXml(meta, items) {
  const now = new Date().toUTCString();
  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  xml += `<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:media="http://search.yahoo.com/mrss/">\n`;
  xml += `  <channel>\n`;
  xml += `    <title><![CDATA[${meta.title}]]></title>\n`;
  xml += `    <link>${escapeXml(meta.link)}</link>\n`;
  xml += `    <description><![CDATA[${meta.description}]]></description>\n`;
  xml += `    <lastBuildDate>${now}</lastBuildDate>\n`;
  xml += `    <generator>Feedometer (https://feedometer.pages.dev)</generator>\n`;

  for (const item of items) {
    xml += `    <item>\n`;
    xml += `      <title><![CDATA[${item.title}]]></title>\n`;
    xml += `      <link>${escapeXml(item.link)}</link>\n`;
    xml += `      <guid isPermaLink="true">${escapeXml(item.link)}</guid>\n`;
    xml += `      <pubDate>${item.pubDate || now}</pubDate>\n`;
    if (item.description) {
      xml += `      <description><![CDATA[${item.description}]]></description>\n`;
    }
    if (item.image) {
      xml += `      <media:content url="${escapeXml(item.image)}" medium="image" />\n`;
    }
    xml += `    </item>\n`;
  }

  xml += `  </channel>\n`;
  xml += `</rss>`;
  return xml;
}

function extractTagContent(xml, tag) {
  const cleanTag = tag.includes(':') ? tag.split(':')[1] : tag;
  const re = new RegExp(
    `<(?:[a-zA-Z0-9_-]+:)?${cleanTag}\\b(?![^>]*\\/>)[^>]*>\\s*(?:<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>|([\\s\\S]*?))\\s*<\\/(?:[a-zA-Z0-9_-]+:)?${cleanTag}>`,
    'i'
  );
  const m = re.exec(xml || '');
  if (!m) return '';
  return (m[1] !== undefined ? m[1] : m[2]) || '';
}

function extractAttr(xml, tag, attr) {
  const cleanTag = tag.includes(':') ? tag.split(':')[1] : tag;
  const reg = new RegExp(`<(?:[a-zA-Z0-9_-]+:)?${cleanTag}[^>]*\\s+${attr}=["']([^"']+)["'][^>]*>`, 'i').exec(xml);
  return reg ? reg[1] : '';
}

function decodeXmlEntities(str) {
  if (!str) return '';
  function pass(s) {
    return String(s)
      .replace(/&#x([0-9a-f]+);/gi, (_, hex) => {
        const n = parseInt(hex, 16);
        try { return n ? String.fromCodePoint(n) : _; } catch (e) { return _; }
      })
      .replace(/&#(\d+);/g, (_, num) => {
        const n = parseInt(num, 10);
        try { return n ? String.fromCodePoint(n) : _; } catch (e) { return _; }
      })
      .replace(/&nbsp;/gi, ' ')
      .replace(/&rsquo;/gi, '\u2019')
      .replace(/&lsquo;/gi, '\u2018')
      .replace(/&rdquo;/gi, '\u201D')
      .replace(/&ldquo;/gi, '\u201C')
      .replace(/&mdash;/gi, '\u2014')
      .replace(/&ndash;/gi, '\u2013')
      .replace(/&hellip;/gi, '\u2026')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&amp;/g, '&');
  }
  return pass(pass(str));
}

function extractImgSrc(html, baseUrl) {
  if (!html) return '';
  const decoded = decodeXmlEntities(html);
  const imgRe = /<img\b[^>]*>/gi;
  let imgTag;
  while ((imgTag = imgRe.exec(decoded)) !== null) {
    const fromSet = pickBestSrcsetUrl(extractAttrFromTag(imgTag[0], 'srcset'), baseUrl);
    const src = fromSet || extractAttrFromTag(imgTag[0], 'src') ||
      extractAttrFromTag(imgTag[0], 'data-src') ||
      extractAttrFromTag(imgTag[0], 'data-lazy-src') ||
      extractAttrFromTag(imgTag[0], 'data-original');
    if (src && !src.startsWith('data:')) {
      return baseUrl ? resolveUrl(src, baseUrl) : src;
    }
  }
  return '';
}

function pickBestSrcsetUrl(srcset, baseUrl) {
  if (!srcset) return '';
  let best = '';
  let bestScore = -1;
  const parts = String(srcset).split(',');
  for (let i = 0; i < parts.length; i++) {
    const bits = parts[i].trim().split(/\s+/);
    const rawUrl = bits[0];
    if (!rawUrl || rawUrl.startsWith('data:')) continue;
    const desc = bits[1] || '';
    let score = 1;
    const w = /(\d+)w$/i.exec(desc);
    const x = /([\d.]+)x$/i.exec(desc);
    if (w) score = parseInt(w[1], 10);
    else if (x) score = Math.round(parseFloat(x[1]) * 1000);
    if (score > bestScore) {
      bestScore = score;
      best = rawUrl;
    }
  }
  if (!best) return '';
  return baseUrl ? resolveUrl(best, baseUrl) : best;
}

function pickFeedIcon(xml, baseUrl) {
  const candidates = [
    extractAttr(xml, 'itunes:image', 'href'),
    extractTagContent(xml, 'icon')
  ];
  const imageBlock = /<image[\s\S]*?<\/image>/i.exec(xml);
  if (imageBlock) candidates.push(extractTagContent(imageBlock[0], 'url'));
  for (let i = 0; i < candidates.length; i++) {
    const raw = decodeXmlEntities(candidates[i] || '').trim();
    if (!raw || raw.startsWith('data:')) continue;
    const href = resolveUrl(raw, baseUrl);
    if (!href) continue;
    try {
      const u = new URL(href);
      if (u.protocol === 'http:' || u.protocol === 'https:') return href;
    } catch (e) {}
  }
  return '';
}

function extractAttrFromTag(tag, attr) {
  const reg = new RegExp(`\\b${attr}=["']([^"']+)["']`, 'i');
  const m = reg.exec(tag);
  return m ? m[1] : '';
}

function isUsableHeroImage(imageUrl) {
  if (!imageUrl) return false;
  let href = String(imageUrl).trim();
  if (href.indexOf('//') === 0) href = 'https:' + href;
  const u = href.toLowerCase();
  if (!/^https?:\/\//i.test(u)) return false;
  if (u.startsWith('data:')) return false;
  if (/\/favicon(\.|\/|\?|$)/i.test(u) || u.includes('gstatic.com/favicon')) return false;
  if (/apple-touch-icon/i.test(u)) return false;
  if (/\.(ico)(\?|$)/i.test(u)) return false;
  if (/(^|[\/._-])(avatars?|author|authors|sprites?|pixel|1x1|tracking|badge|emoji|sponsor|advert)([\/._-]|$|\?)/i.test(u)) return false;
  if (/\/(site-logo|brand-logo)(\/|\.|$)/i.test(u)) return false;
  return true;
}

function extractBestHeroImageFromHtml(html, pageUrl) {
  if (!html) return '';
  const candidates = [];
  const metaNames = [
    'og:image:secure_url', 'og:image:url', 'og:image',
    'twitter:image:src', 'twitter:image'
  ];
  for (const name of metaNames) {
    const val = extractMetaTag(html, name);
    if (val) candidates.push(resolveUrl(val, pageUrl));
  }
  const linkImage = /<link[^>]+rel=["']image_src["'][^>]+href=["']([^"']+)["']/i.exec(html);
  if (linkImage && linkImage[1]) candidates.push(resolveUrl(linkImage[1], pageUrl));

  const decoded = decodeXmlEntities(html);
  const imgRe = /<img\b[^>]*>/gi;
  let imgMatch;
  while ((imgMatch = imgRe.exec(decoded)) !== null && candidates.length < 16) {
    const fromSet = pickBestSrcsetUrl(extractAttrFromTag(imgMatch[0], 'srcset'), pageUrl);
    const src = fromSet || extractAttrFromTag(imgMatch[0], 'src');
    if (src && !src.startsWith('data:')) {
      candidates.push(resolveUrl(src, pageUrl));
    }
  }

  for (const c of candidates) {
    if (isUsableHeroImage(c, pageUrl)) return c;
  }
  return '';
}

async function fetchHeroImageForPage(pageUrl) {
  try {
    let host = '';
    try { host = new URL(pageUrl).hostname.toLowerCase(); } catch (e) { return ''; }
    if (host && ogBlockedHosts.has(host)) return '';

    const res = await fetch(pageUrl, {
      headers: fetchHeadersForHtml(pageUrl),
      redirect: 'follow',
      signal: AbortSignal.timeout(9000)
    });
    if (res.status === 403 || res.status === 429) {
      if (host) ogBlockedHosts.add(host);
      return '';
    }
    if (!res.ok) return '';
    const html = await res.text();
    return extractBestHeroImageFromHtml(html, res.url || pageUrl);
  } catch (e) {
    return '';
  }
}

async function enrichItemsMissingHeroImages(items, maxItems) {
  if (!items || !items.length) return;
  const need = [];
  for (const item of items) {
    const img = item.image && String(item.image).trim();
    if (!img || !isUsableHeroImage(img, item.link)) {
      if (img && !isUsableHeroImage(img, item.link)) item.image = '';
      need.push(item);
    }
    if (need.length >= maxItems) break;
  }
  if (!need.length) return;

  const concurrency = 4;
  let idx = 0;
  async function run() {
    while (idx < need.length) {
      const i = idx++;
      const item = need[i];
      if (!item.link) continue;
      const image = await fetchHeroImageForPage(item.link);
      if (image) item.image = image;
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, need.length) }, () => run()));
}

function extractMediaImageUrlFromItemXml(itemXml, itemLink) {
  const tags = itemXml.match(/<media:(?:content|thumbnail)\b[^>]*\/?>/gi) || [];
  for (const tag of tags) {
    const url = extractAttrFromTag(tag, 'url');
    if (!url) continue;
    const medium = (extractAttrFromTag(tag, 'medium') || '').toLowerCase();
    const type = (extractAttrFromTag(tag, 'type') || '').toLowerCase();
    const isThumbTag = /^<media:thumbnail/i.test(tag);
    if (isThumbTag || medium === 'image' || type.indexOf('image/') === 0) {
      const resolved = resolveUrl(url, itemLink);
      if (isUsableHeroImage(resolved, itemLink)) return resolved;
    }
  }
  return '';
}

function extractItemImage(itemXml, htmlBlob, itemLink) {
  const link = (itemLink || '').trim();
  const blob = itemXml + '\n' + (htmlBlob || '');
  const ranked = [];

  const tagRe = /<(?:media:thumbnail|media:content|itunes:image|enclosure|link)\b[^>]*>/gi;
  let tagMatch;
  while ((tagMatch = tagRe.exec(itemXml)) !== null) {
    const tag = tagMatch[0];
    const url = extractAttrFromTag(tag, 'url') || extractAttrFromTag(tag, 'href');
    if (!url) continue;
    const type = (extractAttrFromTag(tag, 'type') || '').toLowerCase();
    const medium = (extractAttrFromTag(tag, 'medium') || '').toLowerCase();
    const rel = (extractAttrFromTag(tag, 'rel') || '').toLowerCase();
    const isMedia = /^<media:(?:thumbnail|content)/i.test(tag) || /^<itunes:image/i.test(tag);
    const isImage = medium === 'image' || type.indexOf('image/') === 0 ||
      isMedia || rel === 'image' || /\.(jpe?g|png|gif|webp|avif)(\?|$)/i.test(url);
    if (isImage || (/^<enclosure/i.test(tag) && type.indexOf('image/') === 0)) {
      ranked.push({ url: resolveUrl(url, link), rank: isMedia ? 0 : 1 });
    }
  }

  const decoded = decodeXmlEntities(blob);
  const imgRe = /<img\b[^>]*>/gi;
  let imgTag;
  while ((imgTag = imgRe.exec(decoded)) !== null) {
    const fromSet = pickBestSrcsetUrl(extractAttrFromTag(imgTag[0], 'srcset'), link);
    const src = fromSet || extractAttrFromTag(imgTag[0], 'src') ||
      extractAttrFromTag(imgTag[0], 'data-src') ||
      extractAttrFromTag(imgTag[0], 'data-lazy-src') ||
      extractAttrFromTag(imgTag[0], 'data-original');
    if (src && !src.startsWith('data:')) ranked.push({ url: resolveUrl(src, link), rank: 2 });
  }

  ranked.sort((a, b) => a.rank - b.rank);
  for (let i = 0; i < ranked.length; i++) {
    if (isUsableHeroImage(ranked[i].url)) return ranked[i].url;
  }
  return '';
}

function extractMetaTag(html, nameOrProperty) {
  const reg = new RegExp(`<meta\\s+(?:name|property)=["']${nameOrProperty}["']\\s+content=["']([^"']+)["']`, 'i').exec(html) ||
              new RegExp(`<meta\\s+content=["']([^"']+)["']\\s+(?:name|property)=["']${nameOrProperty}["']`, 'i').exec(html);
  return reg ? reg[1] : '';
}

function resolveUrl(url, base) {
  try { return new URL(url, base).href; } catch (e) { return url; }
}

function stripHtml(html) {
  return (html || '').replace(/<[^>]*>?/gm, ' ').replace(/\s+/g, ' ').trim();
}

function cleanText(txt) {
  return decodeXmlEntities(txt || '').replace(/\s+/g, ' ').trim();
}

function escapeXml(str) {
  return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function getWaitlistStore(env) {
  return (env && env.WAITLIST) || (env && env.FEEDS_KV) || null;
}

function requireAdminSecret(request, env) {
  const secret = request.headers.get('X-Admin-Secret');
  const expectedSecret = env.ADMIN_SECRET || 'feedometer-admin-2026';
  return secret === expectedSecret;
}

async function ensureNotifySignupsTable(env) {
  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS notify_signups (
      email TEXT PRIMARY KEY,
      joined_at TEXT NOT NULL,
      source TEXT,
      country TEXT,
      city TEXT,
      synced_at TEXT NOT NULL
    )
  `).run();
}

async function listWaitlistFromKv(store) {
  const emails = [];
  if (!store) return emails;
  let cursor;
  do {
    const list = await store.list({ prefix: 'waitlist:email:', cursor, limit: 1000 });
    for (const key of list.keys) {
      const raw = await store.get(key.name);
      if (!raw) continue;
      try {
        emails.push(JSON.parse(raw));
      } catch {
        emails.push({ email: key.name.replace(/^waitlist:email:/, '') });
      }
    }
    cursor = list.list_complete ? undefined : list.cursor;
  } while (cursor);
  return emails;
}

async function syncWaitlistKvToD1(env) {
  const store = getWaitlistStore(env);
  if (!store) {
    console.warn('[WaitlistSync] KV store is not bound');
    return { ok: false, error: 'Waitlist KV not bound.' };
  }
  if (!env || !env.DB) {
    console.warn('[WaitlistSync] D1 is not bound');
    return { ok: false, error: 'D1 is not bound.' };
  }

  await ensureNotifySignupsTable(env);
  const syncedAt = new Date().toISOString();
  let copied = 0;
  let skipped = 0;
  let errors = 0;
  let cursor;

  do {
    const list = await store.list({ prefix: 'waitlist:email:', cursor, limit: 100 });
    for (const key of list.keys) {
      try {
        const raw = await store.get(key.name);
        if (!raw) {
          skipped += 1;
          continue;
        }
        let rec;
        try {
          rec = JSON.parse(raw);
        } catch {
          rec = { email: key.name.replace(/^waitlist:email:/, '') };
        }
        const email = String(rec.email || '').trim().toLowerCase();
        if (!email) {
          skipped += 1;
          continue;
        }
        const result = await env.DB.prepare(`
          INSERT OR IGNORE INTO notify_signups (email, joined_at, source, country, city, synced_at)
          VALUES (?, ?, ?, ?, ?, ?)
        `).bind(
          email,
          rec.joinedAt || syncedAt,
          rec.source || 'launch-notify-popup',
          rec.country || 'Unknown',
          rec.city || 'Unknown',
          syncedAt
        ).run();
        if (result && result.meta && result.meta.changes === 0) skipped += 1;
        else copied += 1;
      } catch (rowErr) {
        errors += 1;
        console.warn('[WaitlistSync] row error:', rowErr.message);
      }
    }
    cursor = list.list_complete ? undefined : list.cursor;
  } while (cursor);

  const summary = { ok: true, copied, skipped, errors, syncedAt };
  console.log(`[WaitlistSync] copied=${copied} skipped=${skipped} errors=${errors}`);
  return summary;
}

/* ------------------------------------------------------------------ */
/*  Waitlist: POST /api/waitlist                                        */
/*  Live capture: KV only. D1 is filled by the daily evening cron.     */
/* ------------------------------------------------------------------ */
async function handleWaitlist(request, env) {
  // Only accept POST
  if (request.method !== 'POST') {
    return jsonResponse({ ok: false, error: 'Method not allowed. Use POST.' }, 405);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ ok: false, error: 'Invalid JSON body.' }, 400);
  }

  const email = (body.email || '').trim().toLowerCase();

  // Basic email validation
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return jsonResponse({ ok: false, error: 'Please enter a valid email address.' }, 400);
  }

  const record = {
    email,
    joinedAt: new Date().toISOString(),
    source: body.source || 'launch-notify-popup',
    userAgent: request.headers.get('User-Agent') || '',
    country: (request.cf && request.cf.country) || 'Unknown',
    city: (request.cf && request.cf.city) || 'Unknown'
  };

  const store = getWaitlistStore(env);
  if (store) {
    try {
      const kvKey = `waitlist:email:${email}`;
      const existing = await store.get(kvKey);
      if (existing) {
        return jsonResponse({ ok: true, message: "You're already on the list! We'll notify you at launch.", duplicate: true });
      }
      await store.put(kvKey, JSON.stringify(record));
    } catch (kvErr) {
      console.warn('[Waitlist] KV write warning:', kvErr.message);
    }
  }

  return jsonResponse({
    ok: true,
    message: "You're on the list! We'll notify you the moment FeedOmeter launches."
  });
}

/* ------------------------------------------------------------------ */
/*  Admin export: GET /api/admin/waitlist                               */
/*  Protected by X-Admin-Secret header.                                 */
/* ------------------------------------------------------------------ */
async function handleAdminWaitlist(request, env) {
  if (request.method !== 'GET') {
    return jsonResponse({ ok: false, error: 'Method not allowed.' }, 405);
  }

  if (!requireAdminSecret(request, env)) {
    return jsonResponse({ ok: false, error: 'Unauthorized.' }, 401);
  }

  const store = getWaitlistStore(env);
  const kvEmails = await listWaitlistFromKv(store);

  let d1Emails = [];
  if (env && env.DB) {
    try {
      const rows = await env.DB.prepare(
        'SELECT email, joined_at AS joinedAt, source, country, city, synced_at AS syncedAt FROM notify_signups ORDER BY joined_at ASC'
      ).all();
      d1Emails = (rows && rows.results) || [];
    } catch (d1Err) {
      console.warn('[Waitlist] D1 read warning:', d1Err.message);
    }
  }

  const source = d1Emails.length ? 'd1' : 'kv';
  return jsonResponse({
    ok: true,
    source,
    kvTotal: kvEmails.length,
    d1Total: d1Emails.length,
    total: source === 'd1' ? d1Emails.length : kvEmails.length,
    exportedAt: new Date().toISOString(),
    emails: source === 'd1' ? d1Emails : kvEmails
  });
}

async function handleAdminWaitlistSync(request, env) {
  if (request.method !== 'POST' && request.method !== 'GET') {
    return jsonResponse({ ok: false, error: 'Method not allowed.' }, 405);
  }
  if (!requireAdminSecret(request, env)) {
    return jsonResponse({ ok: false, error: 'Unauthorized.' }, 401);
  }
  const result = await syncWaitlistKvToD1(env);
  const status = result.ok ? 200 : 503;
  return jsonResponse(result, status);
}

/* ------------------------------------------------------------------ */
/*  Telemetry: POST /api/telemetry, /api/event                        */
/*  Lightweight bolt-on analytics beacon endpoint.                    */
/* ------------------------------------------------------------------ */
async function handleTelemetry(request, env) {
  if (request.method !== 'POST' && request.method !== 'GET') {
    return jsonResponse({ ok: false, error: 'Method not allowed' }, 405);
  }

  let body = {};
  if (request.method === 'POST') {
    try {
      body = await request.json();
    } catch {
      try {
        const text = await request.text();
        body = JSON.parse(text);
      } catch {
        body = {};
      }
    }
  }

  // Edge geolocation and context enrichment
  const geo = {
    country: (request.cf && request.cf.country) || 'Unknown',
    city: (request.cf && request.cf.city) || 'Unknown',
    region: (request.cf && request.cf.region) || 'Unknown',
    asn: (request.cf && request.cf.asn) || 0
  };

  const record = {
    ...body,
    geo,
    ipAnonymized: request.headers.get('cf-connecting-ip') ? 'masked' : 'unknown',
    receivedAt: new Date().toISOString()
  };

  // Optional: Store in TELEMETRY KV or log if configured
  if (env && env.TELEMETRY_KV) {
    try {
      const key = `tel:${record.sessionId || Date.now()}:${Date.now()}`;
      await env.TELEMETRY_KV.put(key, JSON.stringify(record), { expirationTtl: 86400 * 30 }); // 30 days retention
    } catch (e) {
      console.warn('[Telemetry] KV write failed:', e.message);
    }
  }

  return jsonResponse({ ok: true, timestamp: record.receivedAt });
}
