import { parseOpml, generateOpml } from './workers/services/opml-engine.js';

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

console.log('--- EXTENDED OPML 2.0 IMPORT / EXPORT TEST SUITE ---\n');

// 1. Complex Real-World Exports (NewsBlur / NetNewsWire / Pocket Casts formats)
console.log('1. Testing Multi-Format Readers & Complex Entities:');
{
  const complexXml = `<?xml version="1.0" encoding="utf-8"?>
  <opml version="2.0">
    <head>
      <title><![CDATA[My NewsBlur Subscriptions & Feeds]]></title>
      <dateCreated>Mon, 21 Sep 2026 12:00:00 GMT</dateCreated>
    </head>
    <body>
      <!-- Top Level Root Feed -->
      <outline text="The Verge" title="The Verge" type="rss" xmlUrl="https://www.theverge.com/rss/index.xml" htmlUrl="https://www.theverge.com" />
      
      <!-- Folder with special characters -->
      <outline text="AI &amp; Robotics (2026)" title="AI &amp; Robotics (2026)">
        <outline text="MIT Tech Review &gt; AI" title="MIT Tech Review &gt; AI" type="rss" xmlUrl="https://www.technologyreview.com/feed/" htmlUrl="https://www.technologyreview.com" />
        <outline text="" title="" type="rss" xmlUrl="https://openai.com/news/rss.xml" htmlUrl="https://openai.com" />
      </outline>
    </body>
  </opml>`;

  const result = parseOpml(complexXml);
  
  assert(result.title.includes('My NewsBlur Subscriptions'), 'Parsed CDATA title in head');
  assert(result.totalFeeds === 3, `Extracted all 3 feeds across root and folder (got ${result.totalFeeds})`);
  assert(result.rootFeeds.length === 1 && result.rootFeeds[0].feedUrl === 'https://www.theverge.com/rss/index.xml', 'Root feed parsed correctly');
  assert(result.folders.length === 1, `Extracted folder count correctly (got ${result.folders.length})`);
  
  const aiFolder = result.folders.find(f => f.name === 'AI & Robotics (2026)');
  assert(!!aiFolder, 'Decoded folder name entity: AI & Robotics (2026)');
  assert(aiFolder.feeds.length === 2, 'AI folder has 2 feeds');
  
  const emptyTitleFeed = aiFolder.feeds.find(f => f.feedUrl.includes('openai.com'));
  assert(emptyTitleFeed.title === 'openai.com', `Domain fallback applied for empty feed title (${emptyTitleFeed.title})`);
}

// 2. OPML Generator & Roundtrip Consistency
console.log('\n2. Testing OPML 2.0 Export Generator:');
{
  const exportData = {
    title: "FeedOmeter Subscriptions Export",
    ownerName: "Ravik",
    folders: [
      { id: "f1", name: "Design & UX" },
      { id: "f2", name: "Security" }
    ],
    subscriptions: [
      { source_id: "s1", title: "Smashing Magazine", feed_url: "https://www.smashingmagazine.com/feed/", website_url: "https://www.smashingmagazine.com" },
      { source_id: "s2", title: "Sidebar.io", feed_url: "https://sidebar.io/feed.xml", website_url: "https://sidebar.io" },
      { source_id: "s3", title: "Krebs on Security", feed_url: "https://krebsonsecurity.com/feed/", website_url: "https://krebsonsecurity.com" },
      { source_id: "s4", title: "BBC World News", feed_url: "https://feeds.bbci.co.uk/news/world/rss.xml", website_url: "https://www.bbc.com/news" }
    ],
    assignments: [
      { folder_id: "f1", feed_id: "s1" },
      { folder_id: "f1", feed_id: "s2" },
      { folder_id: "f2", feed_id: "s3" }
    ]
  };

  const xmlExport = generateOpml(exportData);
  assert(typeof xmlExport === 'string' && xmlExport.startsWith('<?xml version="1.0" encoding="UTF-8"?>'), 'Generated valid XML header');
  assert(xmlExport.includes('<opml version="2.0">'), 'Contains OPML 2.0 spec root tag');
  assert(xmlExport.includes('<ownerName>Ravik</ownerName>'), 'Contains ownerName tag');
  assert(xmlExport.includes('<outline text="Design &amp; UX"'), 'Escaped ampersand in folder text attribute');
  assert(xmlExport.includes('xmlUrl="https://krebsonsecurity.com/feed/"'), 'Exported feed xmlUrl');

  // Parse generated XML back into objects
  const reParsed = parseOpml(xmlExport);
  assert(reParsed.totalFeeds === 4, `Roundtrip total feeds preserved (4)`);
  assert(reParsed.folders.length === 2, `Roundtrip folder count preserved (2)`);
  assert(reParsed.rootFeeds.length === 1, `Roundtrip root feed preserved (1)`);
  assert(reParsed.rootFeeds[0].title === 'BBC World News', 'Roundtrip feed metadata matches original');
}

console.log(`\n================================`);
console.log(`TOTAL: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
console.log(`================================\n`);

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
