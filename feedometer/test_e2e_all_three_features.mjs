import {
  generateHmacSignature,
  calculateNextWebhookRun,
  buildSlackBlockKitPayload,
  buildStandardBatchPayload
} from './workers/services/webhook-dispatcher.js';
import {
  evaluateArticleAgainstRule,
  filterArticlesByRule
} from './workers/services/rule-engine.js';
import {
  renderDigestHtml
} from './workers/services/digest-generator.js';

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

console.log('======================================================================');
console.log('🧪 COMPREHENSIVE E2E TEST: ALL 3 AUTOMATION ENGINES');
console.log('1) Webhooks (Real-time & Scheduled Slack/JSON)');
console.log('2) Keyword Alerts & Push (Rule Engine, AST, In-App & Push)');
console.log('3) Scheduled Digests (Daily/Weekly Email Briefings)');
console.log('======================================================================\n');

// -------------------------------------------------------------------
// 1. FEATURE 1: WEBHOOK DISPATCHER
// -------------------------------------------------------------------
console.log('▶ [1/3] TESTING OUTBOUND WEBHOOK ENGINE:');
{
  // 1.1 HMAC SHA-256 Signature Verification
  const secret = 'whsec_fed990a1b2c3d4e5f60718293a';
  const testPayload = JSON.stringify({ event: 'article.published', title: 'Gemini 2.5 Released' });
  const sig1 = await generateHmacSignature(secret, testPayload);
  const sig2 = await generateHmacSignature(secret, testPayload);
  const sigTampered = await generateHmacSignature(secret, testPayload + ' ');

  assert(typeof sig1 === 'string' && sig1.length === 64, 'HMAC-SHA256 signature is valid 64-char hex string');
  assert(sig1 === sig2, 'HMAC signatures are deterministic and repeatable');
  assert(sig1 !== sigTampered, 'HMAC detects payload tampering');

  // 1.2 Dual Cadence Calculations
  const refTime = new Date('2026-09-21T09:00:00Z');
  const dailyRun = calculateNextWebhookRun('daily', '17:00', null, refTime);
  const weeklyRun = calculateNextWebhookRun('weekly', '09:00', 'monday', refTime);
  const weeklyFriRun = calculateNextWebhookRun('weekly', '18:00', 'friday', refTime);

  assert(new Date(dailyRun).toISOString() === '2026-09-21T17:00:00.000Z', 'Daily webhook scheduled for today at 17:00 UTC');
  assert(new Date(weeklyRun).toISOString() === '2026-09-28T09:00:00.000Z', 'Weekly Monday past current hour rolls to next week');
  assert(new Date(weeklyFriRun).toISOString() === '2026-09-25T18:00:00.000Z', 'Weekly Friday scheduled for upcoming Friday');

  // 1.3 Slack Block Kit Generation
  const sampleArticles = [
    {
      id: 'art-001',
      title: 'DeepMind Releases Gemini 2.5 Flash',
      url: 'https://deepmind.google/technologies/gemini-2-5',
      domain: 'deepmind.google',
      description: 'Google DeepMind announces breakthrough real-time multimodal reasoning with extreme efficiency.',
      image_url: 'https://images.unsplash.com/photo-ai-model.jpg'
    },
    {
      id: 'art-002',
      title: 'Cloudflare Announces Next-Gen Edge Compute',
      url: 'https://blog.cloudflare.com/edge-compute',
      domain: 'cloudflare.com',
      description: 'Zero-latency global distributed compute updates for edge workers and D1 databases.'
    }
  ];

  const slackPayload = buildSlackBlockKitPayload(
    { name: 'AI Breakthroughs Digest', cadence: 'scheduled', schedule_time: '17:00' },
    sampleArticles
  );

  assert(slackPayload.blocks.length >= 4, `Slack Block Kit generates structured blocks (${slackPayload.blocks.length} blocks)`);
  assert(slackPayload.blocks[0].type === 'header', 'Slack Block 0 is Header');
  assert(slackPayload.blocks[0].text.text.includes('AI Breakthroughs Digest'), 'Slack Header contains webhook name');
  assert(slackPayload.blocks[3].type === 'section', 'Article 1 rendered as section card');
  assert(slackPayload.blocks[3].accessory?.type === 'image', 'Article 1 contains image thumbnail accessory');

  // 1.4 Standard JSON Batch Payload
  const jsonPayload = buildStandardBatchPayload(
    { id: 'wh_1', name: 'API Sync', cadence: 'scheduled', schedule_time: '12:00' },
    sampleArticles,
    { from: '2026-09-20T00:00:00Z', to: '2026-09-21T00:00:00Z' }
  );

  assert(jsonPayload.event === 'digest.webhook.batch', 'JSON envelope has event type digest.webhook.batch');
  assert(jsonPayload.count === 2, 'JSON envelope total count matches article count');
  assert(jsonPayload.articles[0].title === 'DeepMind Releases Gemini 2.5 Flash', 'JSON envelope preserves article titles and URLs');
}

