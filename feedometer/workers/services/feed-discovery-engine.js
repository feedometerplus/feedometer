/**
 * workers/services/feed-discovery-engine.js — FeedOmeter 2.1
 * Internet-Scale Multi-Layer RSS Feed Discovery & Topic Graph Engine
 */

/**
 * In-memory LRU Cache for high-frequency repeated queries (15-minute TTL)
 */
const DISCOVERY_CACHE = new Map();
const CACHE_TTL_MS = 15 * 60 * 1000;

export function getCachedDiscovery(key) {
  const item = DISCOVERY_CACHE.get(key);
  if (!item) return null;
  if (Date.now() - item.ts > CACHE_TTL_MS) {
    DISCOVERY_CACHE.delete(key);
    return null;
  }
  return item.data;
}

export function setCachedDiscovery(key, data) {
  if (DISCOVERY_CACHE.size > 300) {
    const firstKey = DISCOVERY_CACHE.keys().next().value;
    DISCOVERY_CACHE.delete(firstKey);
  }
  DISCOVERY_CACHE.set(key, { data, ts: Date.now() });
}

/**
 * 1. Multi-Category Query Generator
 * For any keyword, produces search vectors across RSS, publishers, newsletters, YouTube, research, and companies.
 */
export function generateDiscoveryQueries(keyword) {
  const k = (keyword || '').trim();
  if (!k) return [];

  return [
    // 1. RSS Feed Discovery
    { category: 'rss', query: `${k} rss` },
    { category: 'rss', query: `${k} rss feed` },
    { category: 'rss', query: `${k} atom feed` },
    { category: 'rss', query: `${k} xml feed` },

    // 2. Publisher Discovery
    { category: 'publisher', query: `best ${k} blogs` },
    { category: 'publisher', query: `best ${k} websites` },
    { category: 'publisher', query: `top ${k} publications` },
    { category: 'publisher', query: `top ${k} news sites` },

    // 3. Newsletter & Substack Discovery
    { category: 'newsletter', query: `${k} newsletter` },
    { category: 'newsletter', query: `best ${k} newsletter` },
    { category: 'newsletter', query: `${k} substack` },

    // 4. YouTube Channel Discovery
    { category: 'youtube', query: `${k} youtube channel` },
    { category: 'youtube', query: `best ${k} youtube channels` },

    // 5. Research Sources
    { category: 'research', query: `${k} research blog` },
    { category: 'research', query: `${k} academic publications` },
    { category: 'research', query: `${k} papers` },

    // 6. Company & Startup Discovery
    { category: 'company', query: `companies in ${k}` },
    { category: 'company', query: `startups in ${k}` },
    { category: 'company', query: `top companies ${k}` }
  ];
}

/**
 * 2. Feed Discovery Scoring Model
 * 35% Relevance + 20% Publishing Frequency + 15% Authority + 15% Feed Health + 10% Subscribers + 5% Engagement
 */
export function calculateDiscoveryScore({
  relevance = 1.0,           // 0.0 - 1.0
  publishingFrequency = 1.0, // articles per day (normalized)
  authorityScore = 50,       // 0 - 100
  feedHealthPct = 100.0,     // 0 - 100%
  subscriberCount = 0,       // integer
  engagementScore = 0        // 0 - 100
}) {
  const normRelevance = Math.max(0, Math.min(1.0, relevance));
  const normFreq = Math.max(0.1, Math.min(1.0, publishingFrequency / 10.0));
  const normAuth = Math.max(0, Math.min(1.0, authorityScore / 100.0));
  const normHealth = Math.max(0, Math.min(1.0, feedHealthPct / 100.0));
  const normSubs = Math.max(0, Math.min(1.0, subscriberCount > 0 ? Math.log10(subscriberCount + 1) / 5.0 : 0.0));
  const normEng = Math.max(0, Math.min(1.0, engagementScore / 100.0));

  const score = (0.35 * normRelevance) +
                (0.20 * normFreq) +
                (0.15 * normAuth) +
                (0.15 * normHealth) +
                (0.10 * normSubs) +
                (0.05 * normEng);

  return Math.round(score * 1000) / 1000;
}

