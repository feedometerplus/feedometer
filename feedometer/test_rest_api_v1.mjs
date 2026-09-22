/**
 * test_rest_api_v1.mjs — Comprehensive Unit Tests for REST API v1 Endpoints & Cursor Pagination
 */
import { encodeCursor, decodeCursor, handleGetArticles, handleSearchArticles, handleGetSources, handleGetMeSubscriptions, handleGetMeOpml } from './workers/modules/rest-api-v1.js';
import { hashApiKey } from './workers/middleware/api-key-auth.js';

let passed = 0;
let failed = 0;

function assert(condition, msg) {
  if (condition) {
    console.log(`  ✅ PASS: ${msg}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${msg}`);
    failed++;
  }
}

console.log('======================================================================');
console.log('🧪 REST API v1 ENDPOINTS & CURSOR PAGINATION TEST SUITE');
console.log('======================================================================\n');

// 1. Test Cursor Encoding & Decoding
console.log('1. Testing Cursor Token Encoding & Decoding:');
const testTimestamp = 1790000000000;
const testArticleId = 'art_openai_gpt5_announcement';
const token = encodeCursor(testTimestamp, testArticleId);
assert(typeof token === 'string' && token.length > 0, `Cursor token generated: ${token}`);

const decoded = decodeCursor(token);
assert(decoded !== null, 'Cursor token successfully decoded');
assert(decoded.publishedAt === testTimestamp, `Timestamp matches: ${decoded.publishedAt}`);
assert(decoded.id === testArticleId, `Article ID matches: ${decoded.id}`);

assert(decodeCursor(null) === null, 'Decodes null token safely');
assert(decodeCursor('invalid-base64-token!!') === null, 'Rejects invalid base64 token');

// Setup Mock Environment
const apiKeyPlain = 'fom_live_99887766554433221100aabbccddeeff';
const apiKeyHash = await hashApiKey(apiKeyPlain);

const mockDbData = {
  articles: [
    { id: 'art_3', title: 'Article 3 (Newest)', published_at: 1790030000000, source_id: 'src_tc', snippet: 'Latest AI breakthrough' },
    { id: 'art_2', title: 'Article 2 (Middle)', published_at: 1790020000000, source_id: 'src_tc', snippet: 'Quantum computing update' },
    { id: 'art_1', title: 'Article 1 (Oldest)', published_at: 1790010000000, source_id: 'src_ars', snippet: 'Open-source LLM releases' }
  ],
  sources: [
    { id: 'src_tc', title: 'TechCrunch AI', feed_url: 'https://techcrunch.com/feed', category: 'technology', is_verified: 1, article_count: 120, status: 'active' },
    { id: 'src_ars', title: 'Ars Technica', feed_url: 'https://arstechnica.com/feed', category: 'technology', is_verified: 1, article_count: 85, status: 'active' }
  ],
  folders: [
    { id: 'fld_tech', name: 'Tech & AI', icon: '💻', sort_order: 1 }
  ],
  user_feeds: [
    { id: 'uf_1', source_id: 'src_tc', custom_title: 'TechCrunch', is_muted: 0, created_at: 1789000000000 }
  ],
  assignments: [
    { folder_id: 'fld_tech', feed_id: 'src_tc' }
  ]
};

const mockEnv = {
  DB: {
    prepare: (sql) => ({
      bind: (...args) => ({
        first: async () => {
          if (sql.includes('FROM api_keys')) {
            if (args[0] === apiKeyHash) {
              return {
                id: 'key_123',
                user_id: 'usr_dev_1',
                name: 'API Key',
                permissions: JSON.stringify(['read:articles', 'read:sources', 'read:search', 'read:me', 'write:me']),
                rate_limit_per_min: 100,
                expires_at: null,
                is_active: 1
              };
            }
          }
          if (sql.includes('FROM users')) {
            return { display_name: 'Alex Developer', email: 'alex@company.com' };
          }
          return null;
        },
        all: async () => {
          if (sql.includes('FROM articles')) {
            // Handle pagination simulation: if LIMIT 2 requested (limit 1 + 1)
            const limitParam = args[args.length - 1];
            let results = [...mockDbData.articles];
            
            // Check if cursor passed
            if (args.length >= 4 && typeof args[args.length - 3] === 'number') {
              const cursorPublishedAt = args[args.length - 3];
              results = results.filter(a => a.published_at < cursorPublishedAt);
            }

            // Check if search filter
            if (sql.includes('LIKE ?')) {
              const term = args[0].replace(/%/g, '').toLowerCase();
              results = results.filter(a => a.title.toLowerCase().includes(term) || a.snippet.toLowerCase().includes(term));
            }

            return { results: results.slice(0, limitParam) };
          }
          if (sql.includes('FROM sources')) {
            return { results: mockDbData.sources };
          }
          if (sql.includes('FROM folders')) {
            return { results: mockDbData.folders };
          }
          if (sql.includes('FROM user_feeds')) {
            return { results: mockDbData.user_feeds.map(uf => ({ ...uf, title: 'TechCrunch AI', feed_url: 'https://techcrunch.com/feed', category: 'technology' })) };
          }
          if (sql.includes('FROM user_feed_assignments')) {
            return { results: mockDbData.assignments };
          }
          return { results: [] };
        },
        run: async () => ({ meta: { changes: 1 } })
      })
    })
  },
  FEEDS_KV: {
    get: async () => '0',
    put: async () => {}
  }
};

