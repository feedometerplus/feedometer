/**
 * test_phase2_units.js — Automated Unit Test Suite for FeedOmeter Phase 2 Backend Services
 */
import { sha256Hex, hashPassword, verifyPassword } from './workers/lib/crypto.js';
import { canonicalizeUrl, sanitizeText, generateArticleHash, normalizeArticle } from './workers/services/article-normalizer.js';
import { parseXmlFeed } from './workers/services/rss-parser.js';
import { fuseFeedStreams } from './workers/services/feed-fusion.js';

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
  console.log('🧪 Starting Phase 2 Backend Service Unit Tests...\n');

  // 1. Crypto & Password Hashing Tests
  console.log('1. Testing Crypto & Password Hashing:');
  const password = 'SuperSecretPassword123!';
  const hashedPassword = await hashPassword(password);
  assert(hashedPassword.includes(':'), 'Hash contains salt delimiter');
  
  const isValid = await verifyPassword(password, hashedPassword);
  assert(isValid === true, 'Valid password verifies successfully');

  const isInvalid = await verifyPassword('WrongPassword', hashedPassword);
  assert(isInvalid === false, 'Invalid password is rejected');

  // 2. Canonical URL & Article Hash Tests
  console.log('\n2. Testing Canonical URL & Article Identity:');
  const dirtyUrl = 'HTTPS://TheVerge.Com/tech/ai-superchips?utm_source=feed&fbclid=XYZ123#discussion';
  const cleanUrl = canonicalizeUrl(dirtyUrl);
  assert(cleanUrl === 'https://theverge.com/tech/ai-superchips', `Canonical URL strips tracking & fragment (${cleanUrl})`);

  const hash1 = await generateArticleHash(dirtyUrl);
  const hash2 = await generateArticleHash('https://theverge.com/tech/ai-superchips?utm_campaign=newsletter');
  assert(hash1 === hash2, 'Identical canonical URLs produce identical article_hash across syndication');
  assert(hash1.length === 64, 'article_hash is valid 64-char SHA-256 hex string');

  // 3. Universal XML & Atom RSS Parser Tests
  console.log('\n3. Testing XML RSS & Atom Parser:');
  const sampleRss = `
    <?xml version="1.0" encoding="UTF-8"?>
    <rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/">
      <channel>
        <title>Tech Dispatch</title>
        <link>https://techdispatch.com</link>
        <item>
          <title><![CDATA[Quantum Computing Breakthrough Announced]]></title>
          <link>https://techdispatch.com/news/quantum-2026?utm_source=rss</link>
          <description><![CDATA[Researchers have demonstrated fault-tolerant qubits. <img src="https://techdispatch.com/img/qubit.jpg">]]></description>
          <pubDate>Fri, 18 Sep 2026 08:00:00 GMT</pubDate>
          <media:content url="https://techdispatch.com/img/qubit-hero.jpg" type="image/jpeg" />
          <enclosure url="https://techdispatch.com/audio/episode1.mp3" type="audio/mpeg" />
        </item>
      </channel>
    </rss>
  `;

  const parsed = parseXmlFeed(sampleRss);
  assert(parsed.title === 'Tech Dispatch', 'Feed title parsed correctly');
  assert(parsed.items.length === 1, 'Extracted 1 RSS item');
  assert(parsed.items[0].title === 'Quantum Computing Breakthrough Announced', 'Extracted CDATA title');
  assert(parsed.items[0].image === 'https://techdispatch.com/img/qubit-hero.jpg', 'Extracted media:content hero image');
  assert(parsed.items[0].audio && parsed.items[0].audio.type === 'audio/mpeg', 'Extracted podcast audio enclosure');

  // 4. Normalization Test
  console.log('\n4. Testing Article Normalization:');
  const normalized = await normalizeArticle(parsed.items[0], { id: 'src_tech', title: 'Tech Dispatch' });
  assert(normalized.id.length === 64, 'Normalized item has valid article_hash ID');
  assert(normalized.link === 'https://techdispatch.com/news/quantum-2026', 'Normalized link is canonical');
  assert(normalized.source.id === 'src_tech', 'Source ID attached');

  // 5. Feed Fusion & Cross-Feed Deduplication Test
  console.log('\n5. Testing Feed Fusion & Cross-Feed Deduplication:');
  const mockSources = [
    {
      id: 'src_1',
      title: 'Outlet Alpha',
      feed_url: 'https://alpha.example.com/rss'
    },
    {
      id: 'src_2',
      title: 'Outlet Beta (Syndicated)',
      feed_url: 'https://beta.example.com/rss'
    }
  ];

  // Simulated mock responses
  const mockEnv = {
    FEEDS_KV: {
      async get(key) {
        if (key.includes('alpha')) {
          return {
            source: { id: 'src_1', title: 'Outlet Alpha' },
            items: [
              { id: 'hash_common', title: 'Global Tech Accord Signed', link: 'https://globalnews.com/accord', published: '2026-09-18T07:00:00.000Z' },
              { id: 'hash_alpha_only', title: 'Alpha Exclusive Story', link: 'https://alpha.example.com/exclusive', published: '2026-09-18T08:00:00.000Z' }
            ]
          };
        }
        if (key.includes('beta')) {
          return {
            source: { id: 'src_2', title: 'Outlet Beta' },
            items: [
              { id: 'hash_common', title: 'Global Tech Accord Signed', link: 'https://globalnews.com/accord?ref=beta', published: '2026-09-18T07:00:00.000Z' },
              { id: 'hash_beta_only', title: 'Beta Market Analysis', link: 'https://beta.example.com/markets', published: '2026-09-18T06:00:00.000Z' }
            ]
          };
        }
        return null;
      },
      async put() {}
    }
  };

  const fused = await fuseFeedStreams(mockSources, mockEnv, null, { limit: 10 });
  assert(fused.status === 'success', 'Fusion returned success');
  assert(fused.items.length === 3, `Deduplication merged common story (Expected 3 unique items, got ${fused.items.length})`);
  assert(fused.items[0].title === 'Alpha Exclusive Story', 'Sorted chronologically: 08:00 story is first');
  assert(fused.items[1].title === 'Global Tech Accord Signed', 'Sorted chronologically: 07:00 story is second');
  assert(fused.items[2].title === 'Beta Market Analysis', 'Sorted chronologically: 06:00 story is third');

  console.log('\n======================================================');
  console.log(`📊 TEST RESULTS: ${passed} PASSED | ${failed} FAILED`);
  console.log('======================================================\n');

  if (failed > 0) process.exit(1);
}

runTests().catch(err => {
  console.error('Test execution error:', err);
  process.exit(1);
});