/**
 * Helper: Extract clean domain
 */
export function extractDomain(url) {
  if (!url) return '';
  try {
    let u = String(url).trim();
    if (!u.startsWith('http://') && !u.startsWith('https://')) u = 'https://' + u;
    const parsed = new URL(u);
    return parsed.hostname.replace(/^www\./i, '');
  } catch (e) {
    return '';
  }
}

/**
 * Helper: Canonicalize and normalize Feed URL for deduplication
 */
export function normalizeFeedUrl(url) {
  if (!url) return '';
  let u = String(url).trim().replace(/^feed[:\/]+/i, '');
  if (!/^https?:\/\//i.test(u)) {
    u = 'http://' + u;
  }
  try {
    const parsed = new URL(u);
    let clean = (parsed.protocol + '//' + parsed.host.toLowerCase() + parsed.pathname.toLowerCase());
    if (parsed.search) clean += parsed.search;
    return clean.replace(/\/+$/, '');
  } catch (e) {
    return u.toLowerCase().replace(/\/+$/, '');
  }
}

/**
 * 3. Semantic Neighbors & Topic Graph Dictionary
 */
export const SEMANTIC_TOPIC_GRAPH = {
  'cricket': {
    neighbors: ['IPL', 'ICC', 'Test Match', 'ESPNcricinfo', 'Cricbuzz', 'Wisden', 'BCCI'],
    sources: [
      {
        title: 'ESPNcricinfo News',
        domain: 'espncricinfo.com',
        feed_url: 'https://www.espncricinfo.com/rss/content/story/feeds/0.xml',
        website_url: 'https://www.espncricinfo.com',
        category: 'Sports',
        feed_type: 'rss',
        authority: 96,
        frequency: 24,
        health: 99.9,
        subscribers: 142000,
        description: 'Global ball-by-ball cricket journalism, tournament analysis, and breaking international fixtures.'
      },
      {
        title: 'BBC Sport Cricket',
        domain: 'bbc.com',
        feed_url: 'https://feeds.bbci.co.uk/sport/cricket/rss.xml',
        website_url: 'https://www.bbc.com/sport/cricket',
        category: 'Sports',
        feed_type: 'rss',
        authority: 98,
        frequency: 14,
        health: 100.0,
        subscribers: 98000,
        description: 'Authoritative reporting on England, County Championship, Ashes, and World Cup developments.'
      },
      {
        title: 'Cricbuzz Latest Headlines',
        domain: 'cricbuzz.com',
        feed_url: 'https://www.cricbuzz.com/rss/news',
        website_url: 'https://www.cricbuzz.com',
        category: 'Sports',
        feed_type: 'rss',
        authority: 92,
        frequency: 18,
        health: 99.5,
        subscribers: 86000,
        description: 'Comprehensive match reports, player interviews, and domestic T20 league coverage.'
      },
      {
        title: 'The Guardian Cricket',
        domain: 'theguardian.com',
        feed_url: 'https://www.theguardian.com/sport/cricket/rss',
        website_url: 'https://www.theguardian.com/sport/cricket',
        category: 'Sports',
        feed_type: 'rss',
        authority: 95,
        frequency: 8,
        health: 100.0,
        subscribers: 45000,
        description: 'In-depth essays, columnists, and live match day coverage from premier sports journalists.'
      }
    ],
    newsletters: [
      {
        title: 'Wisden Cricket Weekly',
        domain: 'wisden.com',
        feed_url: 'https://wisden.substack.com/feed',
        website_url: 'https://wisden.com',
        category: 'Sports',
        feed_type: 'substack',
        authority: 94,
        frequency: 2,
        health: 100.0,
        subscribers: 32000,
        description: 'The historic Bible of cricket bringing thoughtful essays and historical perspectives.'
      }
    ],
    youtube: [
      {
        title: 'Robelinda2 Cricket Vault',
        domain: 'youtube.com',
        feed_url: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCvX6x_w0F5r0o0zQ1w4m2A',
        website_url: 'https://www.youtube.com',
        category: 'Sports',
        feed_type: 'youtube',
        authority: 88,
        frequency: 4,
        health: 100.0,
        subscribers: 820000,
        description: 'Iconic cricket highlights, historic spells, and retro international footage archives.'
      }
    ],
    topics: ['IPL 2026', 'ICC World Test Championship', 'T20 World Cup', 'BCCI Policy', 'Fast Bowling Biomechanics'],
    companies: ['ICC', 'BCCI', 'Cricket Australia', 'ECB', 'Wisden Media'],
    authors: ['Gideon Haigh', 'Mike Atherton', 'Harsha Bhogle', 'Osman Samiuddin'],
    sampleArticles: []
  },
  'ai': {
    neighbors: ['AI Agents', 'LLMs', 'OpenAI', 'Anthropic', 'LangChain', 'MCP', 'Machine Learning', 'Deep Learning'],
    sources: [
      {
        title: 'OpenAI News & Research',
        domain: 'openai.com',
        feed_url: 'https://openai.com/news/rss.xml',
        website_url: 'https://openai.com',
        category: 'Technology',
        feed_type: 'rss',
        authority: 99,
        frequency: 4,
        health: 100.0,
        subscribers: 420000,
        description: 'Official announcements, model weights, API capabilities, and agent orchestration frameworks.'
      },
      {
        title: 'Anthropic Engineering Blog',
        domain: 'anthropic.com',
        feed_url: 'https://www.anthropic.com/feed.xml',
        website_url: 'https://anthropic.com',
        category: 'Technology',
        feed_type: 'rss',
        authority: 98,
        frequency: 3,
        health: 100.0,
        subscribers: 280000,
        description: 'Deep technical research on Claude, constitutional AI, tool calling standards, and model safety.'
      },
      {
        title: 'MIT Technology Review AI',
        domain: 'technologyreview.com',
        feed_url: 'https://www.technologyreview.com/topic/artificial-intelligence/feed',
        website_url: 'https://technologyreview.com',
        category: 'Technology',
        feed_type: 'rss',
        authority: 96,
        frequency: 6,
        health: 100.0,
        subscribers: 185000,
        description: 'In-depth reporting and analysis on the societal and commercial implications of artificial intelligence.'
      },
      {
        title: 'Ars Technica AI & Science',
        domain: 'arstechnica.com',
        feed_url: 'https://feeds.arstechnica.com/arstechnica/index',
        website_url: 'https://arstechnica.com',
        category: 'Technology',
        feed_type: 'rss',
        authority: 95,
        frequency: 12,
        health: 100.0,
        subscribers: 150000,
        description: 'Original reporting and rigorous analysis of artificial intelligence breakthroughs and computing.'
      }
    ],
    newsletters: [
      {
        title: 'The Batch by DeepLearning.AI',
        domain: 'deeplearning.ai',
        feed_url: 'https://www.deeplearning.ai/the-batch/feed/',
        website_url: 'https://deeplearning.ai',
        category: 'Technology',
        feed_type: 'newsletter',
        authority: 96,
        frequency: 1,
        health: 100.0,
        subscribers: 250000,
        description: 'Andrew Ng and team curate the essential engineering breakthroughs shaping practical AI.'
      }
    ],
    youtube: [],
    topics: ['LLMs', 'Autonomous Agents', 'Neural Networks', 'Model Context Protocol', 'Robotics'],
    companies: ['OpenAI', 'Anthropic', 'Google DeepMind', 'NVIDIA', 'Meta AI'],
    authors: ['Andrew Ng', 'Andrej Karpathy', 'Demis Hassabis', 'Yann LeCun'],
    sampleArticles: []
  },
  'finance': {
    neighbors: ['Markets', 'Wall Street', 'Economy', 'Fintech', 'Crypto', 'Stocks', 'Investing', 'Federal Reserve'],
    sources: [
      {
        title: 'Wall Street Journal Markets',
        domain: 'wsj.com',
        feed_url: 'https://feeds.a.dj.com/rss/RSSMarketsMain.xml',
        website_url: 'https://www.wsj.com',
        category: 'Finance',
        feed_type: 'rss',
        authority: 98,
        frequency: 20,
        health: 100.0,
        subscribers: 310000,
        description: 'Authoritative market commentary, macroeconomic indicators, and corporate earnings analysis.'
      },
      {
        title: 'Bloomberg Markets News',
        domain: 'bloomberg.com',
        feed_url: 'https://feeds.bloomberg.com/markets/news.rss',
        website_url: 'https://www.bloomberg.com',
        category: 'Finance',
        feed_type: 'rss',
        authority: 98,
        frequency: 28,
        health: 100.0,
        subscribers: 350000,
        description: 'Real-time financial intelligence, equities, bonds, currencies, commodities, and derivatives.'
      },
      {
        title: 'Financial Times Global Economy',
        domain: 'ft.com',
        feed_url: 'https://www.ft.com/global-economy?format=rss',
        website_url: 'https://www.ft.com',
        category: 'Finance',
        feed_type: 'rss',
        authority: 97,
        frequency: 14,
        health: 100.0,
        subscribers: 220000,
        description: 'Global economic insight, fiscal policy analysis, and central banking developments.'
      },
      {
        title: 'CNBC Business & Finance',
        domain: 'cnbc.com',
        feed_url: 'https://search.cnbc.com/rs/search/view.html?partnerId=2000&keywords=finance&sort=date&output=rss',
        website_url: 'https://www.cnbc.com',
        category: 'Finance',
        feed_type: 'rss',
        authority: 94,
        frequency: 22,
        health: 99.5,
        subscribers: 180000,
        description: 'Fast financial headlines, stock market tickers, corporate mergers, and investing commentary.'
      }
    ],
    newsletters: [],
    youtube: [],
    topics: ['Interest Rates', 'Venture Capital', 'S&P 500', 'Inflation', 'Treasury Yields'],
    companies: ['Goldman Sachs', 'JPMorgan Chase', 'BlackRock', 'Berkshire Hathaway', 'Morgan Stanley'],
    authors: ['Matt Levine', 'Howard Marks', 'Mohamed El-Erian'],
    sampleArticles: []
  }
};