// 2. Test GET /api/v1/articles with Cursor Pagination
console.log('\n2. Testing GET /api/v1/articles Cursor Pagination:');
const reqPage1 = new Request('https://api.feedometer.com/api/v1/articles?limit=1', {
  headers: { 'Authorization': `Bearer ${apiKeyPlain}` }
});
const resPage1 = await handleGetArticles(reqPage1, mockEnv);
const jsonPage1 = await resPage1.json();

assert(resPage1.status === 200, 'Articles endpoint returns HTTP 200');
assert(jsonPage1.status === 'success', 'Response status is success');
assert(jsonPage1.data.length === 1, 'Returns exactly 1 article for limit=1');
assert(jsonPage1.pagination.has_more === true, 'Pagination indicates has_more = true');
assert(jsonPage1.pagination.next_cursor !== null, 'next_cursor token generated for next page');

// Fetch Page 2 using cursor
const nextCursor = jsonPage1.pagination.next_cursor;
const reqPage2 = new Request(`https://api.feedometer.com/api/v1/articles?limit=1&cursor=${encodeURIComponent(nextCursor)}`, {
  headers: { 'Authorization': `Bearer ${apiKeyPlain}` }
});
const resPage2 = await handleGetArticles(reqPage2, mockEnv);
const jsonPage2 = await resPage2.json();

assert(jsonPage2.data.length === 1, 'Page 2 returns 1 article');
assert(jsonPage2.data[0].id === 'art_2', 'Page 2 correctly starts with art_2');

// 3. Test GET /api/v1/search
console.log('\n3. Testing GET /api/v1/search:');
const reqSearch = new Request('https://api.feedometer.com/api/v1/search?q=quantum', {
  headers: { 'Authorization': `Bearer ${apiKeyPlain}` }
});
const resSearch = await handleSearchArticles(reqSearch, mockEnv);
const jsonSearch = await resSearch.json();

assert(resSearch.status === 200, 'Search returns HTTP 200');
assert(jsonSearch.data.length === 1, 'Finds 1 matching article for "quantum"');
assert(jsonSearch.data[0].id === 'art_2', 'Matched expected article');

// 4. Test GET /api/v1/sources
console.log('\n4. Testing GET /api/v1/sources:');
const reqSources = new Request('https://api.feedometer.com/api/v1/sources', {
  headers: { 'Authorization': `Bearer ${apiKeyPlain}` }
});
const resSources = await handleGetSources(reqSources, mockEnv);
const jsonSources = await resSources.json();

assert(resSources.status === 200, 'Sources endpoint returns HTTP 200');
assert(jsonSources.data.length === 2, 'Returns 2 catalog sources');

// 5. Test GET /api/v1/me/subscriptions
console.log('\n5. Testing GET /api/v1/me/subscriptions:');
const reqSubs = new Request('https://api.feedometer.com/api/v1/me/subscriptions', {
  headers: { 'Authorization': `Bearer ${apiKeyPlain}` }
});
const resSubs = await handleGetMeSubscriptions(reqSubs, mockEnv);
const jsonSubs = await resSubs.json();

assert(resSubs.status === 200, 'User subscriptions endpoint returns HTTP 200');
assert(jsonSubs.user_id === 'usr_dev_1', 'Identifies authenticated user');
assert(jsonSubs.data.subscriptions.length === 1, 'Returns 1 active subscription');
assert(jsonSubs.data.subscriptions[0].folder_id === 'fld_tech', 'Subscription is correctly mapped to folder');

// 6. Test GET /api/v1/me/opml
console.log('\n6. Testing GET /api/v1/me/opml (Live OPML 2.0 Export):');
const reqOpml = new Request('https://api.feedometer.com/api/v1/me/opml', {
  headers: { 'Authorization': `Bearer ${apiKeyPlain}` }
});
const resOpml = await handleGetMeOpml(reqOpml, mockEnv);
const opmlText = await resOpml.text();

assert(resOpml.status === 200, 'OPML export returns HTTP 200');
assert(resOpml.headers.get('Content-Type').includes('application/opml+xml'), 'Content-Type is application/opml+xml');
assert(opmlText.includes('<opml version="2.0">'), 'Contains valid OPML 2.0 root tag');
assert(opmlText.includes('Tech &amp; AI'), 'Includes user folder');
assert(opmlText.includes('https://techcrunch.com/feed'), 'Includes subscribed feed xmlUrl');

console.log('\n======================================================================');
console.log(`🎉 REST API v1 RESULTS: ${passed} PASSED | ${failed} FAILED`);
console.log('======================================================================');

if (failed > 0) process.exit(1);
