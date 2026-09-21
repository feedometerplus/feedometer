/**
 * test_source_bridges.mjs — Unit & Integration Test Suite for Native Bridges & Source Detector
 * Run with: node test_source_bridges.mjs
 */

import { detectSourceType } from './workers/services/source-detector.js';
import { resolveRedditFeedUrl } from './workers/services/reddit-bridge.js';
import { resolveYouTubeFeedUrl } from './workers/services/youtube-bridge.js';
import { generateDedupLadder, generateContentFingerprint } from './workers/services/article-normalizer.js';
import { generateKeywordFeed } from './workers/services/keyword-feed-engine.js';

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

async function runTests() {
  console.log('\n=== 🧪 FEEDOMETER NATIVE BRIDGES & SOURCE DETECTOR TEST SUITE ===\n');

  // -------------------------------------------------------------
  // Test 1: Source Detector Classification
  // -------------------------------------------------------------
  console.log('--- Suite 1: Source Detector Classification ---');
  
  const yt1 = detectSourceType('@NBA');
  assert(yt1.type === 'youtube' && yt1.handle === 'NBA', 'Detects @NBA as YouTube handle');

  const yt2 = detectSourceType('https://www.youtube.com/@mkbhd');
  assert(yt2.type === 'youtube' && yt2.handle === 'mkbhd', 'Detects youtube.com/@mkbhd as YouTube handle');

  const yt3 = detectSourceType('https://www.youtube.com/channel/UCbj0c1x0123456789012345');
  assert(yt3.type === 'youtube' && yt3.channelId === 'UCbj0c1x0123456789012345', 'Detects youtube channel ID');

  const red1 = detectSourceType('r/technology');
  assert(red1.type === 'reddit' && red1.subreddit === 'technology', 'Detects r/technology shorthand as Reddit subreddit');

  const red2 = detectSourceType('https://www.reddit.com/r/nba/');
  assert(red2.type === 'reddit' && red2.subreddit === 'nba', 'Detects full Reddit URL as subreddit');

  const red3 = detectSourceType('u/spez');
  assert(red3.type === 'reddit' && red3.username === 'spez', 'Detects u/spez shorthand as Reddit user');

  const rss1 = detectSourceType('https://news.ycombinator.com/rss');
  assert(rss1.type === 'rss_atom', 'Detects /rss URL as direct RSS feed');

  const rss2 = detectSourceType('https://blog.rust-lang.org/feed.xml');
  assert(rss2.type === 'rss_atom', 'Detects .xml feed URL as direct RSS');

  const web1 = detectSourceType('techcrunch.com');
  assert(web1.type === 'website' && web1.normalized === 'https://techcrunch.com', 'Detects techcrunch.com as website scrape');

  const web2 = detectSourceType('https://www.theverge.com/tech');
  assert(web2.type === 'website', 'Detects full https URL as website scrape');

  const kw1 = detectSourceType('basketball');
  assert(kw1.type === 'keyword' && kw1.query === 'basketball', 'Detects "basketball" as virtual keyword topic feed');

  const kw2 = detectSourceType('artificial intelligence in medicine');
  assert(kw2.type === 'keyword' && kw2.query === 'artificial intelligence in medicine', 'Detects multi-word query as topic feed');

  // -------------------------------------------------------------
  // Test 2: Reddit Feed URL Resolution
  // -------------------------------------------------------------
  console.log('\n--- Suite 2: Reddit URL Resolution ---');
  
  const rUrl1 = resolveRedditFeedUrl('r/space');
  assert(rUrl1 === 'https://www.reddit.com/r/space/.rss', 'Resolves r/space to https://www.reddit.com/r/space/.rss');

  const rUrl2 = resolveRedditFeedUrl('https://www.reddit.com/r/worldnews');
  assert(rUrl2 === 'https://www.reddit.com/r/worldnews/.rss', 'Appends .rss to full subreddit URL');

  const rUrl3 = resolveRedditFeedUrl('u/spez');
  assert(rUrl3 === 'https://www.reddit.com/user/spez/.rss', 'Resolves u/spez to user RSS feed');

  // -------------------------------------------------------------
  // Test 3: YouTube Feed URL Resolution
  // -------------------------------------------------------------
  console.log('\n--- Suite 3: YouTube URL Resolution ---');
  
  const ytUrl1 = await resolveYouTubeFeedUrl('https://www.youtube.com/channel/UCbj0c1x012345678901234');
  assert(ytUrl1.includes('feeds/videos.xml?channel_id=UCbj0c1x012345678901234'), 'Resolves direct channel ID to videos.xml');

  const ytUrl2 = await resolveYouTubeFeedUrl('https://www.youtube.com/playlist?list=PL123456789');
  assert(ytUrl2.includes('feeds/videos.xml?playlist_id=PL123456789'), 'Resolves playlist URL to videos.xml');

  // -------------------------------------------------------------
  // Test 4: 3-Tier Dedup Ladder
  // -------------------------------------------------------------
  console.log('\n--- Suite 4: 3-Tier Dedup Ladder ---');
  
  const sampleItem = {
    title: 'New Breakthrough in Quantum Computing',
    link: 'https://example.com/news/quantum-2026?utm_source=twitter&utm_medium=social',
    description: 'Scientists announce a major breakthrough in superconducting quantum processors today.',
    platform: 'youtube',
    source_post_id: 'yt:video:abc12345'
  };

  const ladder = await generateDedupLadder(sampleItem, 'https://example.com/feed.xml');
  assert(ladder.level1_platform_id && ladder.level1_platform_id.length === 64, 'Level 1: Platform+ID hash computed (64 hex chars)');
  assert(ladder.level2_url_hash && ladder.level2_url_hash.length === 64, 'Level 2: Canonical URL hash computed (tracking params stripped)');
  assert(ladder.level3_content_hash && ladder.level3_content_hash.length === 64, 'Level 3: Content fingerprint computed (64 hex chars)');

  const fp1 = await generateContentFingerprint('Breaking: Tech News', 'Latest updates on smartphones and gadgets');
  const fp2 = await generateContentFingerprint('breaking: tech news!', 'latest updates on smartphones and gadgets...');
  assert(fp1 === fp2, 'Content fingerprints match across case and punctuation variations');

  // -------------------------------------------------------------
  // Test 5: Virtual Keyword Feed Engine
  // -------------------------------------------------------------
  console.log('\n--- Suite 5: Virtual Keyword Feed Generation ---');

  const kwResult = await generateKeywordFeed('artificial intelligence', null);
  assert(kwResult.ok === true, 'Keyword feed generator returns ok: true');
  assert(kwResult.sourceType === 'keyword', 'Source type is "keyword"');
  assert(kwResult.items && kwResult.items.length > 0, 'Generates articles array');
  assert(kwResult.xml && kwResult.xml.includes('<?xml') && kwResult.xml.includes('<rss'), 'Generates valid standard RSS 2.0 XML');
  assert(kwResult.xml.includes('Topic: Artificial intelligence'), 'XML channel title formatted properly');

  // -------------------------------------------------------------
  // Summary
  // -------------------------------------------------------------
  console.log(`\n=============================================================`);
  console.log(`🏁 Total Tests: ${passed + failed} | Passed: ${passed} | Failed: ${failed}`);
  console.log(`=============================================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Test execution error:', err);
  process.exit(1);
});