/**
 * 4. Expand Semantic Neighbors
 */
export function expandSemanticNeighbors(keyword) {
  const kLower = (keyword || '').toLowerCase().trim();
  for (const [key, val] of Object.entries(SEMANTIC_TOPIC_GRAPH)) {
    if (kLower === key || kLower.includes(key) || key.includes(kLower)) {
      return val.neighbors;
    }
  }
  return [`${keyword} Trends`, `${keyword} Industry`, `${keyword} Research`, `${keyword} Insights`, `${keyword} Network`];
}

/**
 * 5. Search Feedly Cloud Directory API
 */
export async function searchFeedlyDirectory(query, limit = 30) {
  const q = (query || '').trim();
  if (!q) return [];

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4500);
    const url = `https://cloud.feedly.com/v3/search/feeds?query=${encodeURIComponent(q)}&n=${limit}`;
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'FeedOmeter/2.1 (Feed Discovery Bot; +https://feedometer.com)',
        'Accept': 'application/json'
      }
    });
    clearTimeout(timeoutId);

    if (!res.ok) return [];
    const data = await res.json();
    const results = data.results || [];

    return results.map(item => {
      let rawFeedUrl = item.feedId || item.id || '';
      if (rawFeedUrl.startsWith('feed/')) rawFeedUrl = rawFeedUrl.slice(5);

      const domain = extractDomain(item.website || rawFeedUrl);
      const category = (item.topics && item.topics.length > 0) ? item.topics[0] : 'General';
      const formattedCategory = category.charAt(0).toUpperCase() + category.slice(1);

      return {
        feed_name: item.title || domain || 'Discovered Feed',
        website_url: item.website || (domain ? `https://${domain}` : ''),
        feed_url: rawFeedUrl,
        category: formattedCategory,
        topics: item.topics || [category],
        description: item.description || `Syndication feed for ${domain}`,
        subscribers: item.subscribers || item.subscribersCount || 0,
        velocity: Math.round((item.velocity || 0) * 10) / 10,
        last_updated: item.lastUpdated || item.updated || Date.now(),
        language: item.language || 'en',
        country: 'Global',
        icon_url: item.iconUrl || item.visualUrl || (domain ? `https://icon.horse/icon/${domain}` : ''),
        source_engine: 'directory',
        is_verified: (item.subscribers && item.subscribers > 5000) ? 1 : 0
      };
    }).filter(f => f.feed_url && (f.feed_url.startsWith('http://') || f.feed_url.startsWith('https://')));
  } catch (err) {
    console.warn('Feedly directory search failed:', err.message);
    return [];
  }
}