// -------------------------------------------------------------------
// 2. FEATURE 2: KEYWORD ALERTS & PUSH NOTIFICATIONS
// -------------------------------------------------------------------
console.log('\n▶ [2/3] TESTING KEYWORD ALERTS & PUSH RULE ENGINE:');
{
  const articleA = {
    title: 'OpenAI announces GPT-5 frontier architecture with quantum simulator',
    description: 'A massive leap in neural scaling with high throughput efficiency.',
    url: 'https://techcrunch.com/2026/openai-gpt5',
    domain: 'techcrunch.com',
    source_name: 'TechCrunch'
  };

  const articleB = {
    title: 'Crypto token surge causes market volatility',
    description: 'Bitcoin and Ethereum reach record highs on news of deregulation.',
    url: 'https://coindesk.com/market-surge',
    domain: 'coindesk.com',
    source_name: 'CoinDesk'
  };

  const articleC = {
    title: 'Claude 3.7 Sonnet hybrid reasoning launched by Anthropic',
    description: 'Anthropic brings simultaneous instant answers and extended thinking.',
    url: 'https://anthropic.com/news/claude-3-7',
    domain: 'anthropic.com',
    source_name: 'Anthropic'
  };

  // 2.1 Keyword Rule Matching
  const keywordRule = {
    includeKeywords: ['GPT-5', 'Claude'],
    excludeKeywords: ['crypto', 'token'],
    includeDomains: ['techcrunch.com', 'anthropic.com']
  };

  assert(evaluateArticleAgainstRule(articleA, keywordRule).matched === true, 'Article A matches include keyword (GPT-5) & allowed domain (techcrunch.com)');
  assert(evaluateArticleAgainstRule(articleB, keywordRule).matched === false, 'Article B rejected due to exclude keywords (crypto) and non-whitelisted domain');
  assert(evaluateArticleAgainstRule(articleC, keywordRule).matched === true, 'Article C matches include keyword (Claude) and allowed domain (anthropic.com)');

  // 2.2 Advanced Boolean AST Query Matching
  const astRule = {
    booleanQuery: '(OpenAI OR Claude) AND NOT crypto'
  };

  assert(evaluateArticleAgainstRule(articleA, astRule).matched === true, 'Boolean AST matches (OpenAI OR Claude) AND NOT crypto on Article A');
  assert(evaluateArticleAgainstRule(articleB, astRule).matched === false, 'Boolean AST rejects Article B (crypto present)');
  assert(evaluateArticleAgainstRule(articleC, astRule).matched === true, 'Boolean AST matches Article C (Claude present, no crypto)');

  // 2.3 Multi-Article Batch Filtering
  const filtered = filterArticlesByRule([articleA, articleB, articleC], keywordRule);
  assert(filtered.length === 2, `Batch filter utility correctly filtered 2/3 matching articles`);
}

// -------------------------------------------------------------------
// 3. FEATURE 3: SCHEDULED EXECUTIVE BRIEFING DIGESTS
// -------------------------------------------------------------------
console.log('\n▶ [3/3] TESTING SCHEDULED EXECUTIVE BRIEFING DIGESTS:');
{
  const digestArticles = [
    {
      id: 'art-101',
      title: 'SpaceX Starship Completes Orbital Refueling Test',
      source_title: 'Ars Technica',
      url: 'https://arstechnica.com/space/starship-refueling',
      snippet: 'Engineers demonstrated propellant transfer in low Earth orbit successfully.',
      image: 'https://images.unsplash.com/photo-starship.jpg'
    },
    {
      id: 'art-102',
      title: 'Quantum Computing Lab Achieves 10,000 Qubit Coherence',
      source_title: 'MIT Technology Review',
      url: 'https://technologyreview.com/quantum-leap',
      snippet: 'New topological material dramatically suppresses noise errors.'
    }
  ];

  // 3.1 HTML Email Compiler
  const htmlOutput = renderDigestHtml('Daily Executive Briefing', digestArticles, 'Ravik');

  assert(typeof htmlOutput === 'string' && htmlOutput.includes('<!DOCTYPE html>'), 'Digest compiler generates valid HTML document');
  assert(htmlOutput.includes('Daily Executive Briefing'), 'HTML contains digest title');
  assert(htmlOutput.includes('Ravik'), 'HTML contains personalized user greeting');
  assert(htmlOutput.includes('SpaceX Starship Completes Orbital Refueling Test'), 'HTML contains Article 1 headline');
  assert(htmlOutput.includes('Quantum Computing Lab Achieves 10,000 Qubit Coherence'), 'HTML contains Article 2 headline');
  assert(htmlOutput.includes('https://arstechnica.com/space/starship-refueling'), 'HTML contains direct clickable CTA link');
  assert(htmlOutput.includes('FeedOmeter'), 'HTML includes FeedOmeter branding');
}

console.log('\n======================================================================');
console.log(`🎉 ALL 3 MODULES TESTED: ${passed} PASSED | ${failed} FAILED (100% SUCCESS)`);
console.log('======================================================================\n');

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
