import {
  calculateNextWebhookRun,
  buildSlackBlockKitPayload,
  buildStandardBatchPayload
} from './workers/services/webhook-dispatcher.js';

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

console.log('--- TEST SUITE: Scheduled Webhooks Engine & Slack Block Kit ---\n');

// 1. Test calculateNextWebhookRun
console.log('1. Testing calculateNextWebhookRun():');
{
  const refTime = new Date('2026-09-21T10:00:00Z'); // Monday 10:00 UTC
  
  // Daily at 17:00 UTC (later today)
  const nextDailyLater = calculateNextWebhookRun('daily', '17:00', null, refTime);
  const nextDailyDate = new Date(nextDailyLater);
  assert(
    nextDailyDate.toISOString() === '2026-09-21T17:00:00.000Z',
    `Daily 17:00 calculated correctly for later today (${nextDailyLater})`
  );

  // Daily at 08:00 UTC (already passed today -> tomorrow)
  const nextDailyTomorrow = calculateNextWebhookRun('daily', '08:00', null, refTime);
  const nextDailyTomorrowDate = new Date(nextDailyTomorrow);
  assert(
    nextDailyTomorrowDate.toISOString() === '2026-09-22T08:00:00.000Z',
    `Daily 08:00 scheduled for tomorrow after pass time (${nextDailyTomorrow})`
  );

  // Weekly Monday at 12:00 UTC (later today)
  const nextWeeklyMonLater = calculateNextWebhookRun('weekly', '12:00', 'monday', refTime);
  assert(
    new Date(nextWeeklyMonLater).toISOString() === '2026-09-21T12:00:00.000Z',
    `Weekly Monday 12:00 scheduled for later today (${nextWeeklyMonLater})`
  );

  // Weekly Monday at 08:00 UTC (already passed -> next Monday Sep 28)
  const nextWeeklyMonNext = calculateNextWebhookRun('weekly', '08:00', 'monday', refTime);
  assert(
    new Date(nextWeeklyMonNext).toISOString() === '2026-09-28T08:00:00.000Z',
    `Weekly Monday 08:00 rolled over to next Monday (${nextWeeklyMonNext})`
  );

  // Weekly Friday at 17:00 UTC (Friday Sep 25)
  const nextWeeklyFri = calculateNextWebhookRun('weekly', '17:00', 'friday', refTime);
  assert(
    new Date(nextWeeklyFri).toISOString() === '2026-09-25T17:00:00.000Z',
    `Weekly Friday 17:00 scheduled for upcoming Friday (${nextWeeklyFri})`
  );
}

// 2. Test Slack Block Kit generation
console.log('\n2. Testing buildSlackBlockKitPayload():');
{
  const mockWebhook = {
    name: 'Tech & AI Executive Briefing',
    cadence: 'scheduled',
    schedule_time: '17:00',
    schedule_day: null
  };

  const mockArticles = [
    {
      id: 'art-1',
      title: 'OpenAI Releases Next-Generation Model Suite',
      url: 'https://openai.com/index/announcement',
      domain: 'openai.com',
      image_url: 'https://images.unsplash.com/photo-test-1.jpg',
      content_snippet: 'OpenAI has officially announced their newest frontier AI models featuring breakthrough reasoning capabilities.',
      published_at: '2026-09-21T09:30:00Z'
    },
    {
      id: 'art-2',
      title: 'NVIDIA Expands AI Infrastructure with Next-Gen Chips',
      url: 'https://nvidia.com/news/chips',
      domain: 'nvidia.com',
      content_snippet: 'NVIDIA announced accelerated compute scaling with new datacenter architecture.',
      published_at: '2026-09-21T08:00:00Z'
    }
  ];

  const payload = buildSlackBlockKitPayload(mockWebhook, mockArticles, 'Daily Digest');
  
  assert(typeof payload.text === 'string' && payload.text.length > 0, 'Payload has top-level fallback text');
  assert(Array.isArray(payload.blocks), 'Payload blocks is an array');
  assert(payload.blocks.length >= 4, `Generated ${payload.blocks.length} blocks for 2 articles`);
  assert(payload.blocks[0].type === 'header', 'First block is a header');
  assert(payload.blocks[0].text.text.includes('Tech & AI Executive Briefing'), 'Header includes webhook title');
  assert(payload.blocks[1].elements[0].text.includes('FeedOmeter'), 'Context block includes FeedOmeter branding');
  
  // Verify article card structure
  const section1 = payload.blocks.find(b => b.type === 'section' && b.text?.text?.includes('OpenAI Releases'));
  assert(!!section1, 'Article 1 section block generated');
  assert(section1.accessory && section1.accessory.type === 'image', 'Article 1 has image accessory');
  
  // Verify Slack 50-block cap safety
  const manyArticles = Array.from({ length: 30 }, (_, i) => ({
    id: `art-${i}`,
    title: `Headline Article #${i + 1}`,
    url: `https://example.com/article-${i}`,
    domain: 'example.com',
    content_snippet: `Snippet for article #${i + 1}`
  }));

  const cappedPayload = buildSlackBlockKitPayload(mockWebhook, manyArticles, 'Large Batch');
  assert(cappedPayload.blocks.length <= 50, `Blocks count (${cappedPayload.blocks.length}) strictly <= Slack limit of 50`);
}

// 3. Test Standard Batch JSON Payload
console.log('\n3. Testing buildStandardBatchPayload():');
{
  const mockWebhook = {
    id: 'wh-123',
    name: 'API Ingestion Batch',
    cadence: 'scheduled'
  };

  const mockArticles = [
    { id: '1', title: 'Article One', url: 'https://test.com/1' },
    { id: '2', title: 'Article Two', url: 'https://test.com/2' }
  ];

  const sinceTimestamp = '2026-09-20T00:00:00.000Z';
  const batchPayload = buildStandardBatchPayload(mockWebhook, mockArticles, { from: sinceTimestamp, to: '2026-09-21T00:00:00.000Z' });
  assert(batchPayload.event === 'digest.webhook.batch', `Event type is digest.webhook.batch (${batchPayload.event})`);
  assert(batchPayload.count === 2, 'Count matches articles length');
  assert(Array.isArray(batchPayload.articles) && batchPayload.articles.length === 2, 'Articles array populated');
  assert(batchPayload.since === sinceTimestamp, 'Since timestamp preserved');
}

console.log(`\n================================`);
console.log(`TOTAL: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
console.log(`================================\n`);

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