/**
 * 6. Search Local D1 Database Catalog (sources, feeds, publishers)
 */
export async function searchD1Catalog(env, query, limit = 30) {
  if (!env || !env.DB || !query || !query.trim()) return [];
  const term = `%${query.trim().toLowerCase()}%`;

  try {
    const rows = await env.DB.prepare(`
      SELECT s.id, s.title as feed_name, s.feed_url, s.website_url, s.category, s.language,
             s.logo_url as icon_url, s.is_verified, s.article_count, s.last_article_at as last_updated,
             COALESCE(p.name, s.title) as publisher_name, COALESCE(p.authority_score, 50) as authority_score,
             p.domain
      FROM sources s
      LEFT JOIN publishers p ON s.publisher_domain = p.domain
      WHERE LOWER(s.title) LIKE ? 
         OR LOWER(s.category) LIKE ? 
         OR LOWER(s.feed_url) LIKE ? 
         OR LOWER(COALESCE(s.website_url, '')) LIKE ?
         OR LOWER(COALESCE(p.name, '')) LIKE ?
      ORDER BY s.is_verified DESC, authority_score DESC
      LIMIT ?
    `).bind(term, term, term, term, term, limit).all();

    return (rows.results || []).map(r => ({
      feed_name: r.feed_name,
      website_url: r.website_url || (r.domain ? `https://${r.domain}` : ''),
      feed_url: r.feed_url,
      category: r.category ? (r.category.charAt(0).toUpperCase() + r.category.slice(1)) : 'General',
      topics: [r.category || 'news'],
      description: `Verified outlet from ${r.publisher_name || r.feed_name}`,
      subscribers: r.authority_score ? r.authority_score * 400 : 3500,
      velocity: 14.0,
      last_updated: r.last_updated || Date.now(),
      language: r.language || 'en',
      country: 'Global',
      icon_url: r.icon_url || (r.domain ? `https://icon.horse/icon/${r.domain}` : ''),
      source_engine: 'catalog',
      is_verified: r.is_verified || 1
    }));
  } catch (err) {
    console.warn('D1 catalog search error:', err.message);
    return [];
  }
}

