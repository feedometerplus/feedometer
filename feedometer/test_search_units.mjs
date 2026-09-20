/**
 * test_search_units.mjs — Unit Test Suite for Search Algorithms & Ranking Formulas
 * FeedOmeter 2.1 Search & News Discovery Intelligence
 */
import { buildFtsQuery, calculateRankingScore, generateWhyBadges } from './workers/services/search-indexer.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failed++;
  }
}

console.log('🧪 Starting Search Algorithm Unit Tests...\n');

// 1. FTS5 Query Builder Tests
console.log('1. Testing FTS5 Query Builder:');
const q1 = buildFtsQuery('artificial intelligence');
assert(q1 === 'artificial AND intelligence', `Implicit AND conjunction: "${q1}"`);

const q2 = buildFtsQuery('AI -crypto');
assert(q2 === 'AI NOT crypto', `Negative term exclusion (-crypto): "${q2}"`);

const q3 = buildFtsQuery('AI NOT crypto');
assert(q3 === 'AI NOT crypto', `Explicit NOT operator: "${q3}"`);

const q4 = buildFtsQuery('Claude OR Gemini OR GPT');
assert(q4 === 'Claude OR Gemini OR GPT', `Disjunction (OR) preserved: "${q4}"`);

const q5 = buildFtsQuery('"large language models" -crypto');
assert(q5 === '"large language models" NOT crypto', `Quoted exact phrase with exclusion: "${q5}"`);

// 2. Ranking Score Calculations
console.log('\n2. Testing 50% BM25 Precision Composite Ranking Formula:');
const scoreFreshAuthority = calculateRankingScore({
  bm25Rank: -12.5,
  publishedAt: Date.now() - 2 * 3600 * 1000, // 2h ago
  authorityScore: 95,
  engagementScore: 50
});
assert(scoreFreshAuthority > 0.70, `High BM25 + fresh + authority yields high score: ${scoreFreshAuthority}`);

const scoreStaleLowAuth = calculateRankingScore({
  bm25Rank: -2.0,
  publishedAt: Date.now() - 60 * 24 * 3600 * 1000, // 60 days ago
  authorityScore: 20,
  engagementScore: 0
});
assert(scoreStaleLowAuth < 0.40, `Low BM25 + stale + low authority yields low score: ${scoreStaleLowAuth}`);
assert(scoreFreshAuthority > scoreStaleLowAuth, `Fresh authoritative article ranks strictly above stale blog`);

// 3. Why This Result? Badge Generation
console.log('\n3. Testing "Why This Result?" Badge Generation:');
const sampleArticle = {
  title: 'Anthropic Unveils Claude 3.7 with Hybrid Reasoning',
  snippet: 'A breakthrough model offering reasoning on demand.',
  authority_score: 95,
  published_at: Date.now() - 2 * 3600 * 1000
};

const badges = generateWhyBadges(sampleArticle, 'Claude 3.7');
assert(badges.some(b => b.label === 'Exact match in title'), `Badge detects title match`);
assert(badges.some(b => b.label.includes('Verified Source')), `Badge detects verified authority`);
assert(badges.some(b => b.label.includes('Breaking News')), `Badge detects breaking news (<6h)`);

console.log('\n======================================================');
console.log(`📊 SEARCH TEST RESULTS: ${passed} PASSED | ${failed} FAILED`);
console.log('======================================================\n');

if (failed > 0) {
  process.exit(1);
}
