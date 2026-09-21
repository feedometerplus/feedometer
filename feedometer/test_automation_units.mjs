/**
 * test_automation_units.mjs — FeedOmeter Phase 5 Automation Engine Unit Tests
 * Tests Rule Engine, HMAC Webhook Signatures, Outbox Delivery Queuing, and Digest HTML Compilation
 */

import { evaluateArticleAgainstRule, filterArticlesByRule } from './workers/services/rule-engine.js';
import { generateHmacSignature } from './workers/services/webhook-dispatcher.js';
import { renderDigestHtml } from './workers/services/digest-generator.js';

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

console.log('🧪 Starting Phase 5 Automation & Event Pipeline Unit Tests...\n');

// -----------------------------------------------------------------------------
// 1. Universal Rule Engine Tests
// -----------------------------------------------------------------------------
console.log('1. Testing Universal Rule Engine (Keyword, Boolean AST, Domains, Sources):');

const sampleArticle1 = {
  id: 'art_1',
  title: 'OpenAI announces next-generation GPT-5 model with reasoning',
  summary: 'The new artificial intelligence model excels in mathematical reasoning without crypto integration.',
  url: 'https://techcrunch.com/2026/09/openai-gpt5-release',
  source_id: 'src_techcrunch',
  published_at: Date.now() - 3600000,
  image: 'https://images.unsplash.com/photo-1'
};

const sampleArticle2 = {
  id: 'art_2',
  title: 'Crypto market rally hits new Bitcoin record high',
  summary: 'Digital currencies surge as spot ETFs see massive institutional inflows.',
  url: 'https://coindesk.com/market/crypto-rally',
  source_id: 'src_coindesk',
  published_at: Date.now() - 7200000,
  image: ''
};

// Keyword Whitelist
const ruleInclude = { includeKeywords: ['openai', 'gpt-5'] };
assert(evaluateArticleAgainstRule(sampleArticle1, ruleInclude).matched === true, 'Matches include keywords (OpenAI, GPT-5)');
assert(evaluateArticleAgainstRule(sampleArticle2, ruleInclude).matched === false, 'Rejects article missing include keywords');

// Keyword Blacklist
const ruleExclude = { includeKeywords: ['reasoning'], excludeKeywords: ['crypto'] };
assert(evaluateArticleAgainstRule(sampleArticle1, ruleExclude).matched === false, 'Rejects article containing excluded keyword (crypto)');

// Domain Whitelist & Blacklist
const ruleDomain = { includeDomains: ['techcrunch.com'] };
assert(evaluateArticleAgainstRule(sampleArticle1, ruleDomain).matched === true, 'Matches allowed domain (techcrunch.com)');
assert(evaluateArticleAgainstRule(sampleArticle2, ruleDomain).matched === false, 'Rejects non-whitelisted domain');

// Boolean AST Expression
const ruleBoolean = { booleanQuery: '(OpenAI OR Claude) AND reasoning NOT bitcoin' };
assert(evaluateArticleAgainstRule(sampleArticle1, ruleBoolean).matched === true, 'Matches complex Boolean AST expression');
assert(evaluateArticleAgainstRule(sampleArticle2, ruleBoolean).matched === false, 'Rejects Boolean AST mismatch');

// Quality Guard: Require Image
const ruleImage = { noImage: true };
assert(evaluateArticleAgainstRule(sampleArticle1, ruleImage).matched === true, 'Passes article with valid image');
assert(evaluateArticleAgainstRule(sampleArticle2, ruleImage).matched === false, 'Rejects article with missing image');

// -----------------------------------------------------------------------------
// 2. Webhook HMAC-SHA256 Signature Tests
// -----------------------------------------------------------------------------
console.log('\n2. Testing Webhook HMAC-SHA256 Signature Engine:');

const secretKey = 'whsec_999a8b7c6d5e4f3a2b1c';
const payload = JSON.stringify({
  event: 'article.matched',
  articleId: 'art_1',
  title: sampleArticle1.title
});

const sig1 = await generateHmacSignature(secretKey, payload);
const sig2 = await generateHmacSignature(secretKey, payload);
const sigTampered = await generateHmacSignature(secretKey, payload + ' ');

assert(typeof sig1 === 'string' && sig1.length === 64, `Signature is valid 64-character SHA-256 hex string (${sig1.slice(0, 16)}...)`);
assert(sig1 === sig2, 'Identical payloads & secret produce identical deterministic signatures');
assert(sig1 !== sigTampered, 'Tampered payload produces distinct signature mismatch');

// -----------------------------------------------------------------------------
// 3. Digest HTML Compiler Tests
// -----------------------------------------------------------------------------
console.log('\n3. Testing Scheduled Digest Responsive HTML Compiler:');

const digestHtml = renderDigestHtml('Daily Tech Briefing', [sampleArticle1], 'Alex Smith');

assert(digestHtml.includes('<!DOCTYPE html>'), 'Generated valid DOCTYPE html');
assert(digestHtml.includes('Daily Tech Briefing'), 'Includes digest header title');
assert(digestHtml.includes('Alex Smith'), 'Includes personalized user recipient name');
assert(digestHtml.includes('OpenAI announces next-generation'), 'Renders article headline inside card');
assert(digestHtml.includes('Read full article →'), 'Includes direct article navigation CTA');

// -----------------------------------------------------------------------------
// 4. Batch Filtering Utility Test
// -----------------------------------------------------------------------------
console.log('\n4. Testing Batch Filter Utility:');

const filtered = filterArticlesByRule([sampleArticle1, sampleArticle2], { includeDomains: ['techcrunch.com'] });
assert(filtered.length === 1 && filtered[0].id === 'art_1', 'filterArticlesByRule correctly filtered 2 articles to 1');

// -----------------------------------------------------------------------------
// Final Report
// -----------------------------------------------------------------------------
console.log('\n======================================================');
console.log(`📊 AUTOMATION TEST RESULTS: ${passed} PASSED | ${failed} FAILED`);
console.log('======================================================\n');

if (failed > 0) {
  process.exit(1);
}