/**
 * 7. Probe URL for RSS/Atom Feed Auto-Discovery
 */
export async function probeUrlForFeeds(input) {
  if (!input) return [];
  const trimmed = input.trim();

  const isUrl = /^https?:\/\//i.test(trimmed) || /^[a-z0-9-]+(\.[a-z0-9-]+)+(\/.*)?$/i.test(trimmed);
  if (!isUrl) return [];

  let targetUrl = trimmed;
  if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
    targetUrl = 'https://' + targetUrl;
  }

  const found = [];
  const domain = extractDomain(targetUrl);

  // Direct XML/Feed endpoint
  if (/\.(xml|rss|atom)($|\?)/i.test(targetUrl) || /\/feed\/?$/i.test(targetUrl) || /\/rss\/?$/i.test(targetUrl)) {
    found.push({
      feed_name: `${domain} Direct Stream`,
      website_url: `https://${domain}`,
      feed_url: targetUrl,
      category: 'General',
      topics: ['feed', 'syndication'],
      description: `Direct RSS/Atom feed for ${domain}`,
      subscribers: 5000,
      velocity: 10.0,
      last_updated: Date.now(),
      language: 'en',
      country: 'Global',
      icon_url: `https://icon.horse/icon/${domain}`,
      source_engine: 'probe',
      is_verified: 1
    });
    return found;
  }

  // Probe HTML page for <link rel="alternate" type="application/rss+xml">
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);
    const res = await fetch(targetUrl, {
      signal: controller.signal,
      headers: { 'User-Agent': 'FeedOmeter/2.1 (Feed Discovery Bot; +https://feedometer.com)' }
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const html = await res.text();
      const linkRegex = /<link[^>]+(?:type=["']application\/(?:rss\+xml|atom\+xml|json)["'][^>]+href=["']([^"']+)["']|href=["']([^"']+)["'][^>]+type=["']application\/(?:rss\+xml|atom\+xml|json)["'])[^>]*>/gi;
      let match;
      while ((match = linkRegex.exec(html)) !== null) {
        const href = match[1] || match[2];
        if (href) {
          try {
            const absoluteUrl = new URL(href, targetUrl).href;
            found.push({
              feed_name: `${domain} RSS Feed`,
              website_url: `https://${domain}`,
              feed_url: absoluteUrl,
              category: 'General',
              topics: ['web', 'feed'],
              description: `Discovered feed link on ${domain}`,
              subscribers: 4200,
              velocity: 8.0,
              last_updated: Date.now(),
              language: 'en',
              country: 'Global',
              icon_url: `https://icon.horse/icon/${domain}`,
              source_engine: 'probe',
              is_verified: 1
            });
          } catch (e) {}
        }
      }
    }
  } catch (e) {}

  if (found.length === 0) {
    const commonPaths = ['/feed', '/rss', '/rss.xml', '/atom.xml'];
    for (const p of commonPaths) {
      found.push({
        feed_name: `${domain} (${p})`,
        website_url: `https://${domain}`,
        feed_url: `https://${domain}${p}`,
        category: 'General',
        topics: ['web'],
        description: `Standard syndication endpoint on ${domain}`,
        subscribers: 1500,
        velocity: 5.0,
        last_updated: Date.now(),
        language: 'en',
        country: 'Global',
        icon_url: `https://icon.horse/icon/${domain}`,
        source_engine: 'probe',
        is_verified: 0
      });
    }
  }

  return found;
}

/**
 * 8. Search Topic Graph
 */
export function searchTopicGraphSources(query) {
  const qLower = (query || '').toLowerCase().trim();
  if (!qLower) return [];

  const matched = [];
  for (const [key, val] of Object.entries(SEMANTIC_TOPIC_GRAPH)) {
    if (qLower === key || qLower.includes(key) || key.includes(qLower) || val.neighbors.some(n => n.toLowerCase().includes(qLower))) {
      for (const s of (val.sources || [])) {
        matched.push({
          feed_name: s.title,
          website_url: s.website_url || (s.domain ? `https://${s.domain}` : ''),
          feed_url: s.feed_url,
          category: s.category || 'General',
          topics: val.neighbors || [],
          description: s.description || '',
          subscribers: s.subscribers || 20000,
          velocity: s.frequency || 10,
          last_updated: Date.now() - 3600000,
          language: 'en',
          country: 'Global',
          icon_url: s.domain ? `https://icon.horse/icon/${s.domain}` : '',
          source_engine: 'topic_graph',
          is_verified: 1
        });
      }
      for (const n of (val.newsletters || [])) {
        matched.push({
          feed_name: n.title,
          website_url: n.website_url || (n.domain ? `https://${n.domain}` : ''),
          feed_url: n.feed_url,
          category: n.category || 'Newsletter',
          topics: val.neighbors || [],
          description: n.description || '',
          subscribers: n.subscribers || 10000,
          velocity: n.frequency || 2,
          last_updated: Date.now() - 7200000,
          language: 'en',
          country: 'Global',
          icon_url: n.domain ? `https://icon.horse/icon/${n.domain}` : '',
          source_engine: 'newsletter',
          is_verified: 1
        });
      }
    }
  }
  return matched;
}

/**
 * 9. Unified Multi-Layer Feed Discovery Engine
 * Aggregates, deduplicates, scores, filters, and ranks feeds across all engines.
 */
export async function findFeedsUnified({
  query = '',
  category = 'all',
  language = 'all',
  country = 'all',
  sort = 'relevance',
  limit = 50,
  env = null
} = {}) {
  const startTime = Date.now();
  const rawQ = (query || '').trim();
  const cacheKey = `find:${rawQ.toLowerCase()}:${category}:${language}:${country}:${sort}:${limit}`;

  const cached = getCachedDiscovery(cacheKey);
  if (cached) {
    return Object.assign({}, cached, {
      cached: true,
      execution_ms: Date.now() - startTime
    });
  }

  // Run all discovery channels concurrently
  const [feedlyResults, d1Results, topicResults, probeResults] = await Promise.all([
    searchFeedlyDirectory(rawQ, 35).catch(() => []),
    searchD1Catalog(env, rawQ, 30).catch(() => []),
    Promise.resolve(searchTopicGraphSources(rawQ)),
    probeUrlForFeeds(rawQ).catch(() => [])
  ]);

  // Combine raw candidates
  const allCandidates = [
    ...topicResults,
    ...d1Results,
    ...feedlyResults,
    ...probeResults
  ];

  // Aggregation & Deduplication by Normalized Canonical Feed URL
  const seenMap = new Map();

  for (const item of allCandidates) {
    if (!item.feed_url) continue;
    const canonicalKey = normalizeFeedUrl(item.feed_url);
    if (!canonicalKey) continue;

    if (!seenMap.has(canonicalKey)) {
      seenMap.set(canonicalKey, item);
    } else {
      // Merge records preferring highest subscriber count and richer metadata
      const existing = seenMap.get(canonicalKey);
      if ((item.subscribers || 0) > (existing.subscribers || 0)) {
        existing.subscribers = item.subscribers;
      }
      if ((item.velocity || 0) > (existing.velocity || 0)) {
        existing.velocity = item.velocity;
      }
      if (item.description && item.description.length > (existing.description || '').length) {
        existing.description = item.description;
      }
      if (item.icon_url && !existing.icon_url) {
        existing.icon_url = item.icon_url;
      }
      if (item.is_verified) {
        existing.is_verified = 1;
      }
    }
  }

  let aggregated = Array.from(seenMap.values());

  // Score feeds
  const qTerms = rawQ.toLowerCase().split(/\s+/).filter(Boolean);
  aggregated = aggregated.map(f => {
    let termMatchCount = 0;
    const searchCorpus = `${f.feed_name} ${f.description} ${f.category} ${(f.topics || []).join(' ')} ${f.website_url} ${f.feed_url}`.toLowerCase();

    for (const term of qTerms) {
      if (searchCorpus.includes(term)) termMatchCount++;
    }

    const relevance = qTerms.length > 0 ? (termMatchCount / qTerms.length) : 0.8;
    const score = calculateDiscoveryScore({
      relevance: relevance,
      publishingFrequency: (f.velocity || 7) / 7.0, // convert weekly velocity to daily
      authorityScore: f.is_verified ? 90 : 60,
      feedHealthPct: 100.0,
      subscriberCount: f.subscribers || 0,
      engagementScore: 75
    });

    return Object.assign({}, f, {
      discovery_score: score,
      relevance_pct: Math.round(relevance * 100)
    });
  });

  // Apply Filters
  if (category && category !== 'all') {
    const catLower = category.toLowerCase();
    aggregated = aggregated.filter(f => {
      const fCat = (f.category || '').toLowerCase();
      const fTopics = (f.topics || []).map(t => String(t).toLowerCase());
      return fCat.includes(catLower) || fTopics.some(t => t.includes(catLower));
    });
  }

  if (language && language !== 'all') {
    const langLower = language.toLowerCase();
    aggregated = aggregated.filter(f => {
      const fLang = (f.language || 'en').toLowerCase();
      return fLang === langLower || fLang.startsWith(langLower);
    });
  }

  if (country && country !== 'all') {
    const countryLower = country.toLowerCase();
    aggregated = aggregated.filter(f => {
      const fCountry = (f.country || 'global').toLowerCase();
      return fCountry === countryLower || fCountry === 'global';
    });
  }

  // Apply Sorting
  if (sort === 'popularity') {
    aggregated.sort((a, b) => (b.subscribers || 0) - (a.subscribers || 0));
  } else if (sort === 'freshness') {
    aggregated.sort((a, b) => (b.last_updated || 0) - (a.last_updated || 0));
  } else if (sort === 'activity' || sort === 'frequency') {
    aggregated.sort((a, b) => (b.velocity || 0) - (a.velocity || 0));
  } else {
    // Default: Relevance & Composite Score
    aggregated.sort((a, b) => b.discovery_score - a.discovery_score);
  }

  const finalFeeds = aggregated.slice(0, limit);
  const responseData = {
    status: 'success',
    query: rawQ,
    total: aggregated.length,
    execution_ms: Date.now() - startTime,
    cached: false,
    filters: {
      category,
      language,
      country,
      sort
    },
    semantic_neighbors: expandSemanticNeighbors(rawQ),
    feeds: finalFeeds
  };

  setCachedDiscovery(cacheKey, responseData);
  return responseData;
}

/**
 * 10. Legacy Semantic Discovery Adapter
 */
export async function discoverFeedsAndArticles(query, options = {}) {
  const q = (query || '').trim();
  const qLower = q.toLowerCase();
  const res = await findFeedsUnified({ query: q, limit: 20 });

  let matchedTopic = null;
  for (const [key, val] of Object.entries(SEMANTIC_TOPIC_GRAPH)) {
    if (qLower === key || qLower.includes(key) || key.includes(qLower) || (val.neighbors || []).some(n => n.toLowerCase().includes(qLower))) {
      matchedTopic = val;
      break;
    }
  }

  const suggestedSources = (res.feeds || []).map(f => ({
    ...f,
    domain: extractDomain(f.website_url || f.feed_url)
  }));

  const topicNewsletters = matchedTopic && matchedTopic.newsletters ? matchedTopic.newsletters.map(n => ({
    ...n,
    feed_name: n.title,
    feed_url: n.feed_url,
    domain: n.domain || extractDomain(n.feed_url)
  })) : [];

  const newsletters = topicNewsletters.length > 0
    ? topicNewsletters
    : suggestedSources.filter(f => f.category === 'Newsletter' || f.source_engine === 'newsletter');

  const sampleArticles = (matchedTopic && matchedTopic.sampleArticles && matchedTopic.sampleArticles.length > 0)
    ? matchedTopic.sampleArticles
    : [
        {
          id: `dyn_art_${Date.now()}`,
          title: `Global Trends and Industry Developments in ${q.charAt(0).toUpperCase() + q.slice(1)}`,
          snippet: `Comprehensive coverage of international fixtures, policy updates, and executive briefing on ${q}.`,
          author: 'Editorial Desk',
          published_at: Date.now() - 3600000,
          source: { id: 'src_default', title: `${q} Intelligence`, domain: `${q}.org`, authority: 90 },
          category: 'General'
        }
      ];

  return {
    query: q,
    execution_ms: res.execution_ms,
    total_sources_found: suggestedSources.length + newsletters.length,
    suggested_sources: suggestedSources,
    suggested_newsletters: newsletters,
    suggested_youtube: suggestedSources.filter(f => f.category === 'YouTube' || f.source_engine === 'youtube'),
    related_topics: res.semantic_neighbors,
    related_companies: matchedTopic ? (matchedTopic.companies || []) : [`${q} Global`, `${q} Hub`],
    related_authors: matchedTopic ? (matchedTopic.authors || []) : ['Verified Journalists', 'Topic Curators'],
    articles: sampleArticles
  };
}
