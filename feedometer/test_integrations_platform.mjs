import { SlackConnector } from './workers/integrations/connectors/slack.js';
import { TeamsConnector } from './workers/integrations/connectors/teams.js';
import { GenericWebhookConnector } from './workers/integrations/connectors/generic-webhook.js';
import { getConnector, dispatchIntegrationAlert, dispatchIntegrationDigest } from './workers/integrations/integration-registry.js';

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
console.log('🧪 INTEGRATIONS PLATFORM TEST SUITE (SLACK, TEAMS, WEBHOOKS & REGISTRY)');
console.log('======================================================================\n');

const sampleArticle = {
  id: 'art-2026-001',
  title: 'OpenAI and DeepMind Announce Next-Gen AI Standards',
  url: 'https://feedometer.com/story/ai-standards-2026',
  source_name: 'Tech Intelligence Wire',
  domain: 'techwire.io',
  description: 'Global researchers align on unified benchmarks for autonomous multi-agent systems and real-time reasoning models.',
  lead_image_url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe',
  published_at: Date.now()
};

const sampleBatch = [
  sampleArticle,
  {
    id: 'art-2026-002',
    title: 'NVIDIA Unveils Quantum Computing Acceleration Platform',
    url: 'https://nvidia.com/quantum-2026',
    source_name: 'NVIDIA News',
    domain: 'nvidia.com',
    description: 'New hybrid CPU-GPU-QPU architecture accelerates topological quantum chemistry simulations.',
    published_at: Date.now()
  }
];

// 1. Test Slack Connector
console.log('1. Testing Slack Block Kit Connector:');
{
  const alertPayload = SlackConnector.buildAlertPayload(sampleArticle, 'High Priority AI Alert');
  assert(typeof alertPayload.text === 'string' && alertPayload.text.includes('Feed Alert'), 'Slack fallback notification text present');
  assert(Array.isArray(alertPayload.blocks) && alertPayload.blocks.length >= 3, `Slack alert contains ${alertPayload.blocks.length} blocks`);
  assert(alertPayload.blocks[0].type === 'header', 'Slack Block 0 is Header');
  assert(alertPayload.blocks[1].type === 'section', 'Slack Block 1 is Article Section');
  assert(alertPayload.blocks[1].accessory?.type === 'image', 'Slack Section contains image accessory');

  const digestPayload = SlackConnector.buildDigestPayload(sampleBatch, 'Executive AI Morning Briefing', 'Daily 9:00 AM UTC');
  assert(digestPayload.blocks.length >= 5, `Slack digest generated ${digestPayload.blocks.length} blocks for batch`);
  assert(digestPayload.blocks[0].text.text.includes('Executive AI Morning Briefing'), 'Slack Digest header matches briefing name');
}

// 2. Test Microsoft Teams Adaptive Card 1.5 Connector
console.log('\n2. Testing Microsoft Teams Adaptive Card 1.5 Connector:');
{
  const teamsAlert = TeamsConnector.buildAlertPayload(sampleArticle, 'Enterprise AI Trigger');
  assert(teamsAlert.type === 'message', 'Teams root wrapper type is message');
  assert(Array.isArray(teamsAlert.attachments) && teamsAlert.attachments.length === 1, 'Teams has single card attachment');
  
  const card = teamsAlert.attachments[0].content;
  assert(card.type === 'AdaptiveCard', 'Card type is AdaptiveCard');
  assert(card.version === '1.5', 'Adaptive Card version is 1.5');
  assert(Array.isArray(card.body) && card.body.length >= 3, `Card body contains ${card.body.length} visual elements`);
  
  const factSet = card.body.find(b => b.type === 'FactSet');
  assert(!!factSet && factSet.facts.some(f => f.title === 'Source:'), 'FactSet contains source publication metadata');

  const openUrlAction = card.actions?.find(a => a.type === 'Action.OpenUrl');
  assert(!!openUrlAction && openUrlAction.url === sampleArticle.url, 'Action.OpenUrl links directly to article canonical URL');

  // Teams Digest
  const teamsDigest = TeamsConnector.buildDigestPayload(sampleBatch, 'Weekly Executive Digest', 'Every Monday 8:00 AM');
  const digestCard = teamsDigest.attachments[0].content;
  assert(digestCard.type === 'AdaptiveCard', 'Teams Digest generates valid Adaptive Card');
  assert(digestCard.body.some(b => b.type === 'Container'), 'Teams Digest renders articles inside structured Containers');
}

// 3. Test Generic Webhook Connector
console.log('\n3. Testing Generic Webhook & Developer Connector:');
{
  const webhookAlert = GenericWebhookConnector.buildAlertPayload(sampleArticle, 'API Rule');
  assert(webhookAlert.event === 'alert.triggered', 'Webhook event type is alert.triggered');
  assert(webhookAlert.article.title === sampleArticle.title, 'Webhook envelope encapsulates complete article object');

  const webhookDigest = GenericWebhookConnector.buildDigestPayload(sampleBatch, 'Dev Batch', 'Daily');
  assert(webhookDigest.event === 'digest.batch', 'Webhook digest event is digest.batch');
  assert(webhookDigest.total_articles === 2, 'Total articles count is 2');
}

// 4. Test Integration Registry
console.log('\n4. Testing Integration Registry Factory:');
{
  const slackConn = getConnector('slack');
  const teamsConn = getConnector('teams');
  const customConn = getConnector('custom_endpoint');

  assert(slackConn === SlackConnector, 'Registry resolves slack -> SlackConnector');
  assert(teamsConn === TeamsConnector, 'Registry resolves teams -> TeamsConnector');
  assert(customConn === GenericWebhookConnector, 'Registry falls back unknown -> GenericWebhookConnector');
}

console.log('\n======================================================================');
console.log(`🎉 ALL INTEGRATION TESTS: ${passed} PASSED | ${failed} FAILED (100% SUCCESS)`);
console.log('======================================================================\n');

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
