import { generateFallbackChain, evaluateSelectorConfig, INSPECTOR_INJECTION_SCRIPT, detectLikelyJsShell } from './workers/services/visual-builder-engine.js';
import { normalizeRenderMode } from './workers/services/builder-page-fetch.js';
import { calculateFeedHealth } from './workers/services/feed-health.js';
import { buildRssFromUrl } from './workers/services/web-to-rss.js';
import fs from 'fs';

let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (cond) {
    console.log('  PASS: ' + msg);
    passed++;
  } else {
    console.error('  FAIL: ' + msg);
    failed++;
  }
}

async function run() {
  console.log('Starting Visual RSS Studio & Builder Engine Tests...');

  // Test 1: Inspector script injection and selector bridge
  console.log('\n1. Inspector Script Bridge:');
  assert(INSPECTOR_INJECTION_SCRIPT.includes('feedometer-inspector-script'), 'Contains inspector script ID');
  assert(INSPECTOR_INJECTION_SCRIPT.includes('__fom_hover'), 'Contains hover overlay CSS');
  assert(INSPECTOR_INJECTION_SCRIPT.includes('FEEDOMETER_ELEMENT_SELECTED'), 'Dispatches postMessage on click');

  // Test 2: Fallback Chain Generator
  console.log('\n2. Fallback Chain Generator:');
  const chain = generateFallbackChain('article.post-card > h2.title > a', 'title');
  assert(chain.primary.value === 'article.post-card > h2.title > a', 'Primary selector preserved');
  assert(chain.fallbacks.length >= 2, 'Synthesized fallback strategies');
  assert(chain.fallbacks.some(f => f.type === 'xpath'), 'Contains XPath fallback');
  assert(chain.fallbacks.some(f => f.type === 'semantic'), 'Contains semantic descriptor');

  // Test 3: Selector Extraction Engine
  console.log('\n3. Custom Selector Extraction Engine:');
  const html = '<div class="feed"><article class="card"><h2><a href="https://example.com/news/1">Tech News 1</a></h2><p>Summary 1</p><img src="https://example.com/img/1.png"><time datetime="2026-09-22">2026-09-22</time></article><article class="card"><h2><a href="https://example.com/news/2">Tech News 2</a></h2><p>Summary 2</p><img src="https://example.com/img/2.png"><time datetime="2026-09-21">2026-09-21</time></article></div>';
  const config = { itemContainer: 'article.card', title: 'h2 a', link: 'a', description: 'p', image: 'img', date: 'time' };
  const evalRes = evaluateSelectorConfig(html, 'https://example.com', config);
  assert(evalRes.matchCount === 2, 'Matched 2 articles');
  assert(evalRes.items.length === 2, 'Extracted 2 items');
  assert(evalRes.items[0].title === 'Tech News 1', 'Item 1 Title');
  assert(evalRes.items[0].link === 'https://example.com/news/1', 'Item 1 Link');
  assert(evalRes.confidence.title === 1.0, 'Confidence title is 1.0');
  assert(evalRes.confidence.link === 1.0, 'Confidence link is 1.0');

  console.log('\n3b. Selector fields honored independently:');
  const html2 = '<article class="card"><h2 class="headline">Alpha Headline</h2><a class="read-more" href="/story/alpha">Read more</a><p class="sum">Alpha summary text</p></article>';
  const cfg2 = {
    itemContainer: 'article.card',
    title: 'h2.headline',
    link: 'a.read-more',
    description: 'p.sum'
  };
  const eval2 = evaluateSelectorConfig(html2, 'https://example.com/news/', cfg2);
  assert(eval2.matchCount === 1, 'Single container match');
  assert(eval2.items[0].title === 'Alpha Headline', 'Uses title selector not first generic heading');
  assert(eval2.items[0].link === 'https://example.com/story/alpha', 'Uses link selector href');
  assert(eval2.items[0].description.includes('Alpha summary'), 'Uses description selector');

  console.log('\n3c. JS shell detection:');
  assert(detectLikelyJsShell('<html><head></head><body><div id="root"></div><script></script></body></html>') === true, 'Detects SPA shell');
  assert(detectLikelyJsShell('<html><body><article><h2>Hi</h2></article></body></html>') === false, 'Normal article HTML not flagged');

  console.log('\n3d. Render mode normalization:');
  assert(normalizeRenderMode('auto') === 'auto', 'auto mode');
  assert(normalizeRenderMode('browser') === 'browser', 'browser mode');
  assert(normalizeRenderMode('fast') === 'static', 'fast alias static');

  // Test 4: Feed Health Scoring Engine
  console.log('\n4. Feed Health Scoring:');
  const hOptimal = calculateFeedHealth(evalRes.items);
  assert(hOptimal.healthScore >= 90, 'Optimal health score: ' + hOptimal.healthScore + '%');
  assert(hOptimal.status === 'healthy', 'Status is healthy');
  assert(hOptimal.fieldHealth.title === 1.0, 'Title rate 1.0');

  const hEmpty = calculateFeedHealth([]);
  assert(hEmpty.healthScore === 0, 'Empty feed health score is 0');
  assert(hEmpty.status === 'broken', 'Status is broken');

  const hDegraded = calculateFeedHealth([{ title: 'Untitled Article', link: 'invalid' }]);
  assert(hDegraded.healthScore < 60, 'Degraded feed health score: ' + hDegraded.healthScore + '%');
  assert(hDegraded.status === 'failing', 'Degraded status is failing');

  // Test 5: Multi-Format Feed Output in web-to-rss service
  console.log('\n5. Multi-Format Outputs (RSS, Atom, JSON):');
  const res = await buildRssFromUrl('https://news.ycombinator.com');
  assert(res.ok === true, 'buildRssFromUrl ok: true');
  assert(typeof res.xml === 'string' && res.xml.includes('<rss version="2.0"'), 'RSS 2.0 XML generated');
  assert(typeof res.atom === 'string' && res.atom.includes('<feed xmlns="http://www.w3.org/2005/Atom"'), 'Atom 1.0 XML generated');
  assert(typeof res.jsonFeed === 'string' && res.jsonFeed.includes("https://jsonfeed.org/version/1.1"), 'JSON Feed v1.1 generated');
  assert(res.health && typeof res.health.healthScore === 'number', 'Feed health score returned');

  // Test 6: UI & Controller verification (Auto Generator + dedicated Visual Studio)
  console.log('\n6. UI & Script Integration:');
  const bHtml = fs.readFileSync('builder.html', 'utf8');
  const vbHtml = fs.readFileSync('visual-builder.html', 'utf8');
  const vbJs = fs.readFileSync('scripts/visual-builder-studio.js', 'utf8');
  const navJs = fs.readFileSync('navbar/navbar.js', 'utf8');
  assert(vbHtml.includes('Visual RSS Studio') && vbHtml.includes('vb-iframe'), 'visual-builder.html is dedicated studio page');
  assert(vbHtml.includes('visual-builder-studio.js'), 'visual-builder.html loads dedicated studio script');
  assert(vbJs.includes('createFeed') || vbJs.includes('/api/builder/evaluate'), 'visual-builder-studio.js create/evaluate flow');
  assert(bHtml.includes('visual-builder.html'), 'builder.html links to Visual Studio');
  assert(bHtml.includes('feed-health-indicator'), 'builder.html contains health badge');
  assert(bHtml.includes('format-tab-bar'), 'builder.html contains format tab bar');
  assert(navJs.includes('visual-builder.html'), 'navbar lists Visual RSS Studio');

  const bJs = fs.readFileSync('scripts/feedometer-builder.js', 'utf8');
  assert(bJs.includes('buildRssFeed'), 'builder.js buildRssFeed');
  assert(bJs.includes('calculateHealth'), 'builder.js calculateHealth');
  assert(bJs.includes('convertRssToAtom'), 'builder.js convertRssToAtom');
  assert(bJs.includes('convertRssToJsonFeed'), 'builder.js convertRssToJsonFeed');

  console.log('\n🏁 Test Suite Complete: ' + passed + ' passed, ' + failed + ' failed.');
  if (failed > 0) process.exit(1);
}

run().catch(e => { console.error(e); process.exit(1); });