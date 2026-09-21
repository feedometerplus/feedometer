/**
 * test_discovery_units.mjs — Unit Test Suite for Internet-Scale Feed Discovery & Scoring Model
 * FeedOmeter 2.1 Search & Discovery Intelligence
 */
import { 
  generateDiscoveryQueries, 
  calculateDiscoveryScore, 
  expandSemanticNeighbors, 
  discoverFeedsAndArticles 
} from './workers/services/feed-discovery-engine.js';

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

console.log('🧪 Starting Feed Discovery & Topic Graph Unit Tests...\n');

// 1. Multi-Category Query Generator Tests
console.log('1. Testing Multi-Category Query Generator:');
const queries = generateDiscoveryQueries('AI Agents');
assert(queries.length >= 15, `Generated ${queries.length} search variations across all 6 categories`);
assert(queries.some(q => q.category === 'rss' && q.query.includes('rss feed')), 'Generated RSS feed query vector');
assert(queries.some(q => q.category === 'publisher' && q.query.includes('best AI Agents blogs')), 'Generated Publisher query vector');
assert(queries.some(q => q.category === 'newsletter' && q.query.includes('substack')), 'Generated Substack/Newsletter query vector');
assert(queries.some(q => q.category === 'youtube' && q.query.includes('youtube channel')), 'Generated YouTube channel query vector');
assert(queries.some(q => q.category === 'research' && q.query.includes('research blog')), 'Generated Research source query vector');
assert(queries.some(q => q.category === 'company' && q.query.includes('startups in')), 'Generated Company/Startup query vector');

// 2. Feed Discovery Scoring Formula Tests
console.log('\n2. Testing Feed Discovery Scoring Formula (35% Relevance + 20% Freq + 15% Auth + 15% Health + 10% Subs + 5% Eng):');

const scoreHighTier = calculateDiscoveryScore({
  relevance: 1.0,
  publishingFrequency: 14, // 14 articles/day
  authorityScore: 98,
  feedHealthPct: 100.0,
  subscriberCount: 142000,
  engagementScore: 90
});
assert(scoreHighTier > 0.85, `High authority + healthy + high frequency yields score > 0.85: ${scoreHighTier}`);

const scoreLowTier = calculateDiscoveryScore({
  relevance: 0.5,
  publishingFrequency: 0.1, // 1 article every 10 days
  authorityScore: 30,
  feedHealthPct: 60.0,
  subscriberCount: 50,
  engagementScore: 10
});
assert(scoreLowTier < 0.45, `Low authority + stale + low health yields score < 0.45: ${scoreLowTier}`);
assert(scoreHighTier > scoreLowTier, `Tier 1 Verified Feed ranks strictly above dormant blog`);

// 3. Semantic Neighbors Expansion Tests
console.log('\n3. Testing Semantic Neighbors & Topic Graph Expansion:');
const cricketNeighbors = expandSemanticNeighbors('cricket');
assert(cricketNeighbors.includes('IPL') && cricketNeighbors.includes('Wisden'), 'Expanded cricket to IPL and Wisden');

const aiNeighbors = expandSemanticNeighbors('AI Agents');
assert(aiNeighbors.includes('MCP') && aiNeighbors.includes('LangChain'), 'Expanded AI Agents to MCP and LangChain');

// 4. End-to-End Zero-Dead-End Discovery Execution
console.log('\n4. Testing Zero-Dead-End Discovery Execution for "cricket":');
const result = await discoverFeedsAndArticles('cricket');
assert(result.query === 'cricket', `Query preserved: ${result.query}`);
assert(result.suggested_sources.length >= 3, `Discovered ${result.suggested_sources.length} top cricket feeds`);
assert(result.suggested_sources.some(s => s.domain === 'espncricinfo.com'), 'Discovered ESPNcricinfo feed');
assert(result.suggested_newsletters.length >= 1, `Discovered ${result.suggested_newsletters.length} cricket newsletters`);
assert(result.articles.length > 0, `Discovered ${result.articles.length} live cricket articles (Zero Dead-End Guarantee)`);
assert(result.related_topics.length > 0, `Discovered ${result.related_topics.length} related topics`);

console.log('\n======================================================');
console.log(`📊 DISCOVERY TEST RESULTS: ${passed} PASSED | ${failed} FAILED`);
console.log('======================================================\n');

if (failed > 0) {
  process.exit(1);
}
